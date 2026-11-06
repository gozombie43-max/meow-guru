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

it('serves fresh L1 entries past localMs with zero Redis reads until invalidated', async () => {
  let time = 1000;
  const getShared = vi.fn(async key => shared.get(key) ?? null);
  const setShared = vi.fn(async (key, value) => { shared.set(key, value); return true; });
  const evalSpy = vi.fn(async () => 1);
  vi.mocked(getRedisClient).mockResolvedValue({ eval: evalSpy });
  const cache = createTieredCache({ freshMs: 300000, staleMs: 600000, localMs: 10000, now: () => time, random: () => 0.5, getShared, setShared });

  expect(await cache.read('hot', async () => ({ ok: 1 }))).toEqual({ ok: 1 });
  // Cold miss: 1 getShared check (no duplicate after lock acquire) and 1 acquireLease eval (release skipped when setShared === true).
  expect(getShared).toHaveBeenCalledTimes(1);
  expect(evalSpy).toHaveBeenCalledTimes(1);

  for (const offset of [5000, 15000, 60000, 200000]) {
    time = 1000 + offset;
    expect(await cache.read('hot', () => { throw new Error('Should hit L1'); })).toEqual({ ok: 1 });
  }
  expect(getShared).toHaveBeenCalledTimes(1);
  expect(evalSpy).toHaveBeenCalledTimes(1);

  clearSharedLocalCaches();
  expect(await cache.read('hot', () => { throw new Error('Should hit Redis'); })).toEqual({ ok: 1 });
  expect(getShared).toHaveBeenCalledTimes(2);
});

it('accepts both raw values and shared envelopes in prime() and releases locks on build failure', async () => {
  let time = 1000;
  const getShared = vi.fn(async () => null);
  const evalSpy = vi.fn(async () => 1);
  vi.mocked(getRedisClient).mockResolvedValue({ eval: evalSpy });
  const cache = createTieredCache({ freshMs: 60000, staleMs: 60000, now: () => time, random: () => 0.5, getShared });

  cache.prime('raw-primed', { subject: 'mathematics', totals: { algebra: 5 } });
  expect(cache.hasFresh('raw-primed')).toBe(true);
  expect(await cache.read('raw-primed', () => { throw new Error('Unexpected build'); })).toEqual({ subject: 'mathematics', totals: { algebra: 5 } });
  expect(getShared).not.toHaveBeenCalled();

  cache.prime('envelope-primed', { value: 42, freshUntil: 1050, staleUntil: 1100 });
  expect(cache.hasFresh('envelope-primed')).toBe(true);
  time = 1060;
  expect(cache.hasFresh('envelope-primed')).toBe(false);

  await expect(cache.read('failing-build', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  // 1 acquireLease + 1 releaseLease on failed build
  expect(evalSpy).toHaveBeenCalledTimes(2);
});

it('throttles stale Redis probes by localMs on miss and supports lock-free and L1-only modes', async () => {
  let time = 1000;
  const getShared = vi.fn(async () => null);
  const setShared = vi.fn(async () => true);
  const evalSpy = vi.fn(async () => 1);
  vi.mocked(getRedisClient).mockResolvedValue({ eval: evalSpy });

  const staleCache = createTieredCache({ freshMs: 100, staleMs: 50000, localMs: 10000, now: () => time, random: () => 0.5, getShared, setShared });
  await staleCache.read('stale-key', async () => 'v1');
  getShared.mockClear();

  time = 15000;
  const failing = vi.fn(async () => { throw new Error('down'); });
  expect(await staleCache.read('stale-key', failing)).toBe('v1');
  await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
  const probesAfterFirstStale = getShared.mock.calls.length;
  time = 16000;
  expect(await staleCache.read('stale-key', failing)).toBe('v1');
  // Within localMs (10s), read() must not probe getShared before returning stale value.
  expect(getShared.mock.calls.length).toBe(probesAfterFirstStale);

  evalSpy.mockClear(); getShared.mockClear(); setShared.mockClear();
  const unlocked = createTieredCache({ distributedLock: false, now: () => time, getShared, setShared });
  expect(await unlocked.read('u1', async () => ({ progress: [] }))).toEqual({ progress: [] });
  expect(await unlocked.read('u1', () => { throw new Error('L1 miss'); })).toEqual({ progress: [] });
  expect(evalSpy).not.toHaveBeenCalled();
  expect(getShared).toHaveBeenCalledTimes(1);
  expect(setShared).toHaveBeenCalledTimes(1);

  getShared.mockClear(); setShared.mockClear();
  expect(await unlocked.read('local-only', async () => 99, { cacheShared: false })).toBe(99);
  expect(await unlocked.read('local-only', () => { throw new Error('L1 miss'); }, { cacheShared: false })).toBe(99);
  expect(getShared).not.toHaveBeenCalled();
  expect(setShared).not.toHaveBeenCalled();
});

it('throttles background SWR lock acquisitions when cold L1 loads a stale shared envelope and build fails', async () => {
  let time = 15_000;
  const staleEnvelope = { value: 'stale-shared', freshUntil: 1_100, staleUntil: 50_000 };
  const getShared = vi.fn(async () => ({ ...staleEnvelope }));
  const setShared = vi.fn(async () => true);
  const evalSpy = vi.fn(async () => 1);
  vi.mocked(getRedisClient).mockResolvedValue({ eval: evalSpy });

  const cache = createTieredCache({
    freshMs: 100,
    staleMs: 50_000,
    localMs: 10_000,
    now: () => time,
    random: () => 0.5,
    getShared,
    setShared,
  });

  const failing = vi.fn(async () => { throw new Error('upstream failure'); });

  // First read on cold L1 loads stale envelope from Redis and triggers 1 background refresh (acquire + release).
  expect(await cache.read('swr-shared', failing)).toBe('stale-shared');
  await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
  expect(getShared).toHaveBeenCalledTimes(1);
  expect(evalSpy).toHaveBeenCalledTimes(2);

  // Subsequent reads within localMs (10s) must hit L1 and respect refreshNotBefore on the stored L1 entry.
  for (const nextTime of [15_100, 18_000, 24_999]) {
    time = nextTime;
    expect(await cache.read('swr-shared', failing)).toBe('stale-shared');
  }
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(failing).toHaveBeenCalledTimes(1);
  expect(getShared).toHaveBeenCalledTimes(1);
  expect(evalSpy).toHaveBeenCalledTimes(2);
});

