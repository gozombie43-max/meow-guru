import { describe, expect, it } from "vitest";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Flame,
  Megaphone,
  Swords,
  Trophy,
} from "lucide-react";
import {
  getNotificationPresentation,
  getSafeNotificationRoute,
} from "../notificationPresentation";

describe("getNotificationPresentation", () => {
  it("maps battle invites and rematches to Join Battle with Swords icon", () => {
    const invite = getNotificationPresentation("battle_invite");
    expect(invite.label).toBe("Join Battle");
    expect(invite.Icon).toBe(Swords);

    const rematch = getNotificationPresentation("battle_rematch");
    expect(rematch.label).toBe("Join Battle");
    expect(rematch.Icon).toBe(Swords);
  });

  it("maps battle result to View Battle with Trophy icon", () => {
    const result = getNotificationPresentation("battle_result");
    expect(result.label).toBe("View Battle");
    expect(result.Icon).toBe(Trophy);
  });

  it("maps daily practice to Start Practice with Flame icon", () => {
    const practice = getNotificationPresentation("daily_practice");
    expect(practice.label).toBe("Start Practice");
    expect(practice.Icon).toBe(Flame);
  });

  it("maps streak protection to Continue Practice with Flame icon", () => {
    const streak = getNotificationPresentation("streak_protection");
    expect(streak.label).toBe("Continue Practice");
    expect(streak.Icon).toBe(Flame);
  });

  it("maps new mock test to Open Mock with ClipboardList icon", () => {
    const mock = getNotificationPresentation("new_mock");
    expect(mock.label).toBe("Open Mock");
    expect(mock.Icon).toBe(ClipboardList);
  });

  it("maps exam update to View Update with CalendarDays icon", () => {
    const exam = getNotificationPresentation("exam_update");
    expect(exam.label).toBe("View Update");
    expect(exam.Icon).toBe(CalendarDays);
  });

  it("maps announcements category to Open with Megaphone icon", () => {
    const announcement = getNotificationPresentation(undefined, "announcements");
    expect(announcement.label).toBe("Open");
    expect(announcement.Icon).toBe(Megaphone);
  });

  it("falls back to View with Bell icon for unknown types and categories", () => {
    const generic = getNotificationPresentation();
    expect(generic.label).toBe("View");
    expect(generic.Icon).toBe(Bell);

    const otherCategory = getNotificationPresentation("unknown_type", "general");
    expect(otherCategory.label).toBe("View");
    expect(otherCategory.Icon).toBe(Bell);
  });
});

describe("getSafeNotificationRoute", () => {
  it("returns null for non-string or falsy values", () => {
    expect(getSafeNotificationRoute(undefined)).toBeNull();
    expect(getSafeNotificationRoute(null as unknown as string)).toBeNull();
    expect(getSafeNotificationRoute("")).toBeNull();
    expect(getSafeNotificationRoute("   ")).toBeNull();
    expect(getSafeNotificationRoute(123 as unknown as string)).toBeNull();
  });

  it("rejects absolute and external URLs", () => {
    expect(getSafeNotificationRoute("https://phishing.example.com")).toBeNull();
    expect(getSafeNotificationRoute("http://localhost:3000")).toBeNull();
    expect(getSafeNotificationRoute("javascript:alert(1)")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeNotificationRoute("//malicious.com/attack")).toBeNull();
    expect(getSafeNotificationRoute("   //evil.org   ")).toBeNull();
  });

  it("accepts and trims valid relative internal routes", () => {
    expect(getSafeNotificationRoute("/battle?join=4821")).toBe("/battle?join=4821");
    expect(getSafeNotificationRoute("/mock-test/ssc-cgl/cgl-mock-14")).toBe(
      "/mock-test/ssc-cgl/cgl-mock-14"
    );
    expect(getSafeNotificationRoute("/exam-updates/ssc-cgl")).toBe("/exam-updates/ssc-cgl");
    expect(getSafeNotificationRoute("/")).toBe("/");
    expect(getSafeNotificationRoute("  /notifications  ")).toBe("/notifications");
  });
});
