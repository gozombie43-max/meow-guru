import {
  getUsersCollection,
} from "../config/mongodb.js";

import {
  sendPushToUser,
} from "./pushNotificationService.js";

import {
  computeNextDailyReminder,
} from "./dailyPracticeReminderService.js";

import {
  getStudyProgress,
} from "./studyProgressService.js";

import {
  reportWorkerStarted,
  reportWorkerSuccess,
  reportWorkerFailure,
} from "./notificationWorkerHealthService.js";

export function buildDailyPracticeMessage({
  goalMinutes,
  progress,
}) {
  if (
    progress.streak >= 2 &&
    progress.completedMinutes > 0
  ) {
    return (
      `🔥 ${progress.streak}-day streak! ` +
      `Only ${progress.remainingMinutes} min left ` +
      `to finish today's goal.`
    );
  }

  if (
    progress.streak >= 2
  ) {
    return (
      `Your ${progress.streak}-day streak is waiting 🔥 ` +
      `Start today's ${goalMinutes}-minute practice.`
    );
  }

  if (
    progress.completedMinutes > 0
  ) {
    return (
      `You've completed ${progress.completedMinutes} of ` +
      `${goalMinutes} min today. ` +
      `${progress.remainingMinutes} min left.`
    );
  }

  return (
    `Your ${goalMinutes}-minute daily practice ` +
    `is ready. Start now 🔥`
  );
}

const POLL_MS =
  Number(
    process.env
      .DAILY_REMINDER_WORKER_POLL_MS
  ) || 60_000;

const BATCH_SIZE = 50;

let timer = null;
let running = false;

async function processUser(
  user,
  now
) {
  const reminder =
    user.dailyPracticeReminder;

  if (
    !reminder?.enabled ||
    !reminder?.nextSendAt ||
    !reminder?.time ||
    !reminder?.timezone
  ) {
    return;
  }

  /*
   * Calculate tomorrow's occurrence
   * BEFORE sending.
   *
   * This deliberately gives us
   * at-most-once reminder semantics:
   * a crash is less harmful than
   * duplicate daily notifications.
   */
  const nextSendAt =
    computeNextDailyReminder({
      time:
        reminder.time,

      timezone:
        reminder.timezone,

      from:
        now,
    });

  const users =
    getUsersCollection();

  /*
   * Atomic claim.
   *
   * If multiple Azure instances see
   * this same due reminder, only one
   * succeeds because nextSendAt must
   * still equal the old value.
   */
  const claim =
    await users.updateOne(
      {
        id:
          user.id,

        "dailyPracticeReminder.enabled":
          true,

        "dailyPracticeReminder.nextSendAt":
          reminder.nextSendAt,
      },

      {
        $set: {
          "dailyPracticeReminder.nextSendAt":
            nextSendAt,

          "dailyPracticeReminder.lastAttemptAt":
            now,
        },
      }
    );

  if (
    claim.modifiedCount !== 1
  ) {
    return;
  }

  const goalMinutes =
    user.dailyGoalMinutes ??
    30;

  const progress =
    await getStudyProgress({
      userId:
        user.id,

      timezone:
        reminder.timezone,

      goalMinutes,

      now,
    });

  if (
    progress.goalComplete
  ) {
    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastResult":
            "goal-completed",

          "dailyPracticeReminder.lastSkippedAt":
            now,
        },
      }
    );

    return;
  }

  try {
    const body =
      buildDailyPracticeMessage({
        goalMinutes,
        progress,
      });

    const result =
      await sendPushToUser(
        user.id,
        {
          title:
            "Daily Practice 🐱",

          body,

          route:
            "/",

          category:
            "dailyPractice",

          data: {
            type:
              "daily_practice",

            streak:
              progress.streak,

            completedMinutes:
              progress.completedMinutes,

            remainingMinutes:
              progress.remainingMinutes,
          },

          centerKey:
            `daily-practice:${user.id}:${progress.dateKey}`,
        }
      );

    const update = {
      "dailyPracticeReminder.lastResult":
        result.suppressed
          ? "suppressed"
          : result.successCount > 0
            ? "sent"
            : "no-device",
    };

    if (
      result.successCount > 0
    ) {
      update[
        "dailyPracticeReminder.lastSentAt"
      ] = now;
    }

    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set:
          update,
      }
    );

  } catch (error) {
    console.error(
      `Daily reminder failed for ${user.id}:`,
      error
    );

    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastResult":
            "failed",

          "dailyPracticeReminder.lastError":
            String(
              error?.message ||
              error
            ).slice(
              0,
              500
            ),
        },
      }
    );
  }
}

export async function runDailyPracticeReminderWorkerOnce() {
  if (running) {
    return;
  }

  running = true;

  const startedAt =
    await reportWorkerStarted(
      "daily-practice",
      POLL_MS
    );

  try {
    const now =
      new Date();

    const users =
      getUsersCollection();

    const dueUsers =
      await users
        .find(
          {
            type: {
              $ne:
                "email_lock",
            },

            status: {
              $nin: [
                "suspended",
                "banned",
              ],
            },

            "dailyPracticeReminder.enabled":
              true,

            "dailyPracticeReminder.nextSendAt":
              {
                $lte:
                  now,
              },
          },
          {
            projection: {
              id: 1,

              name: 1,

              dailyGoalMinutes: 1,

              dailyPracticeReminder:
                1,
            },
          }
        )
        .sort({
          "dailyPracticeReminder.nextSendAt":
            1,
        })
        .limit(
          BATCH_SIZE
        )
        .toArray();

    const results = await Promise.allSettled(
      dueUsers.map(
        (user) =>
          processUser(
            user,
            now
          )
      )
    );

    const rejected = results.filter(
      (result) => result.status === "rejected"
    ).length;

    await reportWorkerSuccess(
      "daily-practice",
      startedAt,
      {
        dueUsers: dueUsers.length,
        rejected,
      }
    );

  } catch (error) {
    await reportWorkerFailure(
      "daily-practice",
      startedAt,
      error
    );

    throw error;

  } finally {
    running = false;
  }
}

export async function startDailyPracticeReminderWorker() {
  if (timer) {
    return;
  }

  await runDailyPracticeReminderWorkerOnce();

  timer =
    setInterval(
      () => {
        void runDailyPracticeReminderWorkerOnce()
          .catch(
            (error) => {
              console.error(
                "Daily reminder worker error:",
                error
              );
            }
          );
      },
      POLL_MS
    );

  console.log(
    `Daily Practice reminder worker started (${POLL_MS}ms) ✅`
  );
}

export function stopDailyPracticeReminderWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function waitForDailyPracticeReminderWorkerIdle(
  timeoutMs = 15_000
) {
  const deadline = Date.now() + timeoutMs;

  while (running && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return !running;
}
