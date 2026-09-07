import { describe, it, expect } from "vitest";
import {
  isValidTimezone,
  computeNextDailyReminder,
  DEFAULT_DAILY_REMINDER_TIME,
} from "../dailyPracticeReminderService.js";

describe("dailyPracticeReminderService", () => {
  describe("isValidTimezone", () => {
    it("returns true for valid IANA zones", () => {
      expect(isValidTimezone("Asia/Kolkata")).toBe(true);
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
    });

    it("returns false for invalid zones or non-strings", () => {
      expect(isValidTimezone("Invalid/Zone")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(123)).toBe(false);
    });
  });

  describe("computeNextDailyReminder", () => {
    it("throws on invalid time format", () => {
      expect(() =>
        computeNextDailyReminder({
          time: "25:00",
          timezone: "Asia/Kolkata",
        })
      ).toThrow("Invalid reminder time");

      expect(() =>
        computeNextDailyReminder({
          time: "8:00",
          timezone: "Asia/Kolkata",
        })
      ).toThrow("Invalid reminder time");
    });

    it("throws on invalid timezone", () => {
      expect(() =>
        computeNextDailyReminder({
          time: "20:00",
          timezone: "Mars/Olympus",
        })
      ).toThrow("Invalid timezone");
    });

    it("schedules for today if target time has not arrived yet in the user local time", () => {
      // 2026-09-07 10:00 UTC = 15:30 IST
      const from = new Date("2026-09-07T10:00:00.000Z");

      // User wants 20:00 (8:00 PM) IST (in the future)
      const next = computeNextDailyReminder({
        time: "20:00",
        timezone: "Asia/Kolkata",
        from,
      });

      // 20:00 IST is 14:30 UTC on the same day
      expect(next.toISOString()).toBe("2026-09-07T14:30:00.000Z");
    });

    it("schedules for tomorrow if target time has already passed today in the user local time", () => {
      // 2026-09-07 16:00 UTC = 21:30 IST
      const from = new Date("2026-09-07T16:00:00.000Z");

      // User wants 20:00 (8:00 PM) IST (already passed today)
      const next = computeNextDailyReminder({
        time: "20:00",
        timezone: "Asia/Kolkata",
        from,
      });

      // Next occurrence should be tomorrow at 20:00 IST = 14:30 UTC on 2026-09-08
      expect(next.toISOString()).toBe("2026-09-08T14:30:00.000Z");
    });
  });
});
