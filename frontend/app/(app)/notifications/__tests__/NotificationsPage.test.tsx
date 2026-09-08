// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import NotificationsPage from "../page";
import * as NotificationApiModule from "@/lib/api/notificationApi";
import * as NotificationCenterContextModule from "@/context/NotificationCenterContext";

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

  it("removes notification alert from avatar icon upon visiting /notifications", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      expect(mockClearUnread).toHaveBeenCalled();
      expect(NotificationApiModule.markAllNotificationsRead).toHaveBeenCalled();
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
});
