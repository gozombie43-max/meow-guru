import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSendEachForMulticast = vi.fn();
const mockDevicesFindToArray = vi.fn();
const mockUserFindOne = vi.fn();
const mockUsersFindToArray = vi.fn();
const mockUpdateMany = vi.fn().mockResolvedValue({ acknowledged: true });
const mockFeedUpdateOne = vi.fn().mockResolvedValue({ acknowledged: true });

vi.mock('../../config/firebase.js', () => ({
  firebaseMessaging: {
    sendEachForMulticast: (...args) => mockSendEachForMulticast(...args),
  },
}));

vi.mock('../../config/mongodb.js', () => ({
  getPushDevicesCollection: () => ({
    find: vi.fn(() => ({
      toArray: (...args) => mockDevicesFindToArray(...args),
      project: vi.fn(() => ({
        toArray: (...args) => mockDevicesFindToArray(...args),
      })),
    })),
    updateMany: mockUpdateMany,
  }),
  getUsersCollection: () => ({
    findOne: (...args) => mockUserFindOne(...args),
    find: vi.fn(() => ({
      toArray: (...args) => mockUsersFindToArray(...args),
    })),
  }),
  getNotificationFeedCollection: () => ({
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'feed_1' }),
    updateOne: mockFeedUpdateOne,
  }),
}));

import {
  sendPushToUser,
  sendPushToAllUsers,
} from '../pushNotificationService.js';

describe('Push Notification Preferences Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPushToUser', () => {
    it('suppresses push when user has master notifications disabled', async () => {
      mockUserFindOne.mockResolvedValueOnce({
        id: 'user_1',
        notificationPreferences: {
          enabled: false,
          battleInvites: true,
        },
      });

      const result = await sendPushToUser('user_1', {
        title: 'Challenged!',
        body: 'Battle me',
        category: 'battleInvites',
      });

      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        suppressed: true,
        notificationId: 'feed_1',
      });
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('suppresses push when user has specific category disabled', async () => {
      mockUserFindOne.mockResolvedValueOnce({
        id: 'user_1',
        notificationPreferences: {
          enabled: true,
          battleInvites: false,
          battleResults: true,
        },
      });

      const result = await sendPushToUser('user_1', {
        title: 'Challenged!',
        body: 'Battle me',
        category: 'battleInvites',
      });

      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        suppressed: true,
        notificationId: 'feed_1',
      });
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('suppresses push when user record does not exist', async () => {
      mockUserFindOne.mockResolvedValueOnce(null);

      const result = await sendPushToUser('missing_user', {
        title: 'Test',
        body: 'Test body',
      });

      expect(result).toEqual({
        successCount: 0,
        failureCount: 0,
        suppressed: true,
      });
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('allows push when category is enabled', async () => {
      mockUserFindOne.mockResolvedValueOnce({
        id: 'user_1',
        notificationPreferences: {
          enabled: true,
          battleResults: true,
        },
      });

      mockDevicesFindToArray.mockResolvedValueOnce([
        { fid: 'fid_device_1', userId: 'user_1', platform: 'android', enabled: true },
      ]);

      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const result = await sendPushToUser('user_1', {
        title: 'You Won! 🏆',
        body: 'Final score 10-5',
        category: 'battleResults',
      });

      expect(result.successCount).toBe(1);
      expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendPushToAllUsers', () => {
    it('filters out devices of users who opted out of announcements', async () => {
      mockDevicesFindToArray.mockResolvedValueOnce([
        { fid: 'fid_1', userId: 'user_allow' },
        { fid: 'fid_2', userId: 'user_optout' },
        { fid: 'fid_3', userId: 'user_disabled' },
      ]);

      mockUsersFindToArray.mockResolvedValueOnce([
        {
          id: 'user_allow',
          notificationPreferences: { enabled: true, announcements: true },
        },
        {
          id: 'user_optout',
          notificationPreferences: { enabled: true, announcements: false },
        },
        {
          id: 'user_disabled',
          notificationPreferences: { enabled: false, announcements: true },
        },
      ]);

      mockSendEachForMulticast.mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const result = await sendPushToAllUsers({
        title: 'System Announcement',
        body: 'New features available!',
        category: 'announcements',
      });

      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          fids: ['fid_1'],
        })
      );
      expect(result.totalDevices).toBe(1);
      expect(result.successCount).toBe(1);
    });
  });
});
