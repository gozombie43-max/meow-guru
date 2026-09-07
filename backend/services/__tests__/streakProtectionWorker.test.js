import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindToArray = vi.fn();
const mockUpdateOne = vi.fn();
const mockSendPushToUser = vi.fn();
const mockGetStudyProgress = vi.fn();

const mockUsersCursor = {
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: (...args) => mockFindToArray(...args),
};

vi.mock('../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    find: vi.fn(() => mockUsersCursor),
    updateOne: (...args) => mockUpdateOne(...args),
  }),
}));

vi.mock('../pushNotificationService.js', () => ({
  sendPushToUser: (...args) => mockSendPushToUser(...args),
}));

vi.mock('../studyProgressService.js', () => ({
  getStudyProgress: (...args) => mockGetStudyProgress(...args),
}));

import {
  runStreakProtectionWorkerOnce,
  buildMessage,
} from '../streakProtectionWorker.js';

describe('streakProtectionWorker', () => {
  const now = new Date('2026-09-07T21:30:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildMessage', () => {
    it('formats urgency copy when <= 5 min left', () => {
      const msg = buildMessage({ streak: 5, remainingMinutes: 4 });
      expect(msg).toBe('Only 4 min left to protect your 5-day streak 🔥');
    });

    it('formats risk copy when > 5 min left', () => {
      const msg = buildMessage({ streak: 5, remainingMinutes: 15 });
      expect(msg).toBe('Your 5-day streak is at risk. 15 min of practice left today.');
    });
  });

  it('claims due user and sends push notification when all criteria are met', async () => {
    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
          nextStreakProtectionAt: new Date(Date.now() - 60_000),
          lastSentAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago (> 2h)
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 1260, // 21 min
      goalSeconds: 1800,
      goalComplete: false,
      streak: 5,
      completedMinutes: 21,
      remainingMinutes: 9,
      lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago (> 90m)
    });

    // Claim succeeds
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    // Push succeeds
    mockSendPushToUser.mockResolvedValueOnce({ successCount: 1, failureCount: 0 });
    // Record sent update
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runStreakProtectionWorkerOnce();

    expect(mockUpdateOne).toHaveBeenCalledTimes(2);

    // 1st call: atomic claim setting next tomorrow
    expect(mockUpdateOne.mock.calls[0][0]).toEqual({
      id: 'user_1',
      'dailyPracticeReminder.streakProtectionEnabled': true,
      'dailyPracticeReminder.nextStreakProtectionAt': expect.any(Date),
    });

    // Send push
    expect(mockSendPushToUser).toHaveBeenCalledWith('user_1', {
      title: 'Streak Protection 🔥',
      body: 'Your 5-day streak is at risk. 9 min of practice left today.',
      route: '/',
      category: 'dailyPractice',
      centerKey: 'streak-protection:user_1:2026-09-07',
      data: {
        type: 'streak_protection',
        streak: 5,
        remainingMinutes: 9,
      },
    });

    // 2nd call: records sent result
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual(
      expect.objectContaining({
        'dailyPracticeReminder.lastStreakProtectionResult': 'sent',
        'dailyPracticeReminder.lastStreakProtectionSentAt': expect.any(Date),
      })
    );
  });

  it('skips push and sets goal-completed when user already completed goal today', async () => {
    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
          nextStreakProtectionAt: new Date(Date.now() - 60_000),
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 1800,
      goalSeconds: 1800,
      goalComplete: true,
      streak: 5,
      completedMinutes: 30,
      remainingMinutes: 0,
      lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runStreakProtectionWorkerOnce();

    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual({
      'dailyPracticeReminder.lastStreakProtectionResult': 'goal-completed',
    });
  });

  it('skips push and sets no-active-streak when streak is 0 or 1', async () => {
    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
          nextStreakProtectionAt: new Date(Date.now() - 60_000),
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 600,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 1, // Only 1 day streak
      completedMinutes: 10,
      remainingMinutes: 20,
      lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runStreakProtectionWorkerOnce();

    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual({
      'dailyPracticeReminder.lastStreakProtectionResult': 'no-active-streak',
    });
  });

  it('skips push and sets recently-active when user studied within 90 minutes', async () => {
    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
          nextStreakProtectionAt: new Date(Date.now() - 60_000),
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 600,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 3,
      completedMinutes: 10,
      remainingMinutes: 20,
      lastActivityAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago (< 90m)
    });

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runStreakProtectionWorkerOnce();

    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual({
      'dailyPracticeReminder.lastStreakProtectionResult': 'recently-active',
    });
  });

  it('skips push and sets recent-daily-reminder when daily reminder was sent within 2 hours', async () => {
    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
          nextStreakProtectionAt: new Date(Date.now() - 60_000),
          lastSentAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (< 2h)
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 600,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 3,
      completedMinutes: 10,
      remainingMinutes: 20,
      lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    });

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runStreakProtectionWorkerOnce();

    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual({
      'dailyPracticeReminder.lastStreakProtectionResult': 'recent-daily-reminder',
    });
  });

  it('records failed result when push service throws an error', async () => {
    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          streakProtectionEnabled: true,
          streakProtectionTime: '21:30',
          nextStreakProtectionAt: new Date(Date.now() - 60_000),
          lastSentAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 600,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 4,
      completedMinutes: 10,
      remainingMinutes: 20,
      lastActivityAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    });

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockSendPushToUser.mockRejectedValueOnce(new Error('FCM unreachable'));
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runStreakProtectionWorkerOnce();

    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual(
      expect.objectContaining({
        'dailyPracticeReminder.lastStreakProtectionResult': 'failed',
        'dailyPracticeReminder.lastStreakProtectionError': 'FCM unreachable',
      })
    );
  });
});
