import { describe, expect, it, vi } from 'vitest';
import { up } from '../001-existing-indexes.js';

describe('existing index migration', () => {
  it('serializes index builds so they cannot exhaust the connection pool', async () => {
    let active = 0;
    let maximumActive = 0;
    const createIndex = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active -= 1;
    });
    const db = { collection: vi.fn(() => ({ createIndex })) };

    await up(db);

    expect(createIndex).toHaveBeenCalledTimes(92);
    expect(maximumActive).toBe(1);
  });

  it('continues after a failed build and reports all failures together', async () => {
    let call = 0;
    const createIndex = vi.fn(async () => {
      call += 1;
      if (call === 2 || call === 4) throw new Error(`failure-${call}`);
    });
    const db = { collection: vi.fn(() => ({ createIndex })) };

    const error = await up(db).catch(reason => reason);

    expect(error).toBeInstanceOf(AggregateError);
    expect(error.errors.map(reason => reason.message)).toEqual(['failure-2', 'failure-4']);
    expect(createIndex).toHaveBeenCalledTimes(92);
  });
});
