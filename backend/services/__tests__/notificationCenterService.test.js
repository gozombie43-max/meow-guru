import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsertOne = vi.fn();
const mockFindOne = vi.fn();

vi.mock('../../config/mongodb.js', () => ({
  getNotificationFeedCollection: () => ({
    insertOne: (...args) => mockInsertOne(...args),
    findOne: (...args) => mockFindOne(...args),
  }),
}));

const mockEmitNotificationToUser = vi.fn();
const mockEmitGlobalNotification = vi.fn();

vi.mock('../notificationRealtime.js', () => ({
  emitNotificationToUser: (...args) => mockEmitNotificationToUser(...args),
  emitGlobalNotification: (...args) => mockEmitGlobalNotification(...args),
}));

import {
  createUserNotification,
  createGlobalNotification,
} from '../notificationCenterService.js';

describe('notificationCenterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates user notification, persists to feed, and emits notification:new to user room', async () => {
    mockInsertOne.mockResolvedValueOnce({ insertedId: 'notif_123' });

    const id = await createUserNotification({
      userId: 'user_99',
      title: 'Practice Time 🔥',
      body: 'Complete your daily goal.',
      route: '/practice',
      category: 'dailyPractice',
      type: 'daily_practice',
      data: { streak: 3 },
      dedupeKey: 'daily-practice:user_99:2026-09-07',
    });

    expect(id).toBe('notif_123');
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'user',
        userId: 'user_99',
        title: 'Practice Time 🔥',
        body: 'Complete your daily goal.',
        route: '/practice',
        category: 'dailyPractice',
        type: 'daily_practice',
        data: { streak: 3 },
        dedupeKey: 'daily-practice:user_99:2026-09-07',
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
      })
    );

    expect(mockEmitNotificationToUser).toHaveBeenCalledWith(
      'user_99',
      expect.objectContaining({
        _id: 'notif_123',
        title: 'Practice Time 🔥',
        body: 'Complete your daily goal.',
        route: '/practice',
        category: 'dailyPractice',
        read: false,
      })
    );
    expect(mockEmitGlobalNotification).not.toHaveBeenCalled();
  });

  it('creates global notification, persists to feed, and emits notification:new globally', async () => {
    mockInsertOne.mockResolvedValueOnce({ insertedId: 'notif_global_1' });

    const id = await createGlobalNotification({
      title: 'New Mock Test Available 🎯',
      body: 'SSC CGL Full Mock 16 is live.',
      route: '/mock-test',
      category: 'newMocks',
      type: 'new_mock',
    });

    expect(id).toBe('notif_global_1');
    expect(mockInsertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'all',
        title: 'New Mock Test Available 🎯',
      })
    );

    expect(mockEmitGlobalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'notif_global_1',
        title: 'New Mock Test Available 🎯',
        read: false,
      })
    );
    expect(mockEmitNotificationToUser).not.toHaveBeenCalled();
  });

  it('does NOT emit notification:new when dedupeKey hits existing document (MongoDB error 11000)', async () => {
    const duplicateError = new Error('E11000 duplicate key');
    duplicateError.code = 11000;
    mockInsertOne.mockRejectedValueOnce(duplicateError);
    mockFindOne.mockResolvedValueOnce({ _id: 'existing_notif_456' });

    const id = await createUserNotification({
      userId: 'user_99',
      title: 'Duplicate Test',
      body: 'Duplicate body',
      dedupeKey: 'duplicate-key-1',
    });

    expect(id).toBe('existing_notif_456');
    expect(mockEmitNotificationToUser).not.toHaveBeenCalled();
    expect(mockEmitGlobalNotification).not.toHaveBeenCalled();
  });
});
