import { describe, expect, it, vi } from 'vitest';
import { up } from '../003-production-hardening.js';

describe('003 production hardening migration', () => {
  it('creates integrity, history, and expiry indexes', async () => {
    const calls = [];
    const db = {
      collection: vi.fn((collection) => ({
        createIndex: vi.fn(async (keys, options) => {
          calls.push({ collection, keys, options });
        }),
      })),
    };

    await up(db);

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        collection: 'mockSlots',
        keys: { examSlug: 1, id: 1 },
        options: expect.objectContaining({ unique: true }),
      }),
      expect.objectContaining({
        collection: 'mockAttempts',
        keys: { id: 1 },
        options: expect.objectContaining({ unique: true }),
      }),
      expect.objectContaining({
        collection: 'adaptiveQuizSessions',
        keys: { expiresAt: 1 },
        options: expect.objectContaining({ expireAfterSeconds: 0 }),
      }),
      expect.objectContaining({
        collection: 'registrationLocks',
        keys: { createdAt: 1 },
        options: expect.objectContaining({ expireAfterSeconds: 900 }),
      }),
    ]));
  });
});
