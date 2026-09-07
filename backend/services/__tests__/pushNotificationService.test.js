import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mongodb
const mockToArray = vi.fn();
const mockProject = vi.fn().mockReturnValue({ toArray: mockToArray });
const mockFind = vi.fn().mockReturnValue({ project: mockProject });
const mockUpdateMany = vi.fn();
const mockUpdateOne = vi.fn();

const mockCollection = {
  find: mockFind,
  updateMany: mockUpdateMany,
  updateOne: mockUpdateOne,
};

vi.mock("../../config/mongodb.js", () => ({
  getPushDevicesCollection: () => mockCollection,
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
    expect(mockProject).toHaveBeenCalledWith({ fid: 1 });
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    expect(result).toEqual({
      totalDevices: 0,
      successCount: 0,
      failureCount: 0,
    });
  });

  it("filters duplicates and empty FIDs and sends to unique devices", async () => {
    mockToArray.mockResolvedValueOnce([
      { fid: "fid-1" },
      { fid: "fid-2" },
      { fid: "fid-1" }, // duplicate
      { fid: null },    // falsy
      { fid: "" },      // falsy
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
      data: { testId: 123, active: true },
    });

    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      fids: ["fid-1", "fid-2"],
      notification: {
        title: "New Mock Test 🔥",
        body: "SSC CGL Mock Test 12 is now available.",
      },
      data: {
        testId: "123",
        active: "true",
        route: "/mock-test",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "default_channel_id",
        },
      },
    });

    expect(result).toEqual({
      totalDevices: 2,
      successCount: 2,
      failureCount: 0,
      invalidDeviceCount: 0,
    });
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("batches into chunks of 500 when device count exceeds 500", async () => {
    const fakeDevices = Array.from({ length: 650 }, (_, i) => ({
      fid: `fid-${i + 1}`,
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
    });
  });

  it("detects invalid/unregistered registration tokens and updates DB to disable them", async () => {
    mockToArray.mockResolvedValueOnce([
      { fid: "valid-fid" },
      { fid: "unregistered-fid" },
      { fid: "invalid-fid" },
      { fid: "other-error-fid" },
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
    });
  });
});
