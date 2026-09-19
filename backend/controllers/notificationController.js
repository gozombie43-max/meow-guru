import { z } from "zod";
import { ObjectId } from "mongodb";
import { sendPushToAllUsers } from "../services/pushNotificationService.js";
import * as repo from "../repositories/notificationRepository.js";

const registerSchema = z.object({
  fid: z.string().trim().min(10).max(256),
  platform: z.enum(["android"]).default("android"),
});

const unregisterSchema = z.object({
  fid: z.string().trim().min(10).max(256),
});

const broadcastSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  route: z.string().trim().default("/"),
  data: z.record(z.string(), z.any()).optional().default({}),
});

const scheduleSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  route: z.string().trim().default("/"),
  sendAt: z.string().datetime(),
});

const retryScheduleSchema = z.object({
  sendAt: z.string().datetime().optional(),
});

const engagementSchema = z.object({
  event: z.enum(["opened", "action_clicked"]),
  source: z.enum(["in_app", "push"]),
});

export const getHealth = async (req, res, next) => {
  try {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const workerConfig = {
      "scheduled-notifications": Number(process.env.NOTIFICATION_WORKER_POLL_MS) || 30_000,
      "daily-practice": Number(process.env.DAILY_REMINDER_WORKER_POLL_MS) || 60_000,
      "streak-protection": Number(process.env.STREAK_PROTECTION_WORKER_POLL_MS) || 60_000,
    };

    const workerNames = Object.keys(workerConfig);

    const [healthDocs, overduePending, stuckProcessing, failed24h, pushRows] = await Promise.all([
      repo.getHealthDocs(workerNames),
      repo.getScheduledNotificationsCount({
        status: "pending",
        sendAt: { $lt: new Date(now.getTime() - 2 * 60 * 1000) },
      }),
      repo.getScheduledNotificationsCount({
        status: "processing",
        processingAt: { $lt: new Date(now.getTime() - 10 * 60 * 1000) },
      }),
      repo.getScheduledNotificationsCount({
        status: "failed",
        failedAt: { $gte: since24h },
      }),
      repo.getPushMetricsAggregate(since24h),
    ]);

    const latestByWorker = new Map();
    for (const doc of healthDocs) {
      if (!latestByWorker.has(doc.workerName)) {
        latestByWorker.set(doc.workerName, doc);
      }
    }

    const workers = Object.entries(workerConfig).map(([workerName, intervalMs]) => {
      const doc = latestByWorker.get(workerName);
      if (!doc) {
        return { workerName, state: "missing", intervalMs };
      }

      const heartbeat = new Date(doc.lastHeartbeatAt);
      const ageMs = now.getTime() - heartbeat.getTime();
      const staleAfterMs = Math.max(intervalMs * 3, 120_000);

      let state = "healthy";
      if (doc.status === "error") {
        state = "error";
      } else if (!Number.isFinite(ageMs) || ageMs > staleAfterMs) {
        state = "stale";
      }

      return {
        workerName,
        state,
        instanceId: doc.instanceId,
        intervalMs,
        ageSeconds: Math.max(0, Math.round(ageMs / 1000)),
        lastHeartbeatAt: doc.lastHeartbeatAt,
        lastDurationMs: doc.lastDurationMs ?? null,
        lastMetrics: doc.lastMetrics ?? {},
        lastError: doc.lastError ?? null,
      };
    });

    const push = pushRows[0] || {};
    const accepted = push.acceptedCount || 0;
    const failed = push.failureCount || 0;
    const totalResponses = accepted + failed;
    const failureRatePercent = totalResponses > 0
      ? Number(((failed / totalResponses) * 100).toFixed(1))
      : 0;
    const warningThreshold = Number(process.env.PUSH_FAILURE_WARNING_PERCENT) || 10;

    const workerProblem = workers.some((worker) => worker.state !== "healthy");
    let status = "healthy";
    if (workerProblem || stuckProcessing > 0) {
      status = "critical";
    } else if (overduePending > 0 || failed24h > 0 || failureRatePercent >= warningThreshold) {
      status = "warning";
    }

    return res.json({
      status,
      checkedAt: now,
      workers,
      scheduled: { overduePending, stuckProcessing, failed24h },
      push24h: {
        targetDevices: push.targetDevices || 0,
        acceptedCount: accepted,
        failureCount: failed,
        invalidDeviceCount: push.invalidDeviceCount || 0,
        failureRatePercent,
        warningThresholdPercent: warningThreshold,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const registerPush = async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid push registration" });

    const { fid, platform } = parsed.data;
    await repo.upsertPushDevice(fid, platform, req.user.id, req.user.email, new Date());
    return res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const unregisterPush = async (req, res, next) => {
  try {
    const parsed = unregisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid push registration" });

    const { fid } = parsed.data;
    await repo.disablePushDevice(fid, req.user.id, new Date());
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const broadcastPush = async (req, res, next) => {
  try {
    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid notification" });

    const result = await sendPushToAllUsers(parsed.data);

    await repo.insertNotificationHistory({
      type: "broadcast",
      title: parsed.data.title,
      body: parsed.data.body,
      route: parsed.data.route,
      totalDevices: result.totalDevices ?? 0,
      successCount: result.successCount ?? 0,
      failureCount: result.failureCount ?? 0,
      invalidDeviceCount: result.invalidDeviceCount ?? 0,
      sentByUserId: req.user.id,
      sentByEmail: req.user.email,
      createdAt: new Date(),
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const { items, total } = await repo.getNotificationHistoryList(page, limit);

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const scheduleNotification = async (req, res, next) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid scheduled notification" });

    const sendAt = new Date(parsed.data.sendAt);
    if (sendAt.getTime() <= Date.now() + 30_000) {
      return res.status(400).json({ error: "Scheduled time must be in the future" });
    }

    const result = await repo.insertScheduledNotification({
      title: parsed.data.title,
      body: parsed.data.body,
      route: parsed.data.route,
      sendAt,
      status: "pending",
      createdByUserId: req.user.id,
      createdByEmail: req.user.email,
      createdAt: new Date(),
      sentAt: null,
      processingAt: null,
    });

    return res.status(201).json({ ok: true, id: result.insertedId, sendAt });
  } catch (error) {
    next(error);
  }
};

export const getScheduledNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const status = String(req.query.status || "all");
    const allowedStatuses = new Set(["all", "pending", "processing", "sent", "failed", "cancelled"]);
    if (!allowedStatuses.has(status)) return res.status(400).json({ error: "Invalid schedule status" });

    const filter = status === "all" ? {} : { status };
    const sort = status === "pending" ? { sendAt: 1 } : { createdAt: -1 };

    const { items, total, pendingCount, sentCount, failedCount, cancelledCount } = await repo.getScheduledNotificationsList(filter, sort, page, limit);

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
};

export const cancelScheduledNotificationHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid notification ID" });

    const item = await repo.cancelScheduledNotification(id, req.user.id, req.user.email);
    if (!item) return res.status(409).json({ error: "Notification is not pending or no longer exists" });

    return res.json({ ok: true, item });
  } catch (error) {
    next(error);
  }
};

export const retryScheduledNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid notification ID" });

    const parsed = retryScheduleSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Invalid retry request" });

    const original = await repo.getScheduledNotificationById(id);
    if (!original) return res.status(404).json({ error: "Scheduled notification not found" });
    if (original.status !== "failed") return res.status(409).json({ error: "Only failed notifications can be retried" });

    const sendAt = parsed.data.sendAt ? new Date(parsed.data.sendAt) : new Date(Date.now() + 30_000);
    if (sendAt.getTime() <= Date.now()) return res.status(400).json({ error: "Retry time must be in the future" });

    const result = await repo.insertScheduledNotification({
      title: original.title,
      body: original.body,
      route: original.route || "/",
      sendAt,
      status: "pending",
      retryOf: original._id,
      createdByUserId: req.user.id,
      createdByEmail: req.user.email,
      createdAt: new Date(),
      sentAt: null,
      processingAt: null,
      attempts: 0,
    });

    await repo.setScheduledNotificationRetried(original._id, result.insertedId, req.user.id);

    return res.status(201).json({ ok: true, id: result.insertedId, sendAt });
  } catch (error) {
    next(error);
  }
};

export const getInboxUnreadCountHandler = async (req, res, next) => {
  try {
    const lastReadAllAt = await repo.getUserLastReadAllAt(req.user.id);
    const unreadCount = await repo.getInboxUnreadCount(req.user.id, lastReadAllAt, new Date());
    return res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
};

export const getInboxHandler = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const now = new Date();

    const lastReadAllAt = await repo.getUserLastReadAllAt(req.user.id);
    const { items, total, unreadCount } = await repo.getInboxItems(req.user.id, lastReadAllAt, now, page, limit);

    const ids = items.map((item) => item._id);
    const readDocs = await repo.getReadReceiptsForIds(req.user.id, ids);
    const individuallyRead = new Set(readDocs.map((item) => String(item.notificationId)));

    const normalizedItems = items.map((item) => ({
      ...item,
      _id: String(item._id),
      read: new Date(item.createdAt) <= lastReadAllAt || individuallyRead.has(String(item._id)),
    }));

    return res.json({
      items: normalizedItems,
      unreadCount,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const readNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid notification ID" });

    const item = await repo.getNotificationForUser(id, req.user.id);
    if (!item) return res.status(404).json({ error: "Notification not found" });

    await repo.upsertReadReceipt(req.user.id, new ObjectId(id));
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const readAllNotifications = async (req, res, next) => {
  try {
    const now = new Date();
    await repo.setAllReadForUser(req.user.id, now);
    return res.json({ ok: true, readAt: now });
  } catch (error) {
    next(error);
  }
};

export const logEngagement = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid notification ID" });

    const parsed = engagementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid engagement event" });

    const notificationId = new ObjectId(id);
    const notification = await repo.getNotificationForUser(id, req.user.id);
    if (!notification) return res.status(404).json({ error: "Notification not found" });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      await repo.insertEngagement({
        userId: req.user.id,
        notificationId,
        event: parsed.data.event,
        source: parsed.data.source,
        notificationType: notification.type,
        category: notification.category,
        createdAt: now,
        expiresAt,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }

    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [notificationStats, engagementStats, uniqueOpened, openedBySource] = await repo.getAnalyticsAggregate(since);

    const push = notificationStats[0] || {};
    const engagementMap = Object.fromEntries(engagementStats.map((item) => [item._id, item.count]));
    const opened = uniqueOpened[0]?.count || 0;
    const sourceMap = Object.fromEntries(openedBySource.map((item) => [item._id, item.count]));

    const actionClicked = engagementMap.action_clicked || 0;
    const acceptedCount = push.acceptedCount || 0;

    return res.json({
      days,
      notifications: push.notifications || 0,
      targetDevices: push.targetDevices || 0,
      acceptedCount,
      failureCount: push.failureCount || 0,
      opened,
      pushOpened: sourceMap.push || 0,
      inAppOpened: sourceMap.in_app || 0,
      actionClicked,
      openRate: acceptedCount > 0 ? Number((opened / acceptedCount * 100).toFixed(1)) : 0,
      actionRate: acceptedCount > 0 ? Number((actionClicked / acceptedCount * 100).toFixed(1)) : 0,
    });
  } catch (error) {
    next(error);
  }
};
