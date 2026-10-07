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

it('aligns late arrivals to fixed boundaries and ignores old shared-window observations', () => {
  let now = 90;
  const store = new LocalRateLimitStore({ now: () => now });
  store.init({ windowMs: 100 });
  expect(store.increment('learner').resetTime.getTime()).toBe(100);
  store.observe('learner', { totalHits: 10, resetTime: new Date(100) });
  now = 110;
  expect(store.increment('learner')).toEqual({ totalHits: 1, resetTime: new Date(200) });
  store.observe('learner', { totalHits: 1, resetTime: new Date(200) });
  store.observe('learner', { totalHits: 11, resetTime: new Date(100) });
  expect(store.entries.get('learner').totalHits).toBe(1);
});
