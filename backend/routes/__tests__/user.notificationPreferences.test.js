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

describe('User Notification Preferences Routes', () => {
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

  describe('GET /users/me/notification-preferences', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await fetch(`${baseUrl}/users/me/notification-preferences`);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('No token provided');
    });

    it('returns 404 when user is not found', async () => {
      mockFindOne.mockResolvedValueOnce(null);
      const token = signToken({ id: 'missing_user', email: 'missing@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('User not found');
    });

    it('returns default preferences when user has no stored preferences', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.preferences).toEqual({
        enabled: true,
        battleInvites: true,
        battleResults: true,
        dailyPractice: true,
        newMocks: true,
        examUpdates: true,
        announcements: true,
      });
    });

    it('returns merged preferences when user has customized settings', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
        notificationPreferences: {
          battleInvites: false,
          announcements: false,
        },
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.preferences.enabled).toBe(true);
      expect(data.preferences.battleInvites).toBe(false);
      expect(data.preferences.battleResults).toBe(true);
      expect(data.preferences.announcements).toBe(false);
    });
  });

  describe('PATCH /users/me/notification-preferences', () => {
    it('returns 400 when body is empty', async () => {
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid notification preferences');
    });

    it('returns 400 when body contains unexpected keys', async () => {
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ unknownKey: true }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid notification preferences');
    });

    it('returns 400 when body contains non-boolean values', async () => {
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: 'yes' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid notification preferences');
    });

    it('successfully updates single preference and returns full merged preferences', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
        notificationPreferences: {
          dailyPractice: true,
        },
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ battleInvites: false }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.preferences.battleInvites).toBe(false);
      expect(data.preferences.dailyPractice).toBe(true);
      expect(data.preferences.enabled).toBe(true);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: 'user_1', type: { $ne: 'email_lock' } },
        expect.objectContaining({
          $set: expect.objectContaining({
            notificationPreferences: expect.objectContaining({
              battleInvites: false,
              dailyPractice: true,
              enabled: true,
            }),
          }),
        })
      );
    });

    it('successfully disables master toggle', async () => {
      mockFindOne.mockResolvedValueOnce({
        id: 'user_1',
        email: 'user1@example.com',
        notificationPreferences: {
          battleInvites: true,
          announcements: true,
        },
      });
      const token = signToken({ id: 'user_1', email: 'user1@example.com' });

      const res = await fetch(`${baseUrl}/users/me/notification-preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.preferences.enabled).toBe(false);
      expect(data.preferences.battleInvites).toBe(true);
    });
  });
});
