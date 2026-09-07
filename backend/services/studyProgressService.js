import {
  DateTime,
} from "luxon";

import {
  getStudyActivityDailyCollection,
} from "../config/mongodb.js";

export async function getStudyProgress({
  userId,
  timezone,
  goalMinutes,
  now = new Date(),
}) {
  const collection =
    getStudyActivityDailyCollection();

  const localToday =
    DateTime
      .fromJSDate(
        now
      )
      .setZone(
        timezone
      )
      .startOf("day");

  const todayKey =
    localToday.toISODate();

  const today =
    await collection.findOne({
      userId,
      dateKey:
        todayKey,
    });

  const activeSeconds =
    today?.activeSeconds ??
    0;

  const goalSeconds =
    goalMinutes * 60;

  const goalComplete =
    activeSeconds >=
    goalSeconds;

  const completedDays =
    await collection
      .find(
        {
          userId,

          activeSeconds: {
            $gte:
              goalSeconds,
          },

          dateKey: {
            $lte:
              todayKey,
          },
        },
        {
          projection: {
            dateKey: 1,
          },
        }
      )
      .sort({
        dateKey: -1,
      })
      .limit(90)
      .toArray();

  const completedSet =
    new Set(
      completedDays.map(
        (item) =>
          item.dateKey
      )
    );

  /*
   * If today's goal isn't complete,
   * calculate streak through yesterday.
   */
  let cursor =
    goalComplete
      ? localToday
      : localToday.minus({
          days: 1,
        });

  let streak = 0;

  while (
    completedSet.has(
      cursor.toISODate()
    )
  ) {
    streak++;

    cursor =
      cursor.minus({
        days: 1,
      });
  }

  return {
    dateKey:
      todayKey,

    activeSeconds,

    goalSeconds,

    goalComplete,

    streak,

    completedMinutes:
      Math.floor(
        activeSeconds /
          60
      ),

    remainingMinutes:
      Math.max(
        0,
        Math.ceil(
          (
            goalSeconds -
            activeSeconds
          ) /
            60
        )
      ),

    lastActivityAt:
      today?.updatedAt ??
      null,
  };
}
