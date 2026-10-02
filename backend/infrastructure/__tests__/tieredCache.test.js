import { beforeEach, expect, it, vi } from 'vitest';
const shared = vi.hoisted(() => new Map());
vi.mock('../../config/redis.js', () => ({ getRedisClient: async () => null, redisKey: key => key, redisGetJson: async key => shared.get(key) ?? null, redisSetJson: async (key, value) => { shared.set(key, value); } }));
import { createTieredCache, clearSharedLocalCaches } from '../tieredCache.js';
beforeEach(() => { shared.clear(); clearSharedLocalCaches(); });
it('coalesces cold misses and shares results across local cache instances', async () => {
  const a = createTieredCache(), b = createTieredCache();
  const build = vi.fn(async () => ({ counts: 3 }));
  await Promise.all(Array.from({ length: 100 }, () => a.read('key', build)));
  expect(build).toHaveBeenCalledTimes(1);
  expect(await b.read('key', build)).toEqual({ counts: 3 });
  expect(build).toHaveBeenCalledTimes(1);
});
it('serves stale metadata during failures, respects expiry and isolates revisions', async () => {
  let time = 0;
  const cache = createTieredCache({ freshMs: 100, staleMs: 1000, now: () => time, random: () => 0.5 });
  expect(await cache.read('revision:1', async () => 10)).toBe(10);
  time = 200;
  const failing = vi.fn(async () => { throw new Error('Mongo unavailable'); });
  expect(await cache.read('revision:1', failing)).toBe(10);
  await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
  expect(await cache.read('revision:2', async () => 11)).toBe(11);
  time = 2000;
  await expect(cache.read('revision:1', failing)).rejects.toThrow('Mongo unavailable');
});
