// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import NotificationsPage from "../page";
import * as NotificationApiModule from "@/lib/api/notificationApi";
import * as NotificationCenterContextModule from "@/context/NotificationCenterContext";

const authState = vi.hoisted(() => ({
  user: { id: "user-1", name: "Student" } as { id: string; name: string } | null,
  token: "test-token" as string | null,
  loading: false,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("NotificationsPage", () => {
  const mockDecrementUnread = vi.fn();
  const mockClearUnread = vi.fn();
  const mockRefreshUnreadCount = vi.fn();

  const mockNotifications: NotificationApiModule.UserNotification[] = [
    {
      _id: "notif-1",
      audience: "user",
      userId: "user-1",
      type: "battle_invite",
      category: "battleInvites",
      title: "Rahul challenged you",
      body: "Join the Mathematics battle now.",
      route: "/battle?join=4821",
      createdAt: "2026-09-07T12:00:00.000Z",
      expiresAt: "2026-10-07T12:00:00.000Z",
      read: false,
    },
    {
      _id: "notif-2",
      audience: "all",
      type: "new_mock",
      category: "newMocks",
      title: "New Mock Test 🎯",
      body: "SSC CGL Full Mock Test 14 is available.",
      route: "/mock-test/ssc-cgl/cgl-mock-14",
      createdAt: "2026-09-07T11:30:00.000Z",
      expiresAt: "2026-10-07T11:30:00.000Z",
      read: false,
    },
    {
      _id: "notif-3",
      audience: "all",
      type: "announcement",
      category: "announcements",
      title: "System Update",
      body: "Maintenance scheduled tonight.",
      route: undefined,
      createdAt: "2026-09-07T10:00:00.000Z",
      expiresAt: "2026-10-07T10:00:00.000Z",
      read: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "user-1", name: "Student" };
    authState.token = "test-token";
    authState.loading = false;

    vi.spyOn(NotificationCenterContextModule, "useNotificationCenter").mockReturnValue({
      unreadCount: 2,
      decrementUnread: mockDecrementUnread,
      clearUnread: mockClearUnread,
      refreshUnreadCount: mockRefreshUnreadCount,
    });

    vi.spyOn(NotificationApiModule, "fetchNotifications").mockResolvedValue({
      items: mockNotifications,
      total: 3,
      unreadCount: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    vi.spyOn(NotificationApiModule, "markNotificationRead").mockResolvedValue();

    vi.spyOn(NotificationApiModule, "markAllNotificationsRead").mockResolvedValue();

    vi.spyOn(NotificationApiModule, "trackNotificationEngagement").mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders contextual CTA buttons based on notification type", async () => {
    render(<NotificationsPage />);

    expect(await screen.findByText("Rahul challenged you")).toBeInTheDocument();
    expect(screen.getByText("New Mock Test 🎯")).toBeInTheDocument();
    expect(screen.getByText("System Update")).toBeInTheDocument();

    // Contextual button for battle_invite is "Join Battle"
    expect(screen.getByRole("button", { name: "Join Battle" })).toBeInTheDocument();

    // Contextual button for new_mock is "Open Mock"
    expect(screen.getByRole("button", { name: "Open Mock" })).toBeInTheDocument();

    // Announcement without a route does not render a CTA button
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
  });

  it("navigates to safe route, marks notification as read, and decrements unread when CTA is tapped", async () => {
    render(<NotificationsPage />);

    const joinBattleBtn = await screen.findByRole("button", { name: "Join Battle" });
    fireEvent.click(joinBattleBtn);

    await waitFor(() => {
      expect(NotificationApiModule.trackNotificationEngagement).toHaveBeenCalledWith(
        "notif-1",
        "action_clicked",
        "in_app"
      );
      expect(NotificationApiModule.markNotificationRead).toHaveBeenCalledWith("notif-1");
      expect(mockDecrementUnread).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/battle?join=4821");
    });
  });

  it("tracks opened event when the notification card is tapped", async () => {
    render(<NotificationsPage />);

    const cardTitle = await screen.findByText("System Update");
    fireEvent.click(cardTitle);

    expect(NotificationApiModule.trackNotificationEngagement).toHaveBeenCalledWith(
      "notif-3",
      "opened",
      "in_app"
    );
  });

  it("marks all notifications as read when Read all is clicked", async () => {
    render(<NotificationsPage />);

    const readAllBtn = await screen.findByRole("button", { name: /read all/i });
    fireEvent.click(readAllBtn);

    await waitFor(() => {
      expect(NotificationApiModule.markAllNotificationsRead).toHaveBeenCalled();
      expect(mockClearUnread).toHaveBeenCalled();
      expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    });
  });

  it("renders empty state when there are no notifications", async () => {
    vi.spyOn(NotificationApiModule, "fetchNotifications").mockResolvedValueOnce({
      items: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    render(<NotificationsPage />);

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it("does not automatically mark all notifications as read upon visiting /notifications", async () => {
    render(<NotificationsPage />);

    expect(await screen.findByText("Rahul challenged you")).toBeInTheDocument();
    expect(mockClearUnread).not.toHaveBeenCalled();
    expect(NotificationApiModule.markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it("prevents duplicate mark-all-read requests on rapid double-click and surfaces errors", async () => {
    let resolveMarkAll!: () => void;
    const pendingMarkAll = new Promise<void>((resolve) => {
      resolveMarkAll = resolve;
    });
    vi.spyOn(NotificationApiModule, "markAllNotificationsRead")
      .mockReturnValueOnce(pendingMarkAll)
      .mockRejectedValueOnce(new Error("Server error"));

    render(<NotificationsPage />);

    const readAllBtn = await screen.findByRole("button", { name: /read all/i });
    fireEvent.click(readAllBtn);
    fireEvent.click(readAllBtn);

    expect(NotificationApiModule.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    resolveMarkAll();

    await waitFor(() => {
      expect(mockClearUnread).toHaveBeenCalledTimes(1);
      expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    });
  });

  it("filters notifications by category tab", async () => {
    render(<NotificationsPage />);

    expect(await screen.findByText("Rahul challenged you")).toBeInTheDocument();
    expect(screen.getByText("New Mock Test 🎯")).toBeInTheDocument();

    const mockTab = screen.getByRole("tab", { name: /mocks/i });
    fireEvent.click(mockTab);

    expect(screen.getByText("New Mock Test 🎯")).toBeInTheDocument();
    expect(screen.queryByText("Rahul challenged you")).not.toBeInTheDocument();
  });

  it("does not fetch notifications while auth is loading or user is signed out", () => {
    authState.loading = true;
    const { rerender } = render(<NotificationsPage />);
    expect(NotificationApiModule.fetchNotifications).not.toHaveBeenCalled();

    authState.loading = false;
    authState.user = null;
    authState.token = null;
    rerender(<NotificationsPage />);
    expect(NotificationApiModule.fetchNotifications).not.toHaveBeenCalled();
  });
});
