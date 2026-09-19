import { ObjectId } from "mongodb";
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

export const getNotificationHistoryList = async (page, limit) => {
  const collection = getNotificationHistoryCollection();
  const [items, total] = await Promise.all([
    collection.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    collection.countDocuments(),
  ]);
  return { items, total };
};

export const insertScheduledNotification = async (doc) => {
  const collection = getScheduledNotificationsCollection();
  return collection.insertOne(doc);
};

export const getScheduledNotificationsList = async (filter, sort, page, limit) => {
  const collection = getScheduledNotificationsCollection();
  const [items, total, pendingCount, sentCount, failedCount, cancelledCount] = await Promise.all([
    collection.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).toArray(),
    collection.countDocuments(filter),
    collection.countDocuments({ status: "pending" }),
    collection.countDocuments({ status: "sent" }),
    collection.countDocuments({ status: "failed" }),
    collection.countDocuments({ status: "cancelled" }),
  ]);
  return { items, total, pendingCount, sentCount, failedCount, cancelledCount };
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

export const getInboxUnreadCount = async (userId, lastReadAllAt, now) => {
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
    { $count: "count" },
  ]).toArray();
  return result[0]?.count ?? 0;
};

export const getInboxItems = async (userId, lastReadAllAt, now, page, limit) => {
  const feed = getNotificationFeedCollection();
  const visibleFilter = {
    $and: [
      { $or: [{ audience: "all" }, { audience: "user", userId }] },
      { $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] },
    ],
  };

  const [items, total] = await Promise.all([
    feed.find(visibleFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
    feed.countDocuments(visibleFilter),
  ]);

  const unreadResult = await feed.aggregate([
    {
      $match: {
        ...visibleFilter,
        createdAt: { $gt: lastReadAllAt },
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
    { $count: "count" },
  ]).toArray();

  return { items, total, unreadCount: unreadResult[0]?.count ?? 0 };
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
  return receipts.updateOne(
    { userId, notificationId },
    {
      $set: { readAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
};

export const setAllReadForUser = async (userId, now) => {
  const users = getUsersCollection();
  return users.updateOne(
    { id: userId },
    { $set: { "notificationState.lastReadAllAt": now } }
  );
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
