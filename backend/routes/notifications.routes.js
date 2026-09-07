import express from "express";
import { z } from "zod";
import { protect } from "../middleware/protect.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  getPushDevicesCollection,
  getNotificationHistoryCollection,
  getScheduledNotificationsCollection,
} from "../config/mongodb.js";
import { sendPushToAllUsers } from "../services/pushNotificationService.js";

const router = express.Router();

const registerSchema = z.object({
  fid: z.string().trim().min(10).max(256),
  platform: z.enum(["android"]).default("android"),
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

export default router;
