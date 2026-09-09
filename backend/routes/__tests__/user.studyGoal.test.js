vi.mock('../../auth/sessions.js', () => ({ assertSession: async decoded => decoded }));
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { signToken } from '../../auth/jwt.js';

const mockUsersFindOne = vi.fn();
const mockUsersUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });
const mockDailyUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1, upsertedCount: 0 });

vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    findOne: (...args) => mockUsersFindOne(...args),
    updateOne: (...args) => mockUsersUpdateOne(...args),
  }),
  getStudyActivityDailyCollection: () => ({
    updateOne: (...args) => mockDailyUpdateOne(...args),
  }),
}));

import userRouter from '../user.routes.js';

describe('User Study Goal & Usage Routes', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/users', userRouter);

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /users/me/study-goal', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await fetch(`${baseUrl}/users/me/study-goal`);
      expect(res.status).toBe(401);
    });

    it('returns default 30 minutes when user has not set goal', async () => {
      mockUsersFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/study-goal`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.dailyGoalMinutes).toBe(30);
    });

    it('returns saved goal when user configured dailyGoalMinutes', async () => {
      mockUsersFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
        dailyGoalMinutes: 45,
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/study-goal`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.dailyGoalMinutes).toBe(45);
    });
  });

  describe('PATCH /users/me/study-goal', () => {
    it('validates dailyGoalMinutes bounds', async () => {
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/study-goal`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dailyGoalMinutes: 2 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid daily goal');
    });

    it('updates dailyGoalMinutes successfully', async () => {
      mockUsersUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/study-goal`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dailyGoalMinutes: 60 }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.dailyGoalMinutes).toBe(60);

      expect(mockUsersUpdateOne).toHaveBeenCalledWith(
        { id: 'user_1', type: { $ne: 'email_lock' } },
        {
          $set: expect.objectContaining({
            dailyGoalMinutes: 60,
            studyGoalUpdatedAt: expect.any(Date),
          }),
        }
      );
    });
  });

  describe('PATCH /users/me/usage', () => {
    it('tracks study time cumulatively and in studyActivityDaily', async () => {
      mockUsersFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
        dailyPracticeReminder: { timezone: 'Asia/Kolkata' },
      });
      mockUsersUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });
      mockDailyUpdateOne.mockResolvedValueOnce({ matchedCount: 1 });

      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/usage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activeSeconds: 120,
          timezone: 'Asia/Kolkata',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe('Usage tracked ✅');
      expect(data.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify users collection update
      expect(mockUsersUpdateOne).toHaveBeenCalledWith(
        { id: 'user_1' },
        {
          $inc: { studyTime: 120 },
          $set: { timezone: 'Asia/Kolkata' },
        }
      );

      // Verify studyActivityDaily collection update
      expect(mockDailyUpdateOne).toHaveBeenCalledWith(
        {
          userId: 'user_1',
          dateKey: data.dateKey,
        },
        {
          $inc: { activeSeconds: 120 },
          $set: {
            timezone: 'Asia/Kolkata',
            updatedAt: expect.any(Date),
          },
          $setOnInsert: {
            createdAt: expect.any(Date),
          },
        },
        { upsert: true }
      );
    });
  });
});
