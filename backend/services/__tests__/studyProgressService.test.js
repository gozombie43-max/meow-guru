import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindOne = vi.fn();
const mockFindToArray = vi.fn();

const mockCursor = {
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: (...args) => mockFindToArray(...args),
};

vi.mock('../../config/mongodb.js', () => ({
  getStudyActivityDailyCollection: () => ({
    findOne: (...args) => mockFindOne(...args),
    find: vi.fn(() => mockCursor),
  }),
}));

import { getStudyProgress } from '../studyProgressService.js';

describe('studyProgressService - getStudyProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates progress when today goal is incomplete', async () => {
    const fixedNow = new Date('2026-09-07T14:30:00.000Z');
    // Asia/Kolkata is UTC+5:30 -> 2026-09-07T20:00:00+05:30 -> todayKey = '2026-09-07'
    mockFindOne.mockResolvedValueOnce({
      userId: 'user_1',
      dateKey: '2026-09-07',
      activeSeconds: 1080, // 18 minutes
    });

    // Completed days in past: Sep 6, Sep 5, Sep 4 (3-day streak before today)
    mockFindToArray.mockResolvedValueOnce([
      { dateKey: '2026-09-06' },
      { dateKey: '2026-09-05' },
      { dateKey: '2026-09-04' },
    ]);

    const result = await getStudyProgress({
      userId: 'user_1',
      timezone: 'Asia/Kolkata',
      goalMinutes: 30,
      now: fixedNow,
    });

    expect(result).toEqual({
      dateKey: '2026-09-07',
      activeSeconds: 1080,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 3,
      completedMinutes: 18,
      remainingMinutes: 12,
      lastActivityAt: null,
    });
  });

  it('calculates progress and includes today in streak when today goal is completed', async () => {
    const fixedNow = new Date('2026-09-07T14:30:00.000Z');
    const updatedAt = new Date('2026-09-07T14:00:00.000Z');
    mockFindOne.mockResolvedValueOnce({
      userId: 'user_1',
      dateKey: '2026-09-07',
      activeSeconds: 1800, // 30 minutes
      updatedAt,
    });

    // Completed days: Sep 7, Sep 6, Sep 5
    mockFindToArray.mockResolvedValueOnce([
      { dateKey: '2026-09-07' },
      { dateKey: '2026-09-06' },
      { dateKey: '2026-09-05' },
    ]);

    const result = await getStudyProgress({
      userId: 'user_1',
      timezone: 'Asia/Kolkata',
      goalMinutes: 30,
      now: fixedNow,
    });

    expect(result).toEqual({
      dateKey: '2026-09-07',
      activeSeconds: 1800,
      goalSeconds: 1800,
      goalComplete: true,
      streak: 3,
      completedMinutes: 30,
      remainingMinutes: 0,
      lastActivityAt: updatedAt,
    });
  });

  it('returns 0 streak when there are no consecutive completed days', async () => {
    const fixedNow = new Date('2026-09-07T14:30:00.000Z');
    mockFindOne.mockResolvedValueOnce(null);
    mockFindToArray.mockResolvedValueOnce([]);

    const result = await getStudyProgress({
      userId: 'user_1',
      timezone: 'Asia/Kolkata',
      goalMinutes: 30,
      now: fixedNow,
    });

    expect(result).toEqual({
      dateKey: '2026-09-07',
      activeSeconds: 0,
      goalSeconds: 1800,
      goalComplete: false,
      streak: 0,
      completedMinutes: 0,
      remainingMinutes: 30,
      lastActivityAt: null,
    });
  });

  it('breaks streak when a day is skipped in past', async () => {
    const fixedNow = new Date('2026-09-07T14:30:00.000Z');
    mockFindOne.mockResolvedValueOnce(null);

    // Yesterday (Sep 6) done, but Sep 5 skipped, Sep 4 done
    mockFindToArray.mockResolvedValueOnce([
      { dateKey: '2026-09-06' },
      { dateKey: '2026-09-04' },
    ]);

    const result = await getStudyProgress({
      userId: 'user_1',
      timezone: 'Asia/Kolkata',
      goalMinutes: 30,
      now: fixedNow,
    });

    expect(result.streak).toBe(1);
    expect(result.goalComplete).toBe(false);
  });
});
