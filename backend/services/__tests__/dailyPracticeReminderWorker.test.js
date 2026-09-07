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
  runDailyPracticeReminderWorkerOnce,
  buildDailyPracticeMessage,
} from '../dailyPracticeReminderWorker.js';

describe('dailyPracticeReminderWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStudyProgress.mockResolvedValue({
      dateKey: '2026-09-07',
      activeSeconds: 0,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 0,
      completedMinutes: 0,
      remainingMinutes: 30,
    });
  });

  it('claims due user, sends push notification, and sets next occurrence to tomorrow', async () => {
    const dueSendAt = new Date(Date.now() - 60_000);

    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          nextSendAt: dueSendAt,
        },
      },
    ]);

    // Atomic claim succeeds
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    // Push succeeds
    mockSendPushToUser.mockResolvedValueOnce({ successCount: 1, failureCount: 0 });
    // Final status update
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runDailyPracticeReminderWorkerOnce();

    expect(mockUpdateOne).toHaveBeenCalledTimes(2);

    // 1st update: atomic claim with tomorrow's nextSendAt
    expect(mockUpdateOne.mock.calls[0][0]).toEqual({
      id: 'user_1',
      'dailyPracticeReminder.enabled': true,
      'dailyPracticeReminder.nextSendAt': dueSendAt,
    });
    expect(mockUpdateOne.mock.calls[0][1].$set['dailyPracticeReminder.nextSendAt']).toBeInstanceOf(Date);

    // Push call
    expect(mockSendPushToUser).toHaveBeenCalledWith('user_1', {
      title: 'Daily Practice 🐱',
      body: 'Your 30-minute daily practice is ready. Start now 🔥',
      route: '/',
      category: 'dailyPractice',
      centerKey: 'daily-practice:user_1:2026-09-07',
      data: {
        type: 'daily_practice',
        streak: 0,
        completedMinutes: 0,
        remainingMinutes: 30,
      },
    });

    // 2nd update: record sent result and lastSentAt
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual(
      expect.objectContaining({
        'dailyPracticeReminder.lastResult': 'sent',
        'dailyPracticeReminder.lastSentAt': expect.any(Date),
      })
    );
  });

  it('skips push and records goal-completed when user today study goal is already completed', async () => {
    const dueSendAt = new Date(Date.now() - 60_000);

    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyGoalMinutes: 30,
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          nextSendAt: dueSendAt,
        },
      },
    ]);

    mockGetStudyProgress.mockResolvedValueOnce({
      dateKey: '2026-09-07',
      activeSeconds: 1800,
      goalSeconds: 1800,
      goalComplete: true,
      streak: 3,
      completedMinutes: 30,
      remainingMinutes: 0,
    });

    // Atomic claim succeeds
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    // Skip update
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runDailyPracticeReminderWorkerOnce();

    // Should NOT send push
    expect(mockSendPushToUser).not.toHaveBeenCalled();

    // 2nd update marks goal-completed
    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual(
      expect.objectContaining({
        'dailyPracticeReminder.lastResult': 'goal-completed',
        'dailyPracticeReminder.lastSkippedAt': expect.any(Date),
      })
    );
  });

  it('records suppressed when push service returns suppressed', async () => {
    const dueSendAt = new Date(Date.now() - 60_000);

    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          nextSendAt: dueSendAt,
        },
      },
    ]);

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockSendPushToUser.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 0,
      suppressed: true,
    });
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runDailyPracticeReminderWorkerOnce();

    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual({
      'dailyPracticeReminder.lastResult': 'suppressed',
    });
  });

  it('skips push delivery if atomic claim fails (modifiedCount !== 1)', async () => {
    const dueSendAt = new Date(Date.now() - 60_000);

    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          nextSendAt: dueSendAt,
        },
      },
    ]);

    // Another worker already claimed it
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    await runDailyPracticeReminderWorkerOnce();

    expect(mockSendPushToUser).not.toHaveBeenCalled();
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
  });

  it('records failed and lastError when push throws an unexpected exception', async () => {
    const dueSendAt = new Date(Date.now() - 60_000);

    mockFindToArray.mockResolvedValueOnce([
      {
        id: 'user_1',
        dailyPracticeReminder: {
          enabled: true,
          time: '20:00',
          timezone: 'Asia/Kolkata',
          nextSendAt: dueSendAt,
        },
      },
    ]);

    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    mockSendPushToUser.mockRejectedValueOnce(new Error('Network failure'));
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await runDailyPracticeReminderWorkerOnce();

    expect(mockUpdateOne.mock.calls[1][1].$set).toEqual(
      expect.objectContaining({
        'dailyPracticeReminder.lastResult': 'failed',
        'dailyPracticeReminder.lastError': 'Network failure',
      })
    );
  });

  describe('buildDailyPracticeMessage', () => {
    it('formats message for streak >= 2 and partial progress', () => {
      const msg = buildDailyPracticeMessage({
        goalMinutes: 30,
        progress: {
          streak: 3,
          completedMinutes: 26,
          remainingMinutes: 4,
        },
      });
      expect(msg).toBe('🔥 3-day streak! Only 4 min left to finish today\'s goal.');
    });

    it('formats message for streak >= 2 and 0 progress', () => {
      const msg = buildDailyPracticeMessage({
        goalMinutes: 30,
        progress: {
          streak: 3,
          completedMinutes: 0,
          remainingMinutes: 30,
        },
      });
      expect(msg).toBe('Your 3-day streak is waiting 🔥 Start today\'s 30-minute practice.');
    });

    it('formats message for streak < 2 and partial progress', () => {
      const msg = buildDailyPracticeMessage({
        goalMinutes: 30,
        progress: {
          streak: 1,
          completedMinutes: 18,
          remainingMinutes: 12,
        },
      });
      expect(msg).toBe('You\'ve completed 18 of 30 min today. 12 min left.');
    });

    it('formats fallback message for no progress and no streak', () => {
      const msg = buildDailyPracticeMessage({
        goalMinutes: 30,
        progress: {
          streak: 0,
          completedMinutes: 0,
          remainingMinutes: 30,
        },
      });
      expect(msg).toBe('Your 30-minute daily practice is ready. Start now 🔥');
    });
  });
});
