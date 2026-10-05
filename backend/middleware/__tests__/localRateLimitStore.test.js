import { expect, it } from 'vitest';
import { LocalRateLimitStore } from '../localRateLimitStore.js';

it('rejects new keys at capacity without erasing existing limits and reclaims expired keys', () => {
  let now = 0;
  const store = new LocalRateLimitStore({ maxKeys: 1, now: () => now });
  store.init({ windowMs: 100 });
  expect(store.increment('a').totalHits).toBe(1);
  expect(store.increment('b').totalHits).toBe(Number.MAX_SAFE_INTEGER);
  expect(store.increment('a').totalHits).toBe(2);
  now = 101;
  expect(store.increment('b').totalHits).toBe(1);
  expect(store.entries.size).toBe(1);
});
