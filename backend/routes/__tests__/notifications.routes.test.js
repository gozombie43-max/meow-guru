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
