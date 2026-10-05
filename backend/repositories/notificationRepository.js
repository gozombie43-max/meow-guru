import { cachedNotificationUnread, invalidateNotificationUnread } from '../services/notificationUnreadCache.js';
import { ObjectId } from "mongodb";
import { boundedLegacyOffset, readKeysetPage } from '../infrastructure/keysetPage.js';
import {
  getPushDevicesCollection,
  getNotificationHistoryCollection,
  getScheduledNotificationsCollection,
  getNotificationWorkerHealthCollection,
  getNotificationFeedCollection,
  getNotificationReceiptsCollection,
  getNotificationEngagementCollection,
  getUsersCollection,
} from "../config/mongodb.js";

export const getHealthDocs = async (workerNames) => {
  const health = getNotificationWorkerHealthCollection();
  return health.find({ workerName: { $in: workerNames } }).sort({ lastHeartbeatAt: -1 }).toArray();
};

export const getScheduledNotificationsCount = async (filter) => {
  const scheduled = getScheduledNotificationsCollection();
  return scheduled.countDocuments(filter);
};

export const getPushMetricsAggregate = async (since) => {
  const feed = getNotificationFeedCollection();
  return feed.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        "pushMetrics.processedAt": { $exists: true },
      },
    },
    {
      $group: {
        _id: null,
        targetDevices: { $sum: { $ifNull: ["$pushMetrics.targetDevices", 0] } },
        acceptedCount: { $sum: { $ifNull: ["$pushMetrics.acceptedCount", 0] } },
        failureCount: { $sum: { $ifNull: ["$pushMetrics.failureCount", 0] } },
        invalidDeviceCount: { $sum: { $ifNull: ["$pushMetrics.invalidDeviceCount", 0] } },
      },
    },
  ]).toArray();
};

export const upsertPushDevice = async (fid, platform, userId, email, now) => {
  const collection = getPushDevicesCollection();
  return collection.updateOne(
    { fid },
    {
      $set: {
        userId,
        email,
        platform,
        enabled: true,
        updatedAt: now,
        lastSeenAt: now,
      },
      $unset: { disabledAt: "", disabledReason: "" },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
};

export const disablePushDevice = async (fid, userId, now) => {
  const collection = getPushDevicesCollection();
  return collection.updateOne(
    { fid, userId },
    {
      $set: {
        enabled: false,
        disabledAt: now,
        disabledReason: "logout",
        updatedAt: now,
      },
    }
  );
};

export const insertNotificationHistory = async (doc) => {
  const history = getNotificationHistoryCollection();
  return history.insertOne(doc);
};

export const getNotificationHistoryList = async (page, limit, cursor) => {
  const collection = getNotificationHistoryCollection();
  if (cursor || page === 1) {
    const result = await readKeysetPage(collection, {
      scope: 'notification-history',
      cursor,
      limit,
      includeTotal: false
    });
    return { items: result.items, hasMore: result.hasMore, nextCursor: result.nextCursor };
  } else {
    // Legacy fallback for page > 1 without cursor
    const items = await collection.find({}).sort({ createdAt: -1 }).skip(boundedLegacyOffset(page, limit)).limit(limit).toArray();
    return { items };
  }
};

export const insertScheduledNotification = async (doc) => {
  const collection = getScheduledNotificationsCollection();
  return collection.insertOne(doc);
};

export const getScheduledNotificationsList = async (filter, sort, page, limit, cursor) => {
  const collection = getScheduledNotificationsCollection();
  
  // We can optimize the counts by caching them if needed, but for now we'll just omit them or keep them if they are small scale.
  // Actually, item 19 says "Remove exact counts from page requests". So we omit total from the list request.
  let items, hasMore, nextCursor;
  if (cursor || page === 1) {
    const result = await readKeysetPage(collection, {
      filter,
      filterScope: filter, // used to ensure cursor stability across same filters
      scope: 'scheduled-notifications',
      field: Object.keys(sort)[0] || 'createdAt',
      direction: Object.values(sort)[0] || -1,
      cursor,
      limit,
      includeTotal: false
    });
    items = result.items;
    hasMore = result.hasMore;
    nextCursor = result.nextCursor;
  } else {
    items = await collection.find(filter).sort(sort).skip(boundedLegacyOffset(page, limit)).limit(limit).toArray();
  }
  
  const [pendingCount, sentCount, failedCount, cancelledCount] = await Promise.all([
    collection.countDocuments({ status: "pending" }),
    collection.countDocuments({ status: "sent" }),
    collection.countDocuments({ status: "failed" }),
    collection.countDocuments({ status: "cancelled" }),
  ]);
  return { items, hasMore, nextCursor, pendingCount, sentCount, failedCount, cancelledCount };
};

export const cancelScheduledNotification = async (id, userId, email) => {
  const collection = getScheduledNotificationsCollection();
  return collection.findOneAndUpdate(
    { _id: new ObjectId(id), status: "pending" },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledByUserId: userId,
        cancelledByEmail: email,
      },
    },
    { returnDocument: "after" }
  );
};

export const getScheduledNotificationById = async (id) => {
  const collection = getScheduledNotificationsCollection();
  return collection.findOne({ _id: new ObjectId(id) });
};

