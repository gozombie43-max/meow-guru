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

const POLL_MS =
  Number(
    process.env
      .STREAK_PROTECTION_WORKER_POLL_MS
  ) || 60_000;

const BATCH_SIZE = 50;

const RECENT_ACTIVITY_MS =
  90 * 60 * 1000;

const RECENT_DAILY_REMINDER_MS =
  2 * 60 * 60 * 1000;

let timer = null;
let running = false;

export function buildMessage(
  progress
) {
  if (
    progress.remainingMinutes <= 5
  ) {
    return (
      `Only ${progress.remainingMinutes} min left ` +
      `to protect your ${progress.streak}-day streak 🔥`
    );
  }

  return (
    `Your ${progress.streak}-day streak is at risk. ` +
    `${progress.remainingMinutes} min of practice left today.`
  );
}

async function processUser(
  user,
  now
) {
  const reminder =
    user.dailyPracticeReminder;

  if (
    !reminder
      ?.streakProtectionEnabled ||
    !reminder
      ?.nextStreakProtectionAt ||
    !reminder
      ?.timezone
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

  const nextAt =
    computeNextDailyReminder({
      time:
        reminder
          .streakProtectionTime ||
        "21:30",

      timezone:
        reminder.timezone,

      from:
        now,
    });

  const users =
    getUsersCollection();

  /*
   * Atomic claim:
   * immediately move this job to
   * tomorrow so multiple Azure
   * instances cannot send duplicates.
   */
  const claim =
    await users.updateOne(
      {
        id:
          user.id,

        "dailyPracticeReminder.streakProtectionEnabled":
          true,

        "dailyPracticeReminder.nextStreakProtectionAt":
          reminder
            .nextStreakProtectionAt,
      },
      {
        $set: {
          "dailyPracticeReminder.nextStreakProtectionAt":
            nextAt,

          "dailyPracticeReminder.lastStreakProtectionAttemptAt":
            now,

          "dailyPracticeReminder.lastStreakProtectionDateKey":
            progress.dateKey,
        },
      }
    );

  if (
    claim.modifiedCount !== 1
  ) {
    return;
  }

  // ── Goal already completed ──

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
          "dailyPracticeReminder.lastStreakProtectionResult":
            "goal-completed",
        },
      }
    );

    return;
  }

  // ── No meaningful streak yet ──

  if (
    progress.streak < 2
  ) {
    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastStreakProtectionResult":
            "no-active-streak",
        },
      }
    );

    return;
  }

  // ── User was recently studying ──

  const lastActivity =
    progress.lastActivityAt
      ? new Date(
          progress.lastActivityAt
        )
      : null;

  if (
    lastActivity &&
    now.getTime() -
      lastActivity.getTime() <
      RECENT_ACTIVITY_MS
  ) {
    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastStreakProtectionResult":
            "recently-active",
        },
      }
    );

    return;
  }

  // ── Don't nag immediately after daily reminder ──

  const lastDailyReminder =
    reminder.lastSentAt
      ? new Date(
          reminder.lastSentAt
        )
      : null;

  if (
    lastDailyReminder &&
    now.getTime() -
      lastDailyReminder.getTime() <
      RECENT_DAILY_REMINDER_MS
  ) {
    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastStreakProtectionResult":
            "recent-daily-reminder",
        },
      }
    );

    return;
  }

  try {
    const result =
      await sendPushToUser(
        user.id,
        {
          title:
            "Streak Protection 🔥",

          body:
            buildMessage(
              progress
            ),

          route:
            "/",

          category:
            "dailyPractice",

          data: {
            type:
              "streak_protection",

            streak:
              progress.streak,

            remainingMinutes:
              progress
                .remainingMinutes,
          },

          centerKey:
            `streak-protection:${user.id}:${progress.dateKey}`,
        }
      );

    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastStreakProtectionResult":
            result.suppressed
              ? "suppressed"
              : result.successCount > 0
                ? "sent"
                : "no-device",

          "dailyPracticeReminder.lastStreakProtectionSentAt":
            result.successCount > 0
              ? now
              : null,
        },
      }
    );

  } catch (error) {
    console.error(
      `Streak protection failed for ${user.id}:`,
      error
    );

    await users.updateOne(
      {
        id:
          user.id,
      },
      {
        $set: {
          "dailyPracticeReminder.lastStreakProtectionResult":
            "failed",

          "dailyPracticeReminder.lastStreakProtectionError":
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

export async function runStreakProtectionWorkerOnce() {
  if (running) {
    return;
  }

  running = true;

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

            "dailyPracticeReminder.streakProtectionEnabled":
              true,

            "dailyPracticeReminder.nextStreakProtectionAt":
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
              dailyPracticeReminder: 1,
            },
          }
        )
        .sort({
          "dailyPracticeReminder.nextStreakProtectionAt":
            1,
        })
        .limit(
          BATCH_SIZE
        )
        .toArray();

    await Promise.allSettled(
      dueUsers.map(
        (user) =>
          processUser(
            user,
            now
          )
      )
    );

  } finally {
    running = false;
  }
}

export async function startStreakProtectionWorker() {
  if (timer) {
    return;
  }

  await runStreakProtectionWorkerOnce();

  timer =
    setInterval(
      () => {
        void runStreakProtectionWorkerOnce()
          .catch(
            (error) => {
              console.error(
                "Streak protection worker:",
                error
              );
            }
          );
      },

      POLL_MS
    );

  console.log(
    `Streak Protection worker started (${POLL_MS}ms) ✅`
  );
}

export function stopStreakProtectionWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
