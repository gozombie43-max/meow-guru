import { beforeEach, expect, it, vi } from 'vitest';
const shared = vi.hoisted(() => new Map());
vi.mock('../../config/redis.js', () => ({ getRedisClient: vi.fn(async () => ({ eval: async () => 1 })), redisKey: key => key, redisGetJson: async key => shared.get(key) ?? null, redisSetJson: async (key, value) => { shared.set(key, value); } }));
import { createTieredCache, clearSharedLocalCaches } from '../tieredCache.js';
import { getRedisClient } from '../../config/redis.js';
beforeEach(() => { shared.clear(); clearSharedLocalCaches(); vi.mocked(getRedisClient).mockReset().mockResolvedValue({ eval: async () => 1 }); });
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

it('expires negative results sooner and preserves a source deadline across cache instances', async () => {
  let time = 1000;
  const options = { freshMs: 300000, staleMs: 300000, now: () => time, random: () => 0.5 };
  const first = createTieredCache(options), second = createTieredCache(options);
  const build = vi.fn(async () => []);
  expect(await first.read('empty', build)).toEqual([]);
  time = 5999;
  expect(await second.read('empty', build)).toEqual([]);
  time = 6001;
  expect(await second.read('empty', async () => [1], { allowStale: false })).toEqual([1]);
  expect(build).toHaveBeenCalledTimes(1);
  const bounded = createTieredCache({ ...options, validUntil: value => value.deadline });
  expect(await bounded.read('aged', async () => ({ deadline: 6100, value: 1 }))).toEqual({ deadline: 6100, value: 1 });
  time = 6101;
  expect(await bounded.read('aged', async () => ({ deadline: 7000, value: 2 }))).toEqual({ deadline: 7000, value: 2 });
});

it('returns oversized source values without retaining them in either cache layer', async () => {
  const cache = createTieredCache({ maxEntryBytes: 100 });
  const build = vi.fn(async () => 'x'.repeat(200));
  await cache.read('large', build); await cache.read('large', build);
  expect(build).toHaveBeenCalledTimes(2);
});

it.each(['offline', 'unknown-lease'])('never publishes without a lease when Redis recovers during a %s build', async kind => {
  vi.mocked(getRedisClient).mockResolvedValueOnce(kind === 'offline' ? null : { eval: async () => { throw new Error('Lost acquisition response'); } });
  const publish = vi.fn(), cache = createTieredCache({ setShared: publish });
  expect(await cache.read('recovering', async () => {
    // Simulate another instance publishing while this builder was on Mongo.
    shared.set('tiered:v2:recovering', { value: 2, freshUntil: Date.now() + 300000, staleUntil: Date.now() + 300000 });
    return 1;
  })).toBe(1);
  expect(publish).not.toHaveBeenCalled();
  expect(shared.get('tiered:v2:recovering').value).toBe(2);
});
