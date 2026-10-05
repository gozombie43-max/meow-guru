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
