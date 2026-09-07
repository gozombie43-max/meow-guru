import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mocks
const mockSendPushToAllUsers = vi.fn();
vi.mock("../pushNotificationService.js", () => ({
  sendPushToAllUsers: (...args) => mockSendPushToAllUsers(...args),
}));

const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 0 });
const mockFindOneAndUpdate = vi.fn().mockResolvedValue(null);
const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
const mockHistoryInsertOne = vi.fn().mockResolvedValue({ acknowledged: true });

vi.mock("../../config/mongodb.js", () => ({
  getScheduledNotificationsCollection: () => ({
    updateMany: mockUpdateMany,
    findOneAndUpdate: mockFindOneAndUpdate,
    updateOne: mockUpdateOne,
  }),
  getNotificationHistoryCollection: () => ({
    insertOne: mockHistoryInsertOne,
  }),
}));

import {
  runScheduledNotificationWorkerOnce,
  startScheduledNotificationWorker,
  stopScheduledNotificationWorker,
} from "../scheduledNotificationWorker.js";

describe("Scheduled Notification Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopScheduledNotificationWorker();
  });

  afterEach(() => {
    stopScheduledNotificationWorker();
  });

  it("does nothing if no jobs are due", async () => {
    mockFindOneAndUpdate.mockResolvedValueOnce(null);

    await runScheduledNotificationWorkerOnce();

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        sendAt: { $lte: expect.any(Date) },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "processing",
        }),
        $inc: { attempts: 1 },
      }),
      expect.objectContaining({
        sort: { sendAt: 1 },
        returnDocument: "after",
      })
    );
    expect(mockSendPushToAllUsers).not.toHaveBeenCalled();
  });

  it("claims and processes a due scheduled job successfully", async () => {
    const mockJob = {
      _id: "sched-job-1",
      title: "Daily Practice 🔥",
      body: "Your SSC practice set is ready.",
      route: "/practice",
      sendAt: new Date(Date.now() - 5000),
      createdByUserId: "admin-1",
      createdByEmail: "admin@test.com",
    };

    // First claim returns the job, second returns null (no more jobs)
    mockFindOneAndUpdate
      .mockResolvedValueOnce(mockJob)
      .mockResolvedValueOnce(null);

    mockSendPushToAllUsers.mockResolvedValueOnce({
      totalDevices: 50,
      successCount: 48,
      failureCount: 2,
      invalidDeviceCount: 1,
    });

    await runScheduledNotificationWorkerOnce();

    expect(mockSendPushToAllUsers).toHaveBeenCalledWith({
      title: "Daily Practice 🔥",
      body: "Your SSC practice set is ready.",
      route: "/practice",
      data: {
        notificationType: "scheduled",
        scheduledNotificationId: "sched-job-1",
      },
    });

    // Verify job is marked as "sent"
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "sched-job-1",
        status: "processing",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "sent",
          totalDevices: 50,
          successCount: 48,
          failureCount: 2,
          invalidDeviceCount: 1,
          sentAt: expect.any(Date),
        }),
      })
    );

    // Verify history record is inserted
    expect(mockHistoryInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "scheduled-broadcast",
        scheduledNotificationId: "sched-job-1",
        title: "Daily Practice 🔥",
        body: "Your SSC practice set is ready.",
        route: "/practice",
        totalDevices: 50,
        successCount: 48,
        failureCount: 2,
        invalidDeviceCount: 1,
        sentByUserId: "admin-1",
        sentByEmail: "admin@test.com",
      })
    );
  });

  it("handles push failure and marks job as failed", async () => {
    const mockJob = {
      _id: "sched-job-fail",
      title: "Failing Push",
      body: "Failure test message",
      route: "/",
      sendAt: new Date(Date.now() - 10000),
      createdByUserId: "admin-1",
    };

    mockFindOneAndUpdate
      .mockResolvedValueOnce(mockJob)
      .mockResolvedValueOnce(null);

    mockSendPushToAllUsers.mockRejectedValueOnce(
      new Error("FCM server unreachable")
    );

    await runScheduledNotificationWorkerOnce();

    expect(mockSendPushToAllUsers).toHaveBeenCalled();

    // Verify job is marked as "failed"
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "sched-job-fail",
        status: "processing",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "failed",
          error: "FCM server unreachable",
          failedAt: expect.any(Date),
        }),
      })
    );

    // History should not be written when push fails
    expect(mockHistoryInsertOne).not.toHaveBeenCalled();
  });

  it("marks stale processing jobs as failed when starting worker", async () => {
    await startScheduledNotificationWorker();

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        processingAt: { $lt: expect.any(Date) },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "failed",
          error: "Worker stopped while processing. Manual retry required.",
        }),
      })
    );

    stopScheduledNotificationWorker();
  });
});
