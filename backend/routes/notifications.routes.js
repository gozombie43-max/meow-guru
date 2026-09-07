import express from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { protect } from "../middleware/protect.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  getPushDevicesCollection,
  getNotificationHistoryCollection,
  getScheduledNotificationsCollection,
  getNotificationFeedCollection,
  getNotificationReceiptsCollection,
  getNotificationEngagementCollection,
  getUsersCollection,
} from "../config/mongodb.js";
import { sendPushToAllUsers } from "../services/pushNotificationService.js";

const router = express.Router();

const registerSchema = z.object({
  fid: z.string().trim().min(10).max(256),
  platform: z.enum(["android"]).default("android"),
});

const unregisterSchema = z.object({
  fid: z
    .string()
    .trim()
    .min(10)
    .max(256),
});

const broadcastSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100),

  body: z
    .string()
    .trim()
    .min(1)
    .max(500),

  route: z
    .string()
    .trim()
    .default("/"),

  data: z
    .record(z.string(), z.any())
    .optional()
    .default({}),
});

const scheduleSchema = z.object({
  title: z.string().trim().min(1).max(100),

  body: z.string().trim().min(1).max(500),

  route: z.string().trim().default("/"),

  // Frontend sends an ISO-8601 UTC timestamp
  sendAt: z.string().datetime(),
});