export const setScheduledNotificationRetried = async (id, retryJobId, userId) => {
  const collection = getScheduledNotificationsCollection();
  return collection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        retriedAt: new Date(),
        retriedByUserId: userId,
        retryJobId,
      },
    }
  );
};

export const getUserLastReadAllAt = async (userId) => {
  const users = getUsersCollection();
  const user = await users.findOne(
    { id: userId },
    { projection: { "notificationState.lastReadAllAt": 1 } }
  );
  return user?.notificationState?.lastReadAllAt ? new Date(user.notificationState.lastReadAllAt) : new Date(0);
};

const computeInboxUnreadCount = async (userId, lastReadAllAt, now) => {
  const feed = getNotificationFeedCollection();
  const result = await feed.aggregate([
    {
      $match: {
        createdAt: { $gt: lastReadAllAt },
        $and: [
          { $or: [{ audience: "all" }, { audience: "user", userId }] },
          { $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] },
        ],
      },
    },
    {
      $lookup: {
        from: "notificationReceipts",
        let: { notificationId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$notificationId", "$$notificationId"] },
                  { $eq: ["$userId", userId] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "readReceipt",
      },
    },
    { $match: { readReceipt: { $eq: [] } } },
    { $group: { _id: null, count: { $sum: 1 }, nextExpiry: { $min: "$expiresAt" } } },
  ], { maxTimeMS: 5000 }).toArray();
  return result[0] || { count: 0 };
};

export const getInboxUnreadCount = (userId, _lastReadAllAt, _now, options) => cachedNotificationUnread(userId, async () => {
  const lastReadAllAt = await getUserLastReadAllAt(userId);
  return computeInboxUnreadCount(userId, lastReadAllAt, new Date());
}, options);

export const getInboxItems = async (userId, lastReadAllAt, now, page, limit, pagination) => {
  const feed = getNotificationFeedCollection();
  const visibleFilter = {
    $and: [
      { $or: [{ audience: "all" }, { audience: "user", userId }] },
      { $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] },
    ],
  };

  const cursorPage = pagination ? await readKeysetPage(feed, { filter: visibleFilter, filterScope: { userId }, scope: `inbox:${userId}`, cursor: pagination.cursor, limit, includeTotal: false }) : null;
  const [items, total] = cursorPage ? [cursorPage.items, cursorPage.total] : await Promise.all([
    feed.find(visibleFilter).sort({ createdAt: -1 }).skip(boundedLegacyOffset(page, limit)).limit(limit).toArray(),
    feed.countDocuments(visibleFilter),
  ]);

  const unreadCount = await getInboxUnreadCount(userId, undefined, undefined, { reconcile: true });
  return { items, total, unreadCount, ...(cursorPage ? { nextCursor: cursorPage.nextCursor, hasMore: cursorPage.hasMore } : {}) };
};

export const getReadReceiptsForIds = async (userId, ids) => {
  if (ids.length === 0) return [];
  const receipts = getNotificationReceiptsCollection();
  return receipts.find({ userId, notificationId: { $in: ids } }).toArray();
};

export const getNotificationForUser = async (id, userId) => {
  const feed = getNotificationFeedCollection();
  return feed.findOne({
    _id: new ObjectId(id),
    $or: [{ audience: "all" }, { audience: "user", userId }],
  });
};

export const upsertReadReceipt = async (userId, notificationId) => {
  const receipts = getNotificationReceiptsCollection();
  const result = await receipts.updateOne(
    { userId, notificationId },
    {
      $set: { readAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  await invalidateNotificationUnread(userId);
  return result;
};

export const setAllReadForUser = async (userId, now) => {
  const users = getUsersCollection();
  const result = await users.updateOne(
    { id: userId },
    { $set: { "notificationState.lastReadAllAt": now } }
  );
  await invalidateNotificationUnread(userId);
  return result;
};

export const insertEngagement = async (doc) => {
  const engagement = getNotificationEngagementCollection();
  return engagement.insertOne(doc);
};

export const getAnalyticsAggregate = async (since) => {
  const feed = getNotificationFeedCollection();
  const engagement = getNotificationEngagementCollection();

  return Promise.all([
    feed.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          notifications: { $sum: 1 },
          targetDevices: { $sum: { $ifNull: ["$pushMetrics.targetDevices", 0] } },
          acceptedCount: { $sum: { $ifNull: ["$pushMetrics.acceptedCount", 0] } },
          failureCount: { $sum: { $ifNull: ["$pushMetrics.failureCount", 0] } },
        },
      },
    ]).toArray(),
    engagement.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]).toArray(),
    engagement.aggregate([
      { $match: { event: "opened", createdAt: { $gte: since } } },
      { $group: { _id: { userId: "$userId", notificationId: "$notificationId" } } },
      { $count: "count" },
    ]).toArray(),
    engagement.aggregate([
      { $match: { event: "opened", createdAt: { $gte: since } } },
      { $group: { _id: { source: "$source", userId: "$userId", notificationId: "$notificationId" } } },
      { $group: { _id: "$_id.source", count: { $sum: 1 } } },
    ]).toArray(),
  ]);
};
