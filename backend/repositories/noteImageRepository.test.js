import { describe, it, expect, vi, beforeEach } from 'vitest';

const updateOne = vi.fn(async () => ({ matchedCount: 1, upsertedCount: 0 }));
const findOne = vi.fn(async () => null);

const mockDb = {
  collection: vi.fn(name => {
    if (name === 'runtimeMaintenance') {
      return { updateOne, findOne };
    }
    return {};
  }),
};

vi.mock('../config/mongodb.js', () => ({
  getMongoDB: () => mockDb,
  getNotesCollection: () => ({}),
}));

import { saveNoteImageInventoryCursor, noteImageInventoryCursor } from './noteImageRepository.js';

describe('noteImageRepository inventory cursor persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries the runtimeMaintenance collection for cursor', async () => {
    findOne.mockResolvedValueOnce({ _id: 'note-image-inventory', token: 'tok', completedAt: new Date(1000) });
    const cursor = await noteImageInventoryCursor();
    expect(mockDb.collection).toHaveBeenCalledWith('runtimeMaintenance');
    expect(findOne).toHaveBeenCalledWith({ _id: 'note-image-inventory' });
    expect(cursor).toEqual({ _id: 'note-image-inventory', token: 'tok', completedAt: new Date(1000) });
  });

  it('persists continuation token without overwriting completedAt when token is present', async () => {
    await saveNoteImageInventoryCursor('next-page-token');
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: 'next-page-token' } },
      { upsert: true }
    );
  });

  it('does not overwrite completedAt when token is present even if a Date is passed', async () => {
    const passedDate = new Date('2026-11-05T12:00:00Z');
    await saveNoteImageInventoryCursor('next-page-token', passedDate);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: 'next-page-token' } },
      { upsert: true }
    );
  });

  it('persists completedAt when listing finishes (token is undefined/null)', async () => {
    const completionTime = new Date('2026-11-05T15:00:00Z');
    await saveNoteImageInventoryCursor(undefined, completionTime);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: null, completedAt: completionTime } },
      { upsert: true }
    );
  });

  it('supports explicit reset option to clear completedAt and token', async () => {
    await saveNoteImageInventoryCursor(null, { reset: true });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: null, completedAt: null } },
      { upsert: true }
    );
  });

  it('defaults completedAt to current date if not provided and token is null', async () => {
    const before = new Date();
    await saveNoteImageInventoryCursor(null);
    const after = new Date();
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: null, completedAt: expect.any(Date) } },
      { upsert: true }
    );
    const savedDate = updateOne.mock.calls[0][1].$set.completedAt;
    expect(+savedDate).toBeGreaterThanOrEqual(+before);
    expect(+savedDate).toBeLessThanOrEqual(+after);
  });

  it('normalizes Invalid Date instances to a valid Date instead of persisting NaN date', async () => {
    const invalidDate = new Date('invalid-date-string');
    await saveNoteImageInventoryCursor(null, invalidDate);
    const savedDate = updateOne.mock.calls[0][1].$set.completedAt;
    expect(savedDate).toBeInstanceOf(Date);
    expect(Number.isFinite(savedDate.getTime())).toBe(true);
  });

  it('resets token to null even if token argument is provided when reset: true', async () => {
    await saveNoteImageInventoryCursor('stale-token', { reset: true });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: null, completedAt: null } },
      { upsert: true }
    );
  });

  it('sanitizes empty string and whitespace tokens to null', async () => {
    await saveNoteImageInventoryCursor('   ', new Date('2026-11-05T12:00:00Z'));
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'note-image-inventory' },
      { $set: { token: null, completedAt: new Date('2026-11-05T12:00:00Z') } },
      { upsert: true }
    );
  });

  it('normalizes numeric timestamps and string ISO dates to Date instances', async () => {
    const timestamp = 1762344000000;
    await saveNoteImageInventoryCursor(null, timestamp);
    const savedDate = updateOne.mock.calls[0][1].$set.completedAt;
    expect(savedDate).toBeInstanceOf(Date);
    expect(savedDate.getTime()).toBe(timestamp);
  });
});

