import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  listNoteImageObjects,
  purgeObjectVersions,
  claimNoteImageCleanup,
  isNoteImageReferenced,
  finishNoteImageCleanup,
  deferNoteImageCleanup,
  trackLegacyNoteImage,
} = vi.hoisted(() => ({
  listNoteImageObjects: vi.fn(),
  purgeObjectVersions: vi.fn(),
  claimNoteImageCleanup: vi.fn(),
  isNoteImageReferenced: vi.fn(),
  finishNoteImageCleanup: vi.fn(),
  deferNoteImageCleanup: vi.fn(),
  trackLegacyNoteImage: vi.fn(),
}));

let memoryCursor = null;

vi.mock('../../../infrastructure/objectStorage.js', () => ({
  listNoteImageObjects,
  purgeObjectVersions,
}));

vi.mock('../../../repositories/noteImageRepository.js', () => ({
  claimNoteImageCleanup,
  isNoteImageReferenced,
  finishNoteImageCleanup,
  deferNoteImageCleanup,
  trackLegacyNoteImage,
  noteImageInventoryCursor: vi.fn(async () => memoryCursor),
  saveNoteImageInventoryCursor: vi.fn(async (token, optionsOrDate = null) => {
    const normalizeDate = d => {
      if (d === null) return null;
      if (d instanceof Date) return Number.isFinite(d.getTime()) ? d : new Date();
      if (typeof d === 'number' && Number.isFinite(d) && d > 0) return new Date(d);
      if (typeof d === 'string' && d.trim()) {
        const parsed = new Date(d);
        if (Number.isFinite(parsed.getTime())) return parsed;
      }
      return d;
    };
    const isReset = Boolean(optionsOrDate?.reset);
    const sanitizedToken = isReset ? null : (typeof token === 'string' && token.trim() ? token.trim() : null);
    const isDateLike = val => val instanceof Date || (typeof val === 'number' && Number.isFinite(val) && val > 0);
    const completedAt = isDateLike(optionsOrDate)
      ? (sanitizedToken ? undefined : normalizeDate(optionsOrDate))
      : (optionsOrDate?.completedAt !== undefined
          ? normalizeDate(optionsOrDate.completedAt)
          : (isReset ? null : (sanitizedToken ? undefined : new Date())));
    memoryCursor = {
      _id: 'note-image-inventory',
      token: sanitizedToken,
      ...(completedAt !== undefined ? { completedAt } : (memoryCursor?.completedAt ? { completedAt: memoryCursor.completedAt } : {})),
    };
    return memoryCursor;
  }),
}));

import { cleanupNoteImages } from '../noteImageCleanup.js';

