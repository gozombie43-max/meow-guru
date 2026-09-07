import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  render,
  waitFor,
} from "@testing-library/react";
import PushOpenAnalyticsBridge from "../PushOpenAnalyticsBridge";
import * as AuthContextModule from "@/context/AuthContext";
import * as NotificationApiModule from "@/lib/api/notificationApi";

const user = {
  id: "user-1",
  name: "User",
  email: "user@example.com",
  role: "user",
  progress: {},
  bookmarks: [],
};

describe("PushOpenAnalyticsBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user,
      token: "token",
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
      loading: false,
    });
    vi.spyOn(
      NotificationApiModule,
      "trackNotificationEngagement"
    ).mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("reports queued push opens after auth and clears delivered events", async () => {
    localStorage.setItem(
      "meow_push_open_queue",
      JSON.stringify([{ notificationId: "68c123", route: "/mock-test" }])
    );

    render(<PushOpenAnalyticsBridge />);

    await waitFor(() => {
      expect(
        NotificationApiModule.trackNotificationEngagement
      ).toHaveBeenCalledWith("68c123", "opened", "push");
    });
    expect(localStorage.getItem("meow_push_open_queue")).toBeNull();
  });

  it("keeps queued opens when a retryable request fails", async () => {
    vi.spyOn(
      NotificationApiModule,
      "trackNotificationEngagement"
    ).mockRejectedValueOnce(new Error("Network unavailable"));
    localStorage.setItem(
      "meow_push_open_queue",
      JSON.stringify([{ notificationId: "68c123" }])
    );

    render(<PushOpenAnalyticsBridge />);

    await waitFor(() => {
      expect(
        NotificationApiModule.trackNotificationEngagement
      ).toHaveBeenCalledWith("68c123", "opened", "push");
    });
    expect(localStorage.getItem("meow_push_open_queue")).toContain("68c123");
  });

  it("records a native action as both a push open and an action click", async () => {
    localStorage.setItem(
      "meow_push_open_queue",
      JSON.stringify([
        {
          notificationId: "68c123",
          event: "action_clicked",
        },
      ])
    );

    render(<PushOpenAnalyticsBridge />);

    await waitFor(() => {
      expect(
        NotificationApiModule.trackNotificationEngagement
      ).toHaveBeenNthCalledWith(1, "68c123", "opened", "push");
      expect(
        NotificationApiModule.trackNotificationEngagement
      ).toHaveBeenNthCalledWith(2, "68c123", "action_clicked", "push");
    });
  });
});
