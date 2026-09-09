vi.mock('../../auth/sessions.js', () => ({ assertSession: async decoded => decoded }));
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { signToken } from '../../auth/jwt.js';

const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    findOne: (...args) => mockFindOne(...args),
    updateOne: (...args) => mockUpdateOne(...args),
  }),
}));

import userRouter from '../user.routes.js';

describe('User Daily Practice Reminder Routes', () => {
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

  describe('GET /users/me/daily-practice-reminder', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('No token provided');
    });

    it('returns 404 when user is not found', async () => {
      mockFindOne.mockResolvedValueOnce(null);
      const token = signToken({ id: 'missing_user', email: 'missing@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('User not found');
    });

    it('returns defaults when user has no configured reminder', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.reminder).toEqual({
        enabled: false,
        time: '20:00',
        timezone: null,
        nextSendAt: null,
        lastSentAt: null,
        streakProtectionEnabled: false,
        streakProtectionTime: '21:30',
        nextStreakProtectionAt: null,
        lastStreakProtectionSentAt: null,
      });
    });

    it('returns stored reminder settings', async () => {
      const scheduledDate = new Date().toISOString();
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
        dailyPracticeReminder: {
          enabled: true,
          time: '19:30',
          timezone: 'Asia/Kolkata',
          nextSendAt: scheduledDate,
          lastSentAt: null,
        },
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.reminder).toEqual({
        enabled: true,
        time: '19:30',
        timezone: 'Asia/Kolkata',
        nextSendAt: scheduledDate,
        lastSentAt: null,
        streakProtectionEnabled: false,
        streakProtectionTime: '21:30',
        nextStreakProtectionAt: null,
        lastStreakProtectionSentAt: null,
      });
    });
  });

  describe('PATCH /users/me/daily-practice-reminder', () => {
    it('returns 400 when body fails schema validation', async () => {
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          time: 'invalid-time',
          timezone: 'Asia/Kolkata',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid reminder settings');
    });

    it('returns 400 when timezone is invalid', async () => {
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          time: '20:00',
          timezone: 'Moon/Base',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid timezone');
    });

    it('computes nextSendAt and updates user when enabled: true', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          time: '21:00',
          timezone: 'Asia/Kolkata',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.reminder.enabled).toBe(true);
      expect(data.reminder.time).toBe('21:00');
      expect(data.reminder.timezone).toBe('Asia/Kolkata');
      expect(data.reminder.nextSendAt).toBeTruthy();

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: 'user_1', type: { $ne: 'email_lock' } },
        expect.objectContaining({
          $set: expect.objectContaining({
            dailyPracticeReminder: expect.objectContaining({
              enabled: true,
              time: '21:00',
              timezone: 'Asia/Kolkata',
              nextSendAt: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('sets nextSendAt to null when enabled: false', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: false,
          time: '21:00',
          timezone: 'Asia/Kolkata',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.reminder.enabled).toBe(false);
      expect(data.reminder.nextSendAt).toBeNull();

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: 'user_1', type: { $ne: 'email_lock' } },
        expect.objectContaining({
          $set: expect.objectContaining({
            dailyPracticeReminder: expect.objectContaining({
              enabled: false,
              nextSendAt: null,
            }),
          }),
        })
      );
    });

    it('calculates nextStreakProtectionAt when streakProtectionEnabled: true', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/daily-practice-reminder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.reminder.streakProtectionEnabled).toBe(true);
      expect(data.reminder.streakProtectionTime).toBe('21:30');
      expect(data.reminder.nextStreakProtectionAt).toBeTruthy();

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: 'user_1', type: { $ne: 'email_lock' } },
        expect.objectContaining({
          $set: expect.objectContaining({
            dailyPracticeReminder: expect.objectContaining({
              streakProtectionEnabled: true,
              streakProtectionTime: '21:30',
              nextStreakProtectionAt: expect.any(Date),
            }),
          }),
        })
      );
    });
  });
});