router.post("/register", protect, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid push registration" });
    }

    const { fid, platform } = parsed.data;
    const now = new Date();
    const collection = getPushDevicesCollection();

    await collection.updateOne(
      { fid },
      {
        $set: {
          userId: req.user.id,
          email: req.user.email,
          platform,
          enabled: true,
          updatedAt: now,
          lastSeenAt: now,
        },
        $unset: {
          disabledAt: "",
          disabledReason: "",
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/unregister",
  protect,
  async (req, res, next) => {
    try {
      const parsed =
        unregisterSchema.safeParse(
          req.body
        );

      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error:
              "Invalid push registration",
          });
      }

      const { fid } =
        parsed.data;

      const now =
        new Date();

      const collection =
        getPushDevicesCollection();

      /*
       * Important:
       * Require BOTH fid + current user.
       *
       * A logged-in user must never be
       * able to disable another user's
       * installation.
       */
      await collection.updateOne(
        {
          fid,
          userId:
            req.user.id,
        },
        {
          $set: {
            enabled: false,
            disabledAt: now,
            disabledReason:
              "logout",
            updatedAt: now,
          },
        }
      );

      return res.json({
        ok: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/broadcast",
  protect,
  requireRole("admin", "superadmin"),
  async (req, res, next) => {
    try {
      const parsed =
        broadcastSchema.safeParse(
          req.body
        );

      if (!parsed.success) {
        return res.status(400).json({
          error:
            "Invalid notification",
        });
      }

      const result =
        await sendPushToAllUsers(
          parsed.data
        );

      const history =
        getNotificationHistoryCollection();

      await history.insertOne({
        type: "broadcast",

        title: parsed.data.title,
        body: parsed.data.body,
        route: parsed.data.route,

        totalDevices:
          result.totalDevices ?? 0,

        successCount:
          result.successCount ?? 0,

        failureCount:
          result.failureCount ?? 0,

        invalidDeviceCount:
          result.invalidDeviceCount ?? 0,

        sentByUserId:
          req.user.id,

        sentByEmail:
          req.user.email,

        createdAt:
          new Date(),
      });

      return res.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/history",
  protect,
  requireRole(
    "admin",
    "superadmin"
  ),
  async (req, res, next) => {
    try {
      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );

      const limit =
        Math.min(
          50,
          Math.max(
            1,
            Number(req.query.limit) || 20
          )
        );

      const collection =
        getNotificationHistoryCollection();

      const [items, total] =
        await Promise.all([
          collection
            .find({})
            .sort({
              createdAt: -1,
            })
            .skip(
              (page - 1) * limit
            )
            .limit(limit)
            .toArray(),

          collection.countDocuments(),
        ]);

      return res.json({
        items,
        total,
        page,
        limit,
        totalPages:
          Math.ceil(
            total / limit
          ),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/schedule",
  protect,
  requireRole("admin", "superadmin"),
  async (req, res, next) => {
    try {
      const parsed = scheduleSchema.safeParse(
        req.body
      );

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid scheduled notification",
        });
      }

      const sendAt =
        new Date(parsed.data.sendAt);

      if (
        sendAt.getTime() <=
        Date.now() + 30_000
      ) {
        return res.status(400).json({
          error:
            "Scheduled time must be in the future",
        });
      }

      const collection =
        getScheduledNotificationsCollection();

      const result =
        await collection.insertOne({
          title: parsed.data.title,
          body: parsed.data.body,
          route: parsed.data.route,

          sendAt,

          status: "pending",

          createdByUserId:
            req.user.id,

          createdByEmail:
            req.user.email,

          createdAt:
            new Date(),

          sentAt: null,
          processingAt: null,
        });

      return res.status(201).json({
        ok: true,
        id: result.insertedId,
        sendAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/scheduled",
  protect,
  requireRole("admin", "superadmin"),
  async (req, res, next) => {
    try {
      const page = Math.max(
        1,
        Number(req.query.page) || 1
      );

      const limit = Math.min(
        50,
        Math.max(
          1,
          Number(req.query.limit) || 20
        )
      );

      const status =
        String(req.query.status || "all");

      const allowedStatuses = new Set([
        "all",
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ]);

      if (!allowedStatuses.has(status)) {
        return res.status(400).json({
          error: "Invalid schedule status",
        });
      }

      const collection =
        getScheduledNotificationsCollection();

      const filter =
        status === "all"
          ? {}
          : { status };

      const sort =
        status === "pending"
          ? { sendAt: 1 }
          : { createdAt: -1 };

      const [
        items,
        total,
        pendingCount,
        sentCount,
        failedCount,
        cancelledCount,
      ] = await Promise.all([
        collection
          .find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),

        collection.countDocuments(filter),

        collection.countDocuments({
          status: "pending",
        }),

        collection.countDocuments({
          status: "sent",
        }),

        collection.countDocuments({
          status: "failed",
        }),

        collection.countDocuments({
          status: "cancelled",
        }),
      ]);

      return res.json({
        items,
        total,
        page,
        limit,
        totalPages:
          Math.ceil(total / limit),

        counts: {
          pending: pendingCount,
          sent: sentCount,
          failed: failedCount,
          cancelled: cancelledCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/scheduled/:id/cancel",
  protect,
  requireRole("admin", "superadmin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          error: "Invalid notification ID",
        });
      }

      const collection =
        getScheduledNotificationsCollection();

      const item =
        await collection.findOneAndUpdate(
          {
            _id: new ObjectId(id),
            status: "pending",
          },
          {
            $set: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelledByUserId:
                req.user.id,
              cancelledByEmail:
                req.user.email,
            },
          },
          {
            returnDocument: "after",
          }
        );

      if (!item) {
        return res.status(409).json({
          error:
            "Notification is not pending or no longer exists",
        });
      }

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      next(error);
    }
  }
);

const retryScheduleSchema = z.object({
  sendAt: z
    .string()
    .datetime()
    .optional(),
});

router.post(
  "/scheduled/:id/retry",
  protect,
  requireRole("admin", "superadmin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          error: "Invalid notification ID",
        });
      }

      const parsed =
        retryScheduleSchema.safeParse(
          req.body || {}
        );

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid retry request",
        });
      }

      const collection =
        getScheduledNotificationsCollection();

      const original =
        await collection.findOne({
          _id: new ObjectId(id),
        });

      if (!original) {
        return res.status(404).json({
          error:
            "Scheduled notification not found",
        });
      }

      if (original.status !== "failed") {
        return res.status(409).json({
          error:
            "Only failed notifications can be retried",
        });
      }

      const sendAt =
        parsed.data.sendAt
          ? new Date(parsed.data.sendAt)
          : new Date(
              Date.now() + 30_000
            );

      if (
        sendAt.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          error:
            "Retry time must be in the future",
        });
      }

      const result =
        await collection.insertOne({
          title:
            original.title,

          body:
            original.body,

          route:
            original.route || "/",

          sendAt,

          status: "pending",

          retryOf:
            original._id,

          createdByUserId:
            req.user.id,

          createdByEmail:
            req.user.email,

          createdAt:
            new Date(),

          sentAt: null,
          processingAt: null,
          attempts: 0,
        });

      await collection.updateOne(
        {
          _id: original._id,
        },
        {
          $set: {
            retriedAt:
              new Date(),

            retriedByUserId:
              req.user.id,

            retryJobId:
              result.insertedId,
          },
        }
      );

      return res.status(201).json({
        ok: true,
        id: result.insertedId,
        sendAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/inbox/unread-count",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const feed =
        getNotificationFeedCollection();

      const receipts =
        getNotificationReceiptsCollection();

      const users =
        getUsersCollection();

      const user =
        await users.findOne(
          {
            id:
              req.user.id,
          },
          {
            projection: {
              "notificationState.lastReadAllAt":
                1,
            },
          }
        );

      const lastReadAllAt =
        user
          ?.notificationState
          ?.lastReadAllAt
          ? new Date(
              user
                .notificationState
                .lastReadAllAt
            )
          : new Date(0);

      const now =
        new Date();

      const result =
        await feed.aggregate([
          {
            $match: {
              createdAt: {
                $gt:
                  lastReadAllAt,
              },

              $and: [
                {
                  $or: [
                    {
                      audience:
                        "all",
                    },

                    {
                      audience:
                        "user",

                      userId:
                        req.user.id,
                    },
                  ],
                },

                {
                  $or: [
                    {
                      expiresAt: {
                        $gt:
                          now,
                      },
                    },

                    {
                      expiresAt: {
                        $exists:
                          false,
                      },
                    },
                  ],
                },
              ],
            },
          },

          {
            $lookup: {
              from:
                "notificationReceipts",

              let: {
                notificationId:
                  "$_id",
              },

              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $eq: [
                            "$notificationId",
                            "$$notificationId",
                          ],
                        },

                        {
                          $eq: [
                            "$userId",
                            req.user.id,
                          ],
                        },
                      ],
                    },
                  },
                },

                {
                  $limit: 1,
                },
              ],

              as:
                "readReceipt",
            },
          },

          {
            $match: {
              readReceipt: {
                $eq: [],
              },
            },
          },

          {
            $count:
              "count",
          },
        ])
        .toArray();

      return res.json({
        unreadCount:
          result[0]
            ?.count ?? 0,
      });

    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/inbox",
  protect,
  async (req, res, next) => {
    try {
      const page =
        Math.max(
          1,
          Number(
            req.query.page
          ) || 1
        );

      const limit =
        Math.min(
          50,
          Math.max(
            1,
            Number(
              req.query.limit
            ) || 20
          )
        );

      const now =
        new Date();

      const feed =
        getNotificationFeedCollection();

      const receipts =
        getNotificationReceiptsCollection();

      const users =
        getUsersCollection();

      const user =
        await users.findOne(
          {
            id:
              req.user.id,
          },
          {
            projection: {
              notificationState: 1,
            },
          }
        );

      const lastReadAllAt =
        user
          ?.notificationState
          ?.lastReadAllAt
          ? new Date(
              user
                .notificationState
                .lastReadAllAt
            )
          : new Date(0);

      const visibleFilter = {
        $and: [
          {
            $or: [
              {
                audience:
                  "all",
              },

              {
                audience:
                  "user",

                userId:
                  req.user.id,
              },
            ],
          },

          {
            $or: [
              {
                expiresAt: {
                  $gt:
                    now,
                },
              },

              {
                expiresAt: {
                  $exists:
                    false,
                },
              },
            ],
          },
        ],
      };

      const [
        items,
        total,
      ] =
        await Promise.all([
          feed
            .find(
              visibleFilter
            )
            .sort({
              createdAt: -1,
            })
            .skip(
              (page - 1) *
                limit
            )
            .limit(
              limit
            )
            .toArray(),

          feed.countDocuments(
            visibleFilter
          ),
        ]);

      const ids =
        items.map(
          (item) =>
            item._id
        );

      const readDocs =
        ids.length > 0
          ? await receipts
              .find({
                userId:
                  req.user.id,

                notificationId: {
                  $in:
                    ids,
                },
              })
              .toArray()
          : [];

      const individuallyRead =
        new Set(
          readDocs.map(
            (item) =>
              String(
                item
                  .notificationId
              )
          )
        );

      const normalizedItems =
        items.map(
          (item) => ({
            ...item,

            _id:
              String(
                item._id
              ),

            read:
              new Date(
                item.createdAt
              ) <=
                lastReadAllAt ||
              individuallyRead.has(
                String(
                  item._id
                )
              ),
          })
        );

      /*
       * Exact unread count using
       * MongoDB lookup.
       */
      const unreadResult =
        await feed
          .aggregate([
            {
              $match: {
                ...visibleFilter,

                createdAt: {
                  $gt:
                    lastReadAllAt,
                },
              },
            },

            {
              $lookup: {
                from:
                  "notificationReceipts",

                let: {
                  notificationId:
                    "$_id",
                },

                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: [
                              "$notificationId",
                              "$$notificationId",
                            ],
                          },

                          {
                            $eq: [
                              "$userId",
                              req.user.id,
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],

                as:
                  "readReceipt",
              },
            },

            {
              $match: {
                readReceipt: {
                  $eq: [],
                },
              },
            },

            {
              $count:
                "count",
            },
          ])
          .toArray();

      return res.json({
        items:
          normalizedItems,

        unreadCount:
          unreadResult[0]
            ?.count ?? 0,

        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit
          ),
      });

    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/inbox/:id/read",
  protect,
  async (req, res, next) => {
    try {
      const { id } =
        req.params;

      if (
        !ObjectId.isValid(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid notification ID",
          });
      }

      const notificationId =
        new ObjectId(id);

      const feed =
        getNotificationFeedCollection();

      const item =
        await feed.findOne({
          _id:
            notificationId,

          $or: [
            {
              audience:
                "all",
            },

            {
              audience:
                "user",

              userId:
                req.user.id,
            },
          ],
        });

      if (!item) {
        return res
          .status(404)
          .json({
            error:
              "Notification not found",
          });
      }

      const receipts =
        getNotificationReceiptsCollection();

      await receipts.updateOne(
        {
          userId:
            req.user.id,

          notificationId,
        },

        {
          $set: {
            readAt:
              new Date(),
          },

          $setOnInsert: {
            createdAt:
              new Date(),
          },
        },

        {
          upsert:
            true,
        }
      );

      return res.json({
        ok: true,
      });

    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/inbox/read-all",
  protect,
  async (req, res, next) => {
    try {
      const now =
        new Date();

      await getUsersCollection()
        .updateOne(
          {
            id:
              req.user.id,
          },
          {
            $set: {
              "notificationState.lastReadAllAt":
                now,
            },
          }
        );

      return res.json({
        ok: true,
        readAt: now,
      });

    } catch (error) {
      next(error);
    }
  }
);

const engagementSchema =
  z.object({
    event:
      z.enum([
        "opened",
        "action_clicked",
      ]),

    source:
      z.enum([
        "in_app",
        "push",
      ]),
  });

router.post(
  "/inbox/:id/engagement",
  protect,
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      if (
        !ObjectId.isValid(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid notification ID",
          });
      }

      const parsed =
        engagementSchema.safeParse(
          req.body
        );

      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error:
              "Invalid engagement event",
          });
      }

      const notificationId =
        new ObjectId(id);

      /*
       * Verify this notification is
       * actually visible to this user.
       */
      const notification =
        await getNotificationFeedCollection()
          .findOne({
            _id:
              notificationId,

            $or: [
              {
                audience:
                  "all",
              },

              {
                audience:
                  "user",

                userId:
                  req.user.id,
              },
            ],
          });

      if (!notification) {
        return res
          .status(404)
          .json({
            error:
              "Notification not found",
          });
      }

      const now =
        new Date();

      const expiresAt =
        new Date(
          now.getTime() +
            30 *
              24 *
              60 *
              60 *
              1000
        );

      const engagement =
        getNotificationEngagementCollection();

      try {
        await engagement.insertOne({
          userId:
            req.user.id,

          notificationId,

          event:
            parsed.data.event,

          source:
            parsed.data.source,

          notificationType:
            notification.type,

          category:
            notification.category,

          createdAt:
            now,

          expiresAt,
        });

      } catch (error) {
        /*
         * Duplicate engagement from
         * same user = harmless.
         */
        if (
          error?.code !== 11000
        ) {
          throw error;
        }
      }

      return res.json({
        ok: true,
      });

    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/analytics",
  protect,
  requireRole(
    "admin",
    "superadmin"
  ),
  async (
    req,
    res,
    next
  ) => {
    try {
      const days =
        Math.min(
          90,
          Math.max(
            1,
            Number(
              req.query.days
            ) || 30
          )
        );

      const since =
        new Date(
          Date.now() -
            days *
              24 *
              60 *
              60 *
              1000
        );

      const feed =
        getNotificationFeedCollection();

      const engagement =
        getNotificationEngagementCollection();

      const [
        notificationStats,
        engagementStats,
        uniqueOpened,
        openedBySource,
      ] =
        await Promise.all([
          feed.aggregate([
            {
              $match: {
                createdAt: {
                  $gte:
                    since,
                },
              },
            },

            {
              $group: {
                _id: null,

                notifications: {
                  $sum: 1,
                },

                targetDevices: {
                  $sum: {
                    $ifNull: [
                      "$pushMetrics.targetDevices",
                      0,
                    ],
                  },
                },

                acceptedCount: {
                  $sum: {
                    $ifNull: [
                      "$pushMetrics.acceptedCount",
                      0,
                    ],
                  },
                },

                failureCount: {
                  $sum: {
                    $ifNull: [
                      "$pushMetrics.failureCount",
                      0,
                    ],
                  },
                },
              },
            },
          ]).toArray(),

          engagement.aggregate([
            {
              $match: {
                createdAt: {
                  $gte:
                    since,
                },
              },
            },

            {
              $group: {
                _id:
                  "$event",

                count: {
                  $sum: 1,
                },
              },
            },
          ]).toArray(),

          engagement.aggregate([
            {
              $match: {
                event: "opened",
                createdAt: {
                  $gte: since,
                },
              },
            },
            {
              $group: {
                _id: {
                  userId: "$userId",
                  notificationId: "$notificationId",
                },
              },
            },
            {
              $count: "count",
            },
          ]).toArray(),

          engagement.aggregate([
            {
              $match: {
                event: "opened",
                createdAt: {
                  $gte: since,
                },
              },
            },
            {
              $group: {
                _id: {
                  source: "$source",
                  userId: "$userId",
                  notificationId: "$notificationId",
                },
              },
            },
            {
              $group: {
                _id: "$_id.source",
                count: {
                  $sum: 1,
                },
              },
            },
          ]).toArray(),
        ]);

      const push =
        notificationStats[0] ||
        {};

      const engagementMap =
        Object.fromEntries(
          engagementStats.map(
            (item) => [
              item._id,
              item.count,
            ]
          )
        );

      const opened =
        uniqueOpened[0]?.count ||
        0;

      const sourceMap =
        Object.fromEntries(
          openedBySource.map(
            (item) => [
              item._id,
              item.count,
            ]
          )
        );

      const actionClicked =
        engagementMap
          .action_clicked ||
        0;

      const acceptedCount =
        push.acceptedCount ||
        0;

      return res.json({
        days,

        notifications:
          push.notifications ||
          0,

        targetDevices:
          push.targetDevices ||
          0,

        acceptedCount,

        failureCount:
          push.failureCount ||
          0,

        opened,

        pushOpened:
          sourceMap.push ||
          0,

        inAppOpened:
          sourceMap.in_app ||
          0,

        actionClicked,

        openRate:
          acceptedCount > 0
            ? Number(
                (
                  opened /
                  acceptedCount *
                  100
                ).toFixed(
                  1
                )
              )
            : 0,

        actionRate:
          acceptedCount > 0
            ? Number(
                (
                  actionClicked /
                  acceptedCount *
                  100
                ).toFixed(
                  1
                )
              )
            : 0,
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
