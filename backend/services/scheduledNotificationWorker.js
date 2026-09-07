import { randomUUID } from "node:crypto";

import {
  getScheduledNotificationsCollection,
  getNotificationHistoryCollection,
} from "../config/mongodb.js";

import {
  sendPushToAllUsers,
} from "./pushNotificationService.js";

import {
  reportWorkerStarted,
  reportWorkerSuccess,
  reportWorkerFailure,
} from "./notificationWorkerHealthService.js";

const POLL_MS =
  Number(process.env.NOTIFICATION_WORKER_POLL_MS) ||
  30_000;

const MAX_JOBS_PER_TICK = 20;

const workerId =
  `${process.env.WEBSITE_INSTANCE_ID || process.pid}-${randomUUID()}`;

let timer = null;
let running = false;

async function markStaleJobsFailed() {
  const collection =
    getScheduledNotificationsCollection();

  // Don't automatically resend an ambiguous job:
  // it may already have reached FCM before a server crash.
  const cutoff =
    new Date(Date.now() - 10 * 60 * 1000);

  await collection.updateMany(
    {
      status: "processing",
      processingAt: {
        $lt: cutoff,
      },
    },
    {
      $set: {
        status: "failed",
        failedAt: new Date(),
        error:
          "Worker stopped while processing. Manual retry required.",
      },
      $unset: {
        workerId: "",
      },
    }
  );
}

async function claimNextJob() {
  const collection =
    getScheduledNotificationsCollection();

  const now = new Date();

  return collection.findOneAndUpdate(
    {
      status: "pending",
      sendAt: {
        $lte: now,
      },
    },
    {
      $set: {
        status: "processing",
        processingAt: now,
        workerId,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      sort: {
        sendAt: 1,
      },
      returnDocument: "after",
    }
  );
}

async function processJob(job) {
  const collection =
    getScheduledNotificationsCollection();

  try {
    const result =
      await sendPushToAllUsers({
        title: job.title,
        body: job.body,
        route: job.route || "/",

        data: {
          notificationType:
            "scheduled",

          scheduledNotificationId:
            String(job._id),
        },
      });

    const sentAt = new Date();

    // Mark SENT before writing history.
    // A history failure must never cause the push
    // notification to be sent again.
    await collection.updateOne(
      {
        _id: job._id,
        status: "processing",
        workerId,
      },
      {
        $set: {
          status: "sent",
          sentAt,

          totalDevices:
            result.totalDevices ?? 0,

          successCount:
            result.successCount ?? 0,

          failureCount:
            result.failureCount ?? 0,

          invalidDeviceCount:
            result.invalidDeviceCount ?? 0,
        },

        $unset: {
          workerId: "",
          processingAt: "",
          error: "",
        },
      }
    );

    // History is secondary; don't resend if this fails.
    try {
      const history =
        getNotificationHistoryCollection();

      await history.insertOne({
        type:
          "scheduled-broadcast",

        scheduledNotificationId:
          job._id,

        title:
          job.title,

        body:
          job.body,

        route:
          job.route || "/",

        scheduledFor:
          job.sendAt,

        totalDevices:
          result.totalDevices ?? 0,

        successCount:
          result.successCount ?? 0,

        failureCount:
          result.failureCount ?? 0,

        invalidDeviceCount:
          result.invalidDeviceCount ?? 0,

        sentByUserId:
          job.createdByUserId,

        sentByEmail:
          job.createdByEmail,

        createdAt:
          sentAt,
      });
    } catch (historyError) {
      console.error(
        "Notification history write failed:",
        historyError
      );
    }

    console.log(
      `Scheduled notification ${job._id} sent:`,
      result
    );

  } catch (error) {
    console.error(
      `Scheduled notification ${job._id} failed:`,
      error
    );

    await collection.updateOne(
      {
        _id: job._id,
        status: "processing",
        workerId,
      },
      {
        $set: {
          status: "failed",
          failedAt:
            new Date(),

          error:
            String(
              error?.message ||
              error
            ).slice(0, 1000),
        },

        $unset: {
          workerId: "",
          processingAt: "",
        },
      }
    );
  }
}

export async function runScheduledNotificationWorkerOnce() {
  if (running) {
    return;
  }

  running = true;

  const startedAt =
    await reportWorkerStarted(
      "scheduled-notifications",
      POLL_MS
    );

  let processed = 0;

  try {
    while (
      processed <
      MAX_JOBS_PER_TICK
    ) {
      const rawJob =
        await claimNextJob();

      const job =
        rawJob?.value !== undefined ? rawJob.value : rawJob;

      if (!job) {
        break;
      }

      await processJob(job);
      processed++;
    }

    await reportWorkerSuccess(
      "scheduled-notifications",
      startedAt,
      { processed }
    );

  } catch (error) {
    await reportWorkerFailure(
      "scheduled-notifications",
      startedAt,
      error
    );

    throw error;

  } finally {
    running = false;
  }
}

export async function startScheduledNotificationWorker() {
  if (timer) {
    return;
  }

  await markStaleJobsFailed();

  // Process anything already overdue.
  await runScheduledNotificationWorkerOnce();

  timer =
    setInterval(() => {
      void runScheduledNotificationWorkerOnce()
        .catch((error) => {
          console.error(
            "Scheduled notification worker error:",
            error
          );
        });
    }, POLL_MS);

  console.log(
    `Notification worker started (${POLL_MS}ms interval) ✅`
  );
}

export function stopScheduledNotificationWorker() {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
}

export async function waitForScheduledNotificationWorkerIdle(
  timeoutMs = 15_000
) {
  const deadline = Date.now() + timeoutMs;

  while (running && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return !running;
}
