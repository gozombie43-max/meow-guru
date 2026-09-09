vi.mock('../../auth/sessions.js', () => ({ assertSession: async decoded => decoded }));
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import { signToken } from "../../auth/jwt.js";

// Mock pushNotificationService
const mockSendPushToAllUsers = vi.fn();
vi.mock("../../services/pushNotificationService.js", () => ({
  sendPushToAllUsers: (...args) => mockSendPushToAllUsers(...args),
}));

// Mock MongoDB collections
const mockUpdateOne = vi.fn();
const mockInsertOne = vi.fn().mockResolvedValue({ acknowledged: true });
const mockScheduleInsertOne = vi.fn().mockResolvedValue({ insertedId: "sched_123" });
const mockFindToArray = vi.fn().mockResolvedValue([]);
const mockCountDocuments = vi.fn().mockResolvedValue(0);

const mockFindCursor = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: (...args) => mockFindToArray(...args),
};

const mockScheduleFindCursor = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: vi.fn().mockResolvedValue([]),
};
const mockScheduleCountDocuments = vi.fn().mockResolvedValue(0);
const mockScheduleFindOne = vi.fn().mockResolvedValue(null);
const mockScheduleFindOneAndUpdate = vi.fn().mockResolvedValue(null);
const mockScheduleUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });

// Notification Center mocks
const mockFeedToArray = vi.fn().mockResolvedValue([]);
const mockFeedCountDocuments = vi.fn().mockResolvedValue(0);
const mockFeedFindOne = vi.fn().mockResolvedValue(null);
const mockFeedAggregateToArray = vi.fn().mockResolvedValue([]);

const mockFeedFindCursor = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: (...args) => mockFeedToArray(...args),
};

const mockReceiptsFindToArray = vi.fn().mockResolvedValue([]);
const mockReceiptsUpdateOne = vi.fn().mockResolvedValue({ acknowledged: true });
const mockReceiptsFindCursor = {
  toArray: (...args) => mockReceiptsFindToArray(...args),
};

const mockUsersFindOne = vi.fn().mockResolvedValue(null);
const mockUsersUpdateOne = vi.fn().mockResolvedValue({ acknowledged: true });

vi.mock("../../config/mongodb.js", () => ({
  getPushDevicesCollection: () => ({
    updateOne: mockUpdateOne,
  }),
  getNotificationHistoryCollection: () => ({
    insertOne: mockInsertOne,
    find: vi.fn(() => mockFindCursor),
    countDocuments: mockCountDocuments,
  }),
  getScheduledNotificationsCollection: () => ({
    insertOne: mockScheduleInsertOne,
    find: vi.fn(() => mockScheduleFindCursor),
    countDocuments: (...args) => mockScheduleCountDocuments(...args),
    findOne: (...args) => mockScheduleFindOne(...args),
    findOneAndUpdate: (...args) => mockScheduleFindOneAndUpdate(...args),
    updateOne: (...args) => mockScheduleUpdateOne(...args),
  }),
  getNotificationFeedCollection: () => ({
    find: vi.fn(() => mockFeedFindCursor),
    countDocuments: (...args) => mockFeedCountDocuments(...args),
    findOne: (...args) => mockFeedFindOne(...args),
    aggregate: vi.fn(() => ({
      toArray: (...args) => mockFeedAggregateToArray(...args),
    })),
  }),
  getNotificationReceiptsCollection: () => ({
    find: vi.fn(() => mockReceiptsFindCursor),
    updateOne: (...args) => mockReceiptsUpdateOne(...args),
  }),
  getUsersCollection: () => ({
    findOne: (...args) => mockUsersFindOne(...args),
    updateOne: (...args) => mockUsersUpdateOne(...args),
  }),
}));

import notificationRouter from "../notifications.routes.js";