describe('noteImageCleanup B2 Type C transaction optimization', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    memoryCursor = null;
    process.env = { ...originalEnv };
    claimNoteImageCleanup.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('eliminates redundant B2 listing calls across repeated periodic cleanup ticks', async () => {
    const start = new Date('2026-11-05T12:00:00Z');

    // Initial run: B2 returns one page of legacy objects with no more pages
    listNoteImageObjects.mockResolvedValueOnce({
      Contents: [
        { Key: 'notes/images/pending/user1/image1.webp', LastModified: new Date(start.getTime() - 50 * 3600000) },
      ],
      NextContinuationToken: undefined,
    });

    // Tick 0: first run performs initial inventory pass
    await cleanupNoteImages(start);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
    expect(listNoteImageObjects).toHaveBeenCalledWith(undefined);
    expect(trackLegacyNoteImage).toHaveBeenCalledWith('notes/images/pending/user1/image1.webp', start);

    // Simulate 60 subsequent 1-minute periodic worker ticks without active usage
    for (let minute = 1; minute <= 60; minute++) {
      const tickTime = new Date(start.getTime() + minute * 60_000);
      await cleanupNoteImages(tickTime);
    }

    // Crucial check: listNoteImageObjects was NOT called during the 60 ticks!
    // Without the fix, this would have been called 61 times (1 call every minute).
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
  });

  it('correctly handles multi-page inventory continuation before throttling', async () => {
    // Page 1 has NextContinuationToken: 'cursor-token-page-2'
    listNoteImageObjects
      .mockResolvedValueOnce({
        Contents: [{ Key: 'notes/images/page1.webp', LastModified: new Date(0) }],
        NextContinuationToken: 'cursor-token-page-2',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'notes/images/page2.webp', LastModified: new Date(0) }],
        NextContinuationToken: undefined,
      });

    const t0 = new Date('2026-11-05T10:00:00Z');
    const t1 = new Date('2026-11-05T10:01:00Z');
    const t2 = new Date('2026-11-05T10:02:00Z');

    // Run 1: gets page 1, stores continuation token
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenNthCalledWith(1, undefined);
    expect(memoryCursor.token).toBe('cursor-token-page-2');
    expect(memoryCursor.completedAt).toBeUndefined();

    // Run 2: continues to page 2 using continuation token
    await cleanupNoteImages(t1);
    expect(listNoteImageObjects).toHaveBeenNthCalledWith(2, 'cursor-token-page-2');
    expect(memoryCursor.token).toBeNull();
    expect(memoryCursor.completedAt).toEqual(t1);

    // Run 3: now completed, should throttle
    await cleanupNoteImages(t2);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(2);
  });

  it('runs another inventory sweep once the configured interval has elapsed', async () => {
    listNoteImageObjects.mockResolvedValue({
      Contents: [],
      NextContinuationToken: undefined,
    });

    const start = new Date('2026-11-05T00:00:00Z');
    await cleanupNoteImages(start);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 23 hours later: still throttled
    const after23h = new Date(start.getTime() + 23 * 3600_000);
    await cleanupNoteImages(after23h);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 24 hours + 1 minute later: interval elapsed, new sweep permitted
    const after24h = new Date(start.getTime() + (24 * 3600_000 + 60_000));
    await cleanupNoteImages(after24h);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(2);
  });

  it('supports custom NOTE_IMAGE_INVENTORY_INTERVAL_MS environment variable', async () => {
    process.env.NOTE_IMAGE_INVENTORY_INTERVAL_MS = '5000'; // 5 seconds
    listNoteImageObjects.mockResolvedValue({
      Contents: [],
      NextContinuationToken: undefined,
    });

    const t0 = new Date(100_000);
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 3 seconds later: still throttled
    await cleanupNoteImages(new Date(103_000));
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 6 seconds later (> 5s): allowed
    await cleanupNoteImages(new Date(106_000));
    expect(listNoteImageObjects).toHaveBeenCalledTimes(2);
  });

  it('disables inventory listing entirely when NOTE_IMAGE_INVENTORY_ENABLED is false', async () => {
    process.env.NOTE_IMAGE_INVENTORY_ENABLED = 'false';
    await cleanupNoteImages(new Date());
    expect(listNoteImageObjects).not.toHaveBeenCalled();
  });

  it('processes unreferenced note image cleanup independently of inventory throttling', async () => {
    // Inventory already completed
    memoryCursor = {
      _id: 'note-image-inventory',
      token: null,
      completedAt: new Date(),
    };

    const staleRow = {
      _id: 'notes/images/pending/user/stale.webp',
      owner: 'test-owner',
    };

    claimNoteImageCleanup
      .mockResolvedValueOnce(staleRow)
      .mockResolvedValueOnce(null);
    isNoteImageReferenced.mockResolvedValueOnce(false);

    const removed = await cleanupNoteImages(new Date());

    expect(removed).toBe(1);
    expect(purgeObjectVersions).toHaveBeenCalledWith(staleRow._id);
    expect(finishNoteImageCleanup).toHaveBeenCalledWith(staleRow);
    // B2 listing is still completely bypassed
    expect(listNoteImageObjects).not.toHaveBeenCalled();
  });

  it('retries inventory on next tick if B2 listing throws an error', async () => {
    listNoteImageObjects
      .mockRejectedValueOnce(new Error('B2 rate limited'))
      .mockResolvedValueOnce({
        Contents: [],
        NextContinuationToken: undefined,
      });

    const t0 = new Date('2026-11-05T12:00:00Z');
    // First run fails
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
    expect(memoryCursor).toBeNull(); // completion was NOT recorded

    // Second run retries and succeeds
    const t1 = new Date('2026-11-05T12:01:00Z');
    await cleanupNoteImages(t1);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(2);
    expect(memoryCursor?.completedAt).toEqual(t1);
  });

  it('preserves existing completedAt across multi-page sweep until full completion', async () => {
    const tPrev = new Date('2026-11-04T08:00:00Z');
    memoryCursor = {
      _id: 'note-image-inventory',
      token: null,
      completedAt: tPrev,
    };

    listNoteImageObjects
      .mockResolvedValueOnce({
        Contents: [{ Key: 'notes/images/p1.webp', LastModified: new Date(0) }],
        NextContinuationToken: 'page-token-2',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'notes/images/p2.webp', LastModified: new Date(0) }],
        NextContinuationToken: undefined,
      });

    // 25 hours later: new sweep begins
    const t0 = new Date('2026-11-05T09:00:00Z');
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
    expect(memoryCursor.token).toBe('page-token-2');
    // Prior completedAt is retained, not prematurely set to t0
    expect(memoryCursor.completedAt).toEqual(tPrev);

    // 1 minute later: page 2 is fetched without throttling despite existing completedAt
    const t1 = new Date('2026-11-05T09:01:00Z');
    await cleanupNoteImages(t1);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(2);
    expect(memoryCursor.token).toBeNull();
    // Only once page 2 finishes is completedAt updated to t1
    expect(memoryCursor.completedAt).toEqual(t1);
  });

  it('resets cursor and does not enter infinite failure loop on InvalidContinuationToken', async () => {
    memoryCursor = {
      _id: 'note-image-inventory',
      token: 'stale-corrupt-token',
      completedAt: new Date('2026-11-04T00:00:00Z'),
    };

    const invalidTokenError = new Error('The continuation token provided is invalid');
    invalidTokenError.name = 'InvalidContinuationToken';

    listNoteImageObjects
      .mockRejectedValueOnce(invalidTokenError)
      .mockResolvedValueOnce({
        Contents: [],
        NextContinuationToken: undefined,
      });

    const t0 = new Date('2026-11-05T12:00:00Z');
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledWith('stale-corrupt-token');
    // Cursor was reset: token and completedAt cleared
    expect(memoryCursor.token).toBeNull();
    expect(memoryCursor.completedAt).toBeNull();

    // Next tick recovers with fresh start (token: undefined)
    const t1 = new Date('2026-11-05T12:01:00Z');
    await cleanupNoteImages(t1);
    expect(listNoteImageObjects).toHaveBeenNthCalledWith(2, undefined);
    expect(memoryCursor.completedAt).toEqual(t1);
  });

  it('resets cursor on B2 InvalidArgument error containing continuation token message', async () => {
    memoryCursor = {
      _id: 'note-image-inventory',
      token: 'expired-b2-token',
      completedAt: new Date('2026-11-04T00:00:00Z'),
    };

    const b2InvalidArgumentError = new Error('The continuation token provided is incorrect');
    b2InvalidArgumentError.name = 'InvalidArgument';

    listNoteImageObjects
      .mockRejectedValueOnce(b2InvalidArgumentError)
      .mockResolvedValueOnce({
        Contents: [],
        NextContinuationToken: undefined,
      });

    const t0 = new Date('2026-11-05T12:00:00Z');
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledWith('expired-b2-token');
    expect(memoryCursor.token).toBeNull();
    expect(memoryCursor.completedAt).toBeNull();

    const t1 = new Date('2026-11-05T12:01:00Z');
    await cleanupNoteImages(t1);
    expect(listNoteImageObjects).toHaveBeenNthCalledWith(2, undefined);
  });

  it('resets cursor on error with code property set to InvalidContinuationToken', async () => {
    memoryCursor = {
      _id: 'note-image-inventory',
      token: 'corrupt-token-code',
      completedAt: new Date('2026-11-04T00:00:00Z'),
    };

    const tokenError = new Error('Bad token');
    tokenError.code = 'InvalidContinuationToken';

    listNoteImageObjects
      .mockRejectedValueOnce(tokenError)
      .mockResolvedValueOnce({
        Contents: [],
        NextContinuationToken: undefined,
      });

    await cleanupNoteImages(new Date('2026-11-05T12:00:00Z'));
    expect(memoryCursor.token).toBeNull();
    expect(memoryCursor.completedAt).toBeNull();
  });

  it.each(['', '   ', '0', '-5000', 'not-a-number'])('safely falls back to 24-hour default when NOTE_IMAGE_INVENTORY_INTERVAL_MS is %j', async (badValue) => {
    process.env.NOTE_IMAGE_INVENTORY_INTERVAL_MS = badValue;
    listNoteImageObjects.mockResolvedValue({
      Contents: [],
      NextContinuationToken: undefined,
    });

    const t0 = new Date('2026-11-05T12:00:00Z');
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 1 minute later: MUST still be throttled by 24h default (without bug, bad value would make interval 0)
    const t1 = new Date(t0.getTime() + 60_000);
    await cleanupNoteImages(t1);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 23 hours later: still throttled
    const t23h = new Date(t0.getTime() + 23 * 3600_000);
    await cleanupNoteImages(t23h);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
  });

  it('tracks legacy objects when LastModified is provided as an ISO string', async () => {
    const start = new Date('2026-11-05T12:00:00Z');
    const oldDateString = new Date(start.getTime() - 50 * 3600000).toISOString();

    listNoteImageObjects.mockResolvedValueOnce({
      Contents: [
        { Key: 'notes/images/pending/user/string-date.webp', LastModified: oldDateString },
      ],
      NextContinuationToken: undefined,
    });

    await cleanupNoteImages(start);
    expect(trackLegacyNoteImage).toHaveBeenCalledWith('notes/images/pending/user/string-date.webp', start);
  });

  it.each(['FALSE', 'False', ' false ', '0', ' 0 '])('disables inventory listing when NOTE_IMAGE_INVENTORY_ENABLED is %j', async (flag) => {
    process.env.NOTE_IMAGE_INVENTORY_ENABLED = flag;
    await cleanupNoteImages(new Date());
    expect(listNoteImageObjects).not.toHaveBeenCalled();
  });

  it('safely handles cleanupNoteImages called with an Invalid Date without throwing', async () => {
    listNoteImageObjects.mockResolvedValueOnce({
      Contents: [],
      NextContinuationToken: undefined,
    });

    const invalidDate = new Date('invalid');
    await expect(cleanupNoteImages(invalidDate)).resolves.not.toThrow();
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
    expect(memoryCursor.completedAt).toBeInstanceOf(Date);
    expect(Number.isFinite(memoryCursor.completedAt.getTime())).toBe(true);
  });

  it('safely handles nullish or malformed responses from listNoteImageObjects', async () => {
    listNoteImageObjects.mockResolvedValueOnce(null);
    await expect(cleanupNoteImages(new Date())).resolves.not.toThrow();
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);
  });

  it('supports numeric process.env.NOTE_IMAGE_INVENTORY_INTERVAL_MS without crashing', async () => {
    process.env.NOTE_IMAGE_INVENTORY_INTERVAL_MS = 10_000;
    listNoteImageObjects.mockResolvedValue({
      Contents: [],
      NextContinuationToken: undefined,
    });

    const t0 = new Date(100_000);
    await cleanupNoteImages(t0);
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 5 seconds later: throttled
    await cleanupNoteImages(new Date(105_000));
    expect(listNoteImageObjects).toHaveBeenCalledTimes(1);

    // 11 seconds later (> 10s): allowed
    await cleanupNoteImages(new Date(111_000));
    expect(listNoteImageObjects).toHaveBeenCalledTimes(2);
  });

  it.each([false, 0, 'off', 'no', 'OFF', 'NO'])('disables inventory listing when NOTE_IMAGE_INVENTORY_ENABLED is non-string or flag %j', async (flag) => {
    process.env.NOTE_IMAGE_INVENTORY_ENABLED = flag;
    await cleanupNoteImages(new Date());
    expect(listNoteImageObjects).not.toHaveBeenCalled();
  });

  it('resets cursor when continuation token error is wrapped inside error.cause', async () => {
    memoryCursor = {
      _id: 'note-image-inventory',
      token: 'nested-token',
      completedAt: new Date('2026-11-04T00:00:00Z'),
    };

    const innerError = new Error('The continuation token provided is incorrect');
    innerError.name = 'InvalidArgument';
    const wrappedError = new Error('Storage wrapper failed', { cause: innerError });

    listNoteImageObjects
      .mockRejectedValueOnce(wrappedError)
      .mockResolvedValueOnce({
        Contents: [],
        NextContinuationToken: undefined,
      });

    await cleanupNoteImages(new Date('2026-11-05T12:00:00Z'));
    expect(memoryCursor.token).toBeNull();
    expect(memoryCursor.completedAt).toBeNull();
  });
});


