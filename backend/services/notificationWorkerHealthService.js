import {
  getNotificationWorkerHealthCollection,
} from "../config/mongodb.js";

const INSTANCE_ID =
  process.env.WEBSITE_INSTANCE_ID ||
  `pid-${process.pid}`;

const HEALTH_RETENTION_MS =
  7 * 24 * 60 * 60 * 1000;

async function safeUpdate(workerName, update) {
  try {
    await getNotificationWorkerHealthCollection().updateOne(
      {
        workerName,
        instanceId: INSTANCE_ID,
      },
      update,
      { upsert: true }
    );
  } catch (error) {
    // Monitoring must never interrupt notification delivery.
    console.error(
      `Worker health write failed (${workerName}):`,
      error
    );
  }
}

export async function reportWorkerStarted(workerName, intervalMs) {
  const now = new Date();

  await safeUpdate(workerName, {
    $set: {
      workerName,
      instanceId: INSTANCE_ID,
      status: "running",
      intervalMs,
      lastRunStartedAt: now,
      lastHeartbeatAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + HEALTH_RETENTION_MS),
    },
    $inc: {
      runCount: 1,
    },
  });

  return now;
}

export async function reportWorkerSuccess(
  workerName,
  startedAt,
  metrics = {}
) {
  const now = new Date();

  await safeUpdate(workerName, {
    $set: {
      status: "healthy",
      lastRunCompletedAt: now,
      lastHeartbeatAt: now,
      lastDurationMs: Math.max(0, now.getTime() - startedAt.getTime()),
      lastMetrics: metrics,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + HEALTH_RETENTION_MS),
    },
    $unset: {
      lastError: "",
      lastFailedAt: "",
    },
  });
}

export async function reportWorkerFailure(workerName, startedAt, error) {
  const now = new Date();

  await safeUpdate(workerName, {
    $set: {
      status: "error",
      lastFailedAt: now,
      lastHeartbeatAt: now,
      lastDurationMs: Math.max(0, now.getTime() - startedAt.getTime()),
      lastError: String(error?.message || error).slice(0, 1000),
      updatedAt: now,
      expiresAt: new Date(now.getTime() + HEALTH_RETENTION_MS),
    },
  });
}