describe("Notifications Routes - POST /api/notifications/broadcast", () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("returns 401 when no token is provided", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test",
        body: "Message",
      }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("No token provided");
  });

  it("returns 403 when a non-admin user accesses the endpoint", async () => {
    const userToken = signToken({ id: "user_123", email: "user@example.com", role: "user" });

    const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: "Test",
        body: "Message",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Insufficient permissions");
  });

  it("returns 400 when body payload fails validation (missing title)", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@example.com", role: "admin" });

    const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        body: "Valid body text but missing title",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid notification");
  });

  it("successfully broadcasts when authenticated as admin", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@example.com", role: "admin" });

    mockSendPushToAllUsers.mockResolvedValueOnce({
      totalDevices: 820,
      successCount: 812,
      failureCount: 8,
      invalidDeviceCount: 5,
    });

    const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "New Mock Test 🔥",
        body: "SSC CGL Mock Test 12 is now available.",
        route: "/mock-test",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      totalDevices: 820,
      successCount: 812,
      failureCount: 8,
      invalidDeviceCount: 5,
    });

    expect(mockSendPushToAllUsers).toHaveBeenCalledWith({
      title: "New Mock Test 🔥",
      body: "SSC CGL Mock Test 12 is now available.",
      route: "/mock-test",
      data: {},
    });

    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        title: "New Mock Test 🔥",
        body: "SSC CGL Mock Test 12 is now available.",
        route: "/mock-test",
        totalDevices: 820,
        successCount: 812,
        failureCount: 8,
        invalidDeviceCount: 5,
        sentByUserId: "admin_1",
        sentByEmail: "admin@example.com",
        createdAt: expect.any(Date),
      })
    );
  });

  it("successfully broadcasts when authenticated as superadmin", async () => {
    const superadminToken = signToken({
      id: "super_1",
      email: "super@example.com",
      role: "superadmin",
    });

    mockSendPushToAllUsers.mockResolvedValueOnce({
      totalDevices: 10,
      successCount: 10,
      failureCount: 0,
      invalidDeviceCount: 0,
    });

    const res = await fetch(`${baseUrl}/api/notifications/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superadminToken}`,
      },
      body: JSON.stringify({
        title: "System Update",
        body: "New features have been deployed.",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalDevices).toBe(10);
    expect(mockSendPushToAllUsers).toHaveBeenCalledWith({
      title: "System Update",
      body: "New features have been deployed.",
      route: "/",
      data: {},
    });
  });
});

describe("Notifications Routes - GET /api/notifications/history", () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("returns 401 when no token is provided", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/history`);
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin accesses history", async () => {
    const userToken = signToken({ id: "user_1", email: "u@test.com", role: "user" });
    const res = await fetch(`${baseUrl}/api/notifications/history`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns paginated history when authenticated as admin", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });

    const mockHistoryItem = {
      _id: "hist_1",
      type: "broadcast",
      title: "Mock Test Alert",
      body: "Test ready",
      route: "/mock-test",
      totalDevices: 15,
      successCount: 14,
      failureCount: 1,
      invalidDeviceCount: 0,
      sentByUserId: "admin_1",
      sentByEmail: "admin@test.com",
      createdAt: new Date().toISOString(),
    };

    mockFindToArray.mockResolvedValueOnce([mockHistoryItem]);
    mockCountDocuments.mockResolvedValueOnce(1);

    const res = await fetch(`${baseUrl}/api/notifications/history?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(10);
    expect(data.totalPages).toBe(1);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe("Mock Test Alert");
  });
});

describe("Notifications Routes - POST /api/notifications/schedule", () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("returns 401 when no token is provided", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Daily Practice 🔥",
        body: "Your SSC practice set is ready.",
        sendAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin or superadmin", async () => {
    const userToken = signToken({ id: "user_1", email: "u@test.com", role: "user" });
    const res = await fetch(`${baseUrl}/api/notifications/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: "Daily Practice 🔥",
        body: "Your SSC practice set is ready.",
        sendAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when body fails validation", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const res = await fetch(`${baseUrl}/api/notifications/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "", // empty title
        body: "Your SSC practice set is ready.",
        sendAt: "invalid-date",
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid scheduled notification");
  });

  it("returns 400 when sendAt is not in the future (within 30 seconds)", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const res = await fetch(`${baseUrl}/api/notifications/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Daily Practice 🔥",
        body: "Your SSC practice set is ready.",
        sendAt: new Date(Date.now() + 10_000).toISOString(), // only 10s in future
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Scheduled time must be in the future");
  });

  it("successfully schedules a notification when authenticated as admin", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@example.com", role: "admin" });
    const futureDate = new Date(Date.now() + 3600_000).toISOString();

    const res = await fetch(`${baseUrl}/api/notifications/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Daily Practice 🔥",
        body: "Your SSC practice set is ready.",
        route: "/practice",
        sendAt: futureDate,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.id).toBe("sched_123");
    expect(data.sendAt).toBe(futureDate);

    expect(mockScheduleInsertOne).toHaveBeenCalledWith({
      title: "Daily Practice 🔥",
      body: "Your SSC practice set is ready.",
      route: "/practice",
      sendAt: new Date(futureDate),
      status: "pending",
      createdByUserId: "admin_1",
      createdByEmail: "admin@example.com",
      createdAt: expect.any(Date),
      sentAt: null,
      processingAt: null,
    });
  });
});

