import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { signToken } from "../../auth/jwt.js";

const mockPublishExamUpdate = vi.fn();
vi.mock("../../services/examUpdateService.js", () => ({
  publishExamUpdate: (...args) => mockPublishExamUpdate(...args),
}));

const mockFindToArray = vi.fn().mockResolvedValue([]);
const mockCountDocuments = vi.fn().mockResolvedValue(0);

const mockFindCursor = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: (...args) => mockFindToArray(...args),
};

vi.mock("../../config/mongodb.js", () => ({
  getExamUpdatesCollection: () => ({
    find: vi.fn(() => mockFindCursor),
    countDocuments: (...args) => mockCountDocuments(...args),
  }),
}));

import examUpdatesRouter from "../examUpdates.routes.js";

describe("Exam Updates Routes", () => {
  let app;
  let server;
  let baseUrl;

  const adminToken = signToken({
    id: "admin-1",
    email: "admin@quizguru.com",
    role: "admin",
  });

  const userToken = signToken({
    id: "user-1",
    email: "student@quizguru.com",
    role: "user",
  });

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/exam-updates", examUpdatesRouter);

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/exam-updates", () => {
    it("returns 401 when no token is provided", async () => {
      const res = await fetch(`${baseUrl}/api/exam-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSlug: "ssc-cgl",
          type: "admit-card",
          title: "Admit Card Out",
          message: "Download now.",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("No token provided");
    });

    it("returns 403 when user is not admin or superadmin", async () => {
      const res = await fetch(`${baseUrl}/api/exam-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          examSlug: "ssc-cgl",
          type: "admit-card",
          title: "Admit Card Out",
          message: "Download now.",
        }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Insufficient permissions");
    });

    it("returns 400 when payload fails validation", async () => {
      const res = await fetch(`${baseUrl}/api/exam-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          examSlug: "", // invalid empty slug
          type: "unknown-type", // invalid enum
          title: "",
          message: "",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid exam update");
    });

    it("publishes update and returns result on valid admin request", async () => {
      mockPublishExamUpdate.mockResolvedValueOnce({
        sent: true,
        totalDevices: 40,
        successCount: 38,
        failureCount: 2,
        invalidDeviceCount: 0,
      });

      const res = await fetch(`${baseUrl}/api/exam-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          examSlug: "ssc-cgl",
          type: "admit-card",
          title: "SSC CGL Admit Card Released 🎫",
          message: "The SSC CGL admit card is now available.",
          route: "/exam-updates/ssc-cgl",
          sourceUrl: "https://ssc.gov.in",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        ok: true,
        sent: true,
        totalDevices: 40,
        successCount: 38,
        failureCount: 2,
        invalidDeviceCount: 0,
      });

      expect(mockPublishExamUpdate).toHaveBeenCalledWith({
        examSlug: "ssc-cgl",
        type: "admit-card",
        title: "SSC CGL Admit Card Released 🎫",
        message: "The SSC CGL admit card is now available.",
        route: "/exam-updates/ssc-cgl",
        sourceUrl: "https://ssc.gov.in",
        createdByUserId: "admin-1",
        createdByEmail: "admin@quizguru.com",
      });
    });

    it("handles duplicate updates cleanly without crashing", async () => {
      mockPublishExamUpdate.mockResolvedValueOnce({
        duplicate: true,
        sent: false,
      });

      const res = await fetch(`${baseUrl}/api/exam-updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          examSlug: "ssc-cgl",
          type: "admit-card",
          title: "SSC CGL Admit Card Released 🎫",
          message: "The SSC CGL admit card is now available.",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({
        ok: true,
        duplicate: true,
        sent: false,
      });
    });
  });

  describe("GET /api/exam-updates", () => {
    it("returns paginated exam updates list", async () => {
      const mockItems = [
        {
          _id: "u1",
          examSlug: "ssc-cgl",
          type: "admit-card",
          title: "SSC CGL Admit Card",
        },
      ];
      mockFindToArray.mockResolvedValueOnce(mockItems);
      mockCountDocuments.mockResolvedValueOnce(1);

      const res = await fetch(`${baseUrl}/api/exam-updates?page=1&limit=10`);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items).toHaveLength(1);
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      expect(body.totalPages).toBe(1);
    });

    it("filters updates by examSlug", async () => {
      mockFindToArray.mockResolvedValueOnce([]);
      mockCountDocuments.mockResolvedValueOnce(0);

      const res = await fetch(`${baseUrl}/api/exam-updates/ssc-chsl`);
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });
  });
});
