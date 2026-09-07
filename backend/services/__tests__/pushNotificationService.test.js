import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mongodb
const mockToArray = vi.fn();
const mockProject = vi.fn().mockReturnValue({ toArray: mockToArray });
const mockFind = vi.fn().mockReturnValue({ project: mockProject });
const mockUpdateMany = vi.fn();
const mockUpdateOne = vi.fn();
const mockFeedUpdateOne = vi.fn();

const mockUsersToArray = vi.fn();
const mockUsersFind = vi.fn().mockReturnValue({ toArray: mockUsersToArray });

const mockCollection = {
  find: mockFind,
  updateMany: mockUpdateMany,
  updateOne: mockUpdateOne,
};

vi.mock("../../config/mongodb.js", () => ({
  getPushDevicesCollection: () => mockCollection,
  getUsersCollection: () => ({
    find: mockUsersFind,
  }),
  getNotificationFeedCollection: () => ({
    insertOne: vi.fn().mockResolvedValue({ insertedId: "feed_1" }),
    updateOne: mockFeedUpdateOne,
  }),
}));

// Mock firebase
const mockSendEachForMulticast = vi.fn();

vi.mock("../../config/firebase.js", () => ({
  firebaseMessaging: {
    sendEachForMulticast: (...args) => mockSendEachForMulticast(...args),
  },
}));

import { sendPushToAllUsers } from "../pushNotificationService.js";

describe("pushNotificationService - sendPushToAllUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockUsersFind.mockImplementation((query) => ({
      toArray: async () => {
        const ids = query?.id?.$in || [];
        return ids.map((id) => ({
          id,
          notificationPreferences: { enabled: true, announcements: true },
        }));
      },
    }));
  });

  it("returns zero counts and skips FCM when no enabled android devices are found", async () => {
    mockToArray.mockResolvedValueOnce([]);

    const result = await sendPushToAllUsers({
      title: "Test Title",
      body: "Test Body",
      route: "/test",
    });

    expect(mockFind).toHaveBeenCalledWith({
      enabled: true,
      platform: "android",
    });
    expect(mockProject).toHaveBeenCalledWith({ fid: 1, userId: 1 });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalDevices: 0,
      successCount: 0,
      failureCount: 0,
      notificationId: "feed_1",
    });
  });

  it("filters duplicates and empty FIDs and sends to unique devices", async () => {
    mockToArray.mockResolvedValueOnce([
      { fid: "fid-1", userId: "u1" },
      { fid: "fid-2", userId: "u2" },
      { fid: "fid-1", userId: "u1" }, // duplicate
      { fid: null, userId: "u3" },    // falsy
      { fid: "", userId: "u4" },      // falsy
    ]);

    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 2,
      failureCount: 0,
      responses: [
        { success: true },
        { success: true },
      ],
    });

    const result = await sendPushToAllUsers({
      title: "New Mock Test 🔥",
      body: "SSC CGL Mock Test 12 is now available.",
      route: "/mock-test",
      data: { type: "new_mock", testId: 123, active: true },
    });

    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      fids: ["fid-1", "fid-2"],
      data: {
        type: "new_mock",
        testId: "123",
        active: "true",
        route: "/mock-test",
        actionLabel: "Open Mock",
        notificationId: "feed_1",
        title: "New Mock Test 🔥",
        body: "SSC CGL Mock Test 12 is now available.",
      },
      android: {
        priority: "high",
      },
    });

    expect(result).toEqual({
      totalDevices: 2,
      successCount: 2,
      failureCount: 0,
      invalidDeviceCount: 0,
      notificationId: "feed_1",
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockFeedUpdateOne).toHaveBeenCalledWith(
      { _id: "feed_1" },
      {
        $set: {
          pushMetrics: {
            targetDevices: 2,
            acceptedCount: 2,
            failureCount: 0,
            invalidDeviceCount: 0,
            processedAt: expect.any(Date),
          },
        },
      }
    );
  });

  it("batches into chunks of 500 when device count exceeds 500", async () => {
    const fakeDevices = Array.from({ length: 650 }, (_, i) => ({
      fid: `fid-${i + 1}`,
      userId: `user-${i + 1}`,
    }));
    mockToArray.mockResolvedValueOnce(fakeDevices);

    mockSendEachForMulticast
      .mockResolvedValueOnce({
        successCount: 500,
        failureCount: 0,
        responses: Array.from({ length: 500 }, () => ({ success: true })),
      })
      .mockResolvedValueOnce({
        successCount: 150,
        failureCount: 0,
        responses: Array.from({ length: 150 }, () => ({ success: true })),
      });

    const result = await sendPushToAllUsers({
      title: "Batch Notification",
      body: "Message for all devices",
    });

    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(mockSendEachForMulticast.mock.calls[0][0].fids).toHaveLength(500);
    expect(mockSendEachForMulticast.mock.calls[1][0].fids).toHaveLength(150);

    expect(result).toEqual({
      totalDevices: 650,
      successCount: 650,
      failureCount: 0,
      invalidDeviceCount: 0,
      notificationId: "feed_1",
    });
  });

  it("detects invalid/unregistered registration tokens and updates DB to disable them", async () => {
    mockToArray.mockResolvedValueOnce([
      { fid: "valid-fid", userId: "u1" },
      { fid: "unregistered-fid", userId: "u2" },
      { fid: "invalid-fid", userId: "u3" },
      { fid: "other-error-fid", userId: "u4" },
    ]);

    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 3,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: "messaging/registration-token-not-registered" },
        },
        {
          success: false,
          error: { code: "messaging/invalid-registration-token" },
        },
        {
          success: false,
          error: { code: "messaging/server-unavailable" },
        },
      ],
    });

    mockUpdateMany.mockResolvedValueOnce({ modifiedCount: 2 });

    const result = await sendPushToAllUsers({
      title: "Check invalid tokens",
      body: "Testing token cleanup",
      route: "/notifications",
    });

    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      {
        fid: {
          $in: ["unregistered-fid", "invalid-fid"],
        },
      },
      {
        $set: {
          enabled: false,
          disabledAt: expect.any(Date),
        },
      }
    );

    expect(result).toEqual({
      totalDevices: 4,
      successCount: 1,
      failureCount: 3,
      invalidDeviceCount: 2,
      notificationId: "feed_1",
    });
  });
});