describe("Notifications Routes - Scheduled Management (GET, cancel, retry)", () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── GET /scheduled ──
  it("GET /scheduled rejects invalid status filter", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const res = await fetch(`${baseUrl}/api/notifications/scheduled?status=unknown`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid schedule status");
  });

  it("GET /scheduled returns items and counts for admin", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const mockItem = {
      _id: "507f1f77bcf86cd799439011",
      title: "Upcoming Test",
      body: "Test Body",
      route: "/",
      sendAt: new Date().toISOString(),
      status: "pending",
    };

    mockScheduleFindCursor.toArray.mockResolvedValueOnce([mockItem]);
    mockScheduleCountDocuments
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1) // pending
      .mockResolvedValueOnce(0) // sent
      .mockResolvedValueOnce(0) // failed
      .mockResolvedValueOnce(0); // cancelled

    const res = await fetch(`${baseUrl}/api/notifications/scheduled?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.counts.pending).toBe(1);
  });

  // ── POST /scheduled/:id/cancel ──
  it("POST /scheduled/:id/cancel returns 400 for invalid ObjectId", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const res = await fetch(`${baseUrl}/api/notifications/scheduled/invalid-id/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid notification ID");
  });

  it("POST /scheduled/:id/cancel returns 409 if not pending", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    mockScheduleFindOneAndUpdate.mockResolvedValueOnce(null);

    const res = await fetch(`${baseUrl}/api/notifications/scheduled/507f1f77bcf86cd799439011/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Notification is not pending or no longer exists");
  });

  it("POST /scheduled/:id/cancel successfully cancels a pending notification", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const cancelledDoc = {
      _id: "507f1f77bcf86cd799439011",
      title: "Cancelled Test",
      status: "cancelled",
    };
    mockScheduleFindOneAndUpdate.mockResolvedValueOnce(cancelledDoc);

    const res = await fetch(`${baseUrl}/api/notifications/scheduled/507f1f77bcf86cd799439011/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.item.status).toBe("cancelled");
  });

  // ── POST /scheduled/:id/retry ──
  it("POST /scheduled/:id/retry returns 404 if notification not found", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    mockScheduleFindOne.mockResolvedValueOnce(null);

    const res = await fetch(`${baseUrl}/api/notifications/scheduled/507f1f77bcf86cd799439011/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Scheduled notification not found");
  });

  it("POST /scheduled/:id/retry returns 409 if status is not failed", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    mockScheduleFindOne.mockResolvedValueOnce({
      _id: "507f1f77bcf86cd799439011",
      status: "sent",
    });

    const res = await fetch(`${baseUrl}/api/notifications/scheduled/507f1f77bcf86cd799439011/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Only failed notifications can be retried");
  });

  it("POST /scheduled/:id/retry successfully retries a failed notification", async () => {
    const adminToken = signToken({ id: "admin_1", email: "admin@test.com", role: "admin" });
    const failedDoc = {
      _id: "507f1f77bcf86cd799439011",
      title: "Failed Exam Notification",
      body: "Exam alert",
      route: "/exam",
      status: "failed",
    };
    mockScheduleFindOne.mockResolvedValueOnce(failedDoc);
    mockScheduleInsertOne.mockResolvedValueOnce({ insertedId: "sched_retry_new" });

    const res = await fetch(`${baseUrl}/api/notifications/scheduled/507f1f77bcf86cd799439011/retry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.id).toBe("sched_retry_new");
  });

  describe("Device lifecycle: /register & /unregister", () => {
    const userToken = signToken({
      id: "user_device_1",
      email: "device1@test.com",
      role: "user",
    });

    it("POST /register rejects unauthenticated requests", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: "fcm_token_123456789" }),
      });
      expect(res.status).toBe(401);
    });

    it("POST /register rejects invalid fid", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ fid: "short" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid push registration");
    });

    it("POST /register upserts device and unsets disabledAt / disabledReason", async () => {
      mockUpdateOne.mockResolvedValueOnce({ acknowledged: true });

      const res = await fetch(`${baseUrl}/api/notifications/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          fid: "fcm_token_valid_1234567890",
          platform: "android",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { fid: "fcm_token_valid_1234567890" },
        {
          $set: expect.objectContaining({
            userId: "user_device_1",
            email: "device1@test.com",
            platform: "android",
            enabled: true,
          }),
          $unset: {
            disabledAt: "",
            disabledReason: "",
          },
          $setOnInsert: {
            createdAt: expect.any(Date),
          },
        },
        { upsert: true }
      );
    });

    it("POST /unregister rejects unauthenticated requests", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/unregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: "fcm_token_123456789" }),
      });
      expect(res.status).toBe(401);
    });

    it("POST /unregister rejects invalid fid", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/unregister`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ fid: "short" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid push registration");
    });

    it("POST /unregister disables push registration specifically for the logged-in user", async () => {
      mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

      const res = await fetch(`${baseUrl}/api/notifications/unregister`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          fid: "fcm_token_valid_1234567890",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        {
          fid: "fcm_token_valid_1234567890",
          userId: "user_device_1",
        },
        {
          $set: expect.objectContaining({
            enabled: false,
            disabledReason: "logout",
            disabledAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        }
      );
    });
  });

  describe("Notification Center Inbox (/inbox, /inbox/:id/read, /inbox/read-all)", () => {
    const userToken = signToken({
      id: "user_inbox_1",
      email: "inbox1@test.com",
      role: "user",
    });

    // ── GET /inbox ──
    it("GET /inbox returns 401 when no token is provided", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/inbox`);
      expect(res.status).toBe(401);
    });

    it("GET /inbox returns paginated notifications and unread count", async () => {
      const pastDate = new Date(Date.now() - 3600_000);
      const recentDate = new Date(Date.now() - 60_000);

      mockUsersFindOne.mockResolvedValueOnce({
        id: "user_inbox_1",
        notificationState: {
          lastReadAllAt: pastDate.toISOString(),
        },
      });

      const mockItems = [
        {
          _id: "507f1f77bcf86cd799439021",
          audience: "all",
          title: "New Mock Available",
          body: "Check out CGL 15",
          route: "/mock-test",
          createdAt: recentDate,
        },
        {
          _id: "507f1f77bcf86cd799439022",
          audience: "user",
          userId: "user_inbox_1",
          title: "Daily Practice 🔥",
          body: "Time for practice",
          route: "/practice",
          createdAt: new Date(Date.now() - 7200_000), // older than lastReadAllAt
        },
      ];

      mockFeedToArray.mockResolvedValueOnce(mockItems);
      mockFeedCountDocuments.mockResolvedValueOnce(2);
      mockReceiptsFindToArray.mockResolvedValueOnce([
        {
          notificationId: "507f1f77bcf86cd799439021",
          userId: "user_inbox_1",
        },
      ]);
      mockFeedAggregateToArray.mockResolvedValueOnce([{ count: 1 }]);

      const res = await fetch(`${baseUrl}/api/notifications/inbox?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
      expect(data.totalPages).toBe(1);
      expect(data.unreadCount).toBe(1);
      expect(data.items).toHaveLength(2);
      expect(data.items[0].read).toBe(true);
      expect(data.items[1].read).toBe(true);
    });

    // ── POST /inbox/:id/read ──
    it("POST /inbox/:id/read returns 401 when no token is provided", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/inbox/507f1f77bcf86cd799439021/read`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("POST /inbox/:id/read returns 400 for invalid ObjectId", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/inbox/not-an-object-id/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid notification ID");
    });

    it("POST /inbox/:id/read returns 404 if notification not found or inaccessible", async () => {
      mockFeedFindOne.mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/notifications/inbox/507f1f77bcf86cd799439021/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Notification not found");
    });

    it("POST /inbox/:id/read upserts read receipt when valid", async () => {
      mockFeedFindOne.mockResolvedValueOnce({
        _id: "507f1f77bcf86cd799439021",
        audience: "all",
        title: "Test",
      });
      mockReceiptsUpdateOne.mockResolvedValueOnce({ acknowledged: true });

      const res = await fetch(`${baseUrl}/api/notifications/inbox/507f1f77bcf86cd799439021/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(mockReceiptsUpdateOne).toHaveBeenCalledWith(
        {
          userId: "user_inbox_1",
          notificationId: expect.any(Object),
        },
        {
          $set: { readAt: expect.any(Date) },
          $setOnInsert: { createdAt: expect.any(Date) },
        },
        { upsert: true }
      );
    });

    // ── POST /inbox/read-all ──
    it("POST /inbox/read-all returns 401 when no token is provided", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/inbox/read-all`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("POST /inbox/read-all updates lastReadAllAt for the user", async () => {
      mockUsersUpdateOne.mockResolvedValueOnce({ acknowledged: true });

      const res = await fetch(`${baseUrl}/api/notifications/inbox/read-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.readAt).toBeDefined();
      expect(mockUsersUpdateOne).toHaveBeenCalledWith(
        { id: "user_inbox_1" },
        {
          $set: {
            "notificationState.lastReadAllAt": expect.any(Date),
          },
        }
      );
    });

    // ── GET /inbox/unread-count ──
    it("GET /inbox/unread-count returns 401 when no token is provided", async () => {
      const res = await fetch(`${baseUrl}/api/notifications/inbox/unread-count`);
      expect(res.status).toBe(401);
    });

    it("GET /inbox/unread-count returns unread count for authenticated user", async () => {
      mockUsersFindOne.mockResolvedValueOnce({
        id: "user_inbox_1",
        notificationState: {
          lastReadAllAt: new Date(Date.now() - 3600_000).toISOString(),
        },
      });
      mockFeedAggregateToArray.mockResolvedValueOnce([{ count: 4 }]);

      const res = await fetch(`${baseUrl}/api/notifications/inbox/unread-count`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ unreadCount: 4 });
    });
  });
});
