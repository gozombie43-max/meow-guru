import {
  DateTime,
  IANAZone,
} from "luxon";

export const DEFAULT_DAILY_REMINDER_TIME =
  "20:00";

export function isValidTimezone(
  timezone
) {
  return (
    typeof timezone === "string" &&
    IANAZone.isValidZone(timezone)
  );
}

export function computeNextDailyReminder({
  time,
  timezone,
  from = new Date(),
}) {
  if (
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
      time
    )
  ) {
    throw new Error(
      "Invalid reminder time"
    );
  }

  if (
    !isValidTimezone(
      timezone
    )
  ) {
    throw new Error(
      "Invalid timezone"
    );
  }

  const [
    hour,
    minute,
  ] =
    time
      .split(":")
      .map(Number);

  const localNow =
    DateTime
      .fromJSDate(
        from,
        {
          zone: "utc",
        }
      )
      .setZone(
        timezone
      );

  let next =
    localNow.set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

  if (
    next.toMillis() <=
    localNow.toMillis()
  ) {
    next =
      next.plus({
        days: 1,
      });
  }

  return next
    .toUTC()
    .toJSDate();
}
