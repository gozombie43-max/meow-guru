import { beforeEach, expect, it, vi } from 'vitest';

const { redis, fallback, getRedisClient } = vi.hoisted(() => ({
  redis: { eval: vi.fn(), del: vi.fn() },
  fallback: { init: vi.fn(), increment: vi.fn(), decrement: vi.fn(), resetKey: vi.fn() },
  getRedisClient: vi.fn(),
}));
vi.mock('../../config/redis.js', () => ({ getRedisClient, redisKey: key => `test:${key}`, reportRedisFailure: vi.fn() }));
vi.mock('../mongoRateLimitStore.js', () => ({ MongoRateLimitStore: class { constructor() { return fallback; } } }));

import { RedisRateLimitStore } from '../redisRateLimitStore.js';
it('preserves quiz allowances while retaining conservative authentication limits during outages', async () => {
  getRedisClient.mockResolvedValue(null);
  const quiz = new RedisRateLimitStore('training', { outagePolicy: 'availability' });
  const auth = new RedisRateLimitStore('auth');
  quiz.init({ windowMs: 9000 }); auth.init({ windowMs: 9000 });
  expect((await quiz.increment('learner')).totalHits).toBe(1);
  expect((await auth.increment('ip')).totalHits).toBe(2);
});

beforeEach(() => {
  vi.clearAllMocks();
  getRedisClient.mockResolvedValue(redis);
  redis.eval.mockImplementation(async () => [3, 8000, Date.now() + 8000]);
  fallback.increment.mockResolvedValue({ totalHits: 2, resetTime: new Date(1000) });
});

it('uses a namespaced hashed Redis key and returns the atomic count and reset time', async () => {
  const store = new RedisRateLimitStore('auth');
  store.init({ windowMs: 9000 });
  const before = Date.now();
  const result = await store.increment('user@example.com');
  expect(result.totalHits).toBe(3);
  expect(result.resetTime.getTime()).toBeGreaterThanOrEqual(before + 8000);
  expect(redis.eval.mock.calls[0][1]).toEqual({
    keys: [expect.stringMatching(/^test:rate:v2:auth:[a-f0-9]{64}$/)], arguments: ['9000'],
  });
  expect(fallback.increment).not.toHaveBeenCalled();
});

it('uses the new shared window after rollover and recovery despite larger local counts', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(8000);
  const store = new RedisRateLimitStore('training');
  store.init({ windowMs: 9000 });
  redis.eval.mockResolvedValueOnce([10, 1000, 9000]);
  expect((await store.increment('learner')).totalHits).toBe(10);
  getRedisClient.mockResolvedValueOnce(null);
  expect((await store.increment('learner')).totalHits).toBe(22);
  clock.mockReturnValue(9001);
  redis.eval.mockResolvedValueOnce([1, 8999, 18000]);
  expect((await store.increment('learner')).totalHits).toBe(1);
  expect(store.fallback.entries.get('learner').totalHits).toBe(1);
  clock.mockRestore();
});

it('uses conservative local counts without MongoDB on Redis failure', async () => {
  const store = new RedisRateLimitStore('auth');
  store.init({ windowMs: 9000 });
  getRedisClient.mockResolvedValueOnce(null);
  expect((await store.increment('ip')).totalHits).toBe(2);
  redis.eval.mockRejectedValueOnce(new Error('connection lost'));
  expect((await store.increment('ip')).totalHits).toBe(4);
  expect(fallback.increment).not.toHaveBeenCalled();
});

it('decrements in Redis and clears both backends on reset', async () => {
  const store = new RedisRateLimitStore('upload');
  store.init({ windowMs: 9000 });
  await store.decrement('ip');
  await store.resetKey('ip');
  expect(redis.eval).toHaveBeenCalledTimes(1);
  expect(redis.del).toHaveBeenCalledTimes(1);
  expect(store.fallback.entries.size).toBe(0);
  expect(fallback.resetKey).not.toHaveBeenCalled();
});

it('preserves exact distributed counts across instances for every allowed request and blocks post-limit floods locally without PTTL overhead', async () => {
  const baseNow = 10_000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(baseNow);
  const a = new RedisRateLimitStore('auth');
  const b = new RedisRateLimitStore('auth');
  a.init({ windowMs: 60_000, limit: 3 });
  b.init({ windowMs: 60_000, limit: 3 });

  let counter = 0;
  redis.eval.mockImplementation(async (script) => {
    expect(script).not.toContain('PTTL');
    counter++;
    return [counter, 50_000, 60_000];
  });

  // Every allowed request across instances A and B increments the shared Redis counter by 1.
  expect((await a.increment('attacker')).totalHits).toBe(1);
  expect((await b.increment('attacker')).totalHits).toBe(2);
  expect((await a.increment('attacker')).totalHits).toBe(3);
  expect(redis.eval).toHaveBeenCalledTimes(3);

  for (let i = 0; i < 25; i++) {
    expect((await a.increment('attacker')).totalHits).toBeGreaterThan(3);
  }
  // Flood traffic on instance A after hitting limit=3 does not touch Redis.
  expect(redis.eval).toHaveBeenCalledTimes(3);

  // Window rollover clears local block and consults Redis again.
  clock.mockReturnValue(60_001);
  counter = 0;
  redis.eval.mockImplementation(async () => [++counter, 59_999, 120_000]);
  expect((await a.increment('attacker')).totalHits).toBe(1);
  expect(redis.eval).toHaveBeenCalledTimes(4);

  // Decrement invalidates a cached block.
  redis.eval.mockImplementationOnce(async () => [3, 59_000, 120_000]);
  await a.increment('attacker');
  await a.decrement('attacker');
  redis.eval.mockClear();
  redis.eval.mockImplementationOnce(async () => [3, 58_000, 120_000]);
  expect((await a.increment('attacker')).totalHits).toBe(3);
  expect(redis.eval).toHaveBeenCalledTimes(1);
  clock.mockRestore();
});

it('bounds local block lifetime using Redis remaining window ms under positive and negative clock skew', async () => {
  const storeAhead = new RedisRateLimitStore('auth');
  storeAhead.init({ windowMs: 60_000, limit: 1 });

  // Local clock is +2s ahead of Redis TIME (local=60_500, Redis=58_500, sharedResetAt=60_000, remaining=1_500ms).
  const clock = vi.spyOn(Date, 'now').mockReturnValue(60_500);
  redis.eval.mockResolvedValueOnce([1, 1_500, 60_000]);
  expect((await storeAhead.increment('skew-ahead')).totalHits).toBe(1);
  expect(redis.eval).toHaveBeenCalledTimes(1);

  clock.mockReturnValue(61_500); // 1,000ms elapsed (< 1,500ms remaining) -> still blocked locally
  expect((await storeAhead.increment('skew-ahead')).totalHits).toBe(2);
  expect(redis.eval).toHaveBeenCalledTimes(1);

  clock.mockReturnValue(62_001); // > 1,500ms elapsed -> block expired, consults Redis again
  redis.eval.mockResolvedValueOnce([1, 59_999, 120_000]);
  expect((await storeAhead.increment('skew-ahead')).totalHits).toBe(1);
  expect(redis.eval).toHaveBeenCalledTimes(2);

  // Local clock is -2s behind Redis TIME (local=57_500, Redis=59_500, sharedResetAt=60_000, remaining=500ms).
  const storeBehind = new RedisRateLimitStore('auth');
  storeBehind.init({ windowMs: 60_000, limit: 1 });
  redis.eval.mockClear();
  clock.mockReturnValue(57_500);
  redis.eval.mockResolvedValueOnce([1, 500, 60_000]);
  expect((await storeBehind.increment('skew-behind')).totalHits).toBe(1);

  clock.mockReturnValue(57_900); // 400ms elapsed -> still blocked locally
  expect((await storeBehind.increment('skew-behind')).totalHits).toBe(2);
  expect(redis.eval).toHaveBeenCalledTimes(1);

  clock.mockReturnValue(58_001); // 501ms elapsed -> Redis window already rolled over, must NOT keep blocking until local 60_000!
  redis.eval.mockResolvedValueOnce([1, 59_999, 120_000]);
  expect((await storeBehind.increment('skew-behind')).totalHits).toBe(1);
  expect(redis.eval).toHaveBeenCalledTimes(2);
  clock.mockRestore();
});

it('does not prematurely local-block on the limit-th allowed hit when skipFailedRequests is enabled', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(10_000);
  const a = new RedisRateLimitStore('auth');
  const b = new RedisRateLimitStore('auth');
  a.init({ windowMs: 60_000, limit: 3, skipFailedRequests: true });
  b.init({ windowMs: 60_000, limit: 3, skipFailedRequests: true });

  let sharedCounter = 0;
  redis.eval.mockImplementation(async (script) => {
    if (script.includes('DECR')) {
      sharedCounter = Math.max(0, sharedCounter - 1);
      return sharedCounter;
    }
    sharedCounter += 1;
    return [sharedCounter, 50_000, 60_000];
  });

  // 3 allowed hits on instance A (hits 1, 2, 3 <= limit 3).
  expect((await a.increment('login-user')).totalHits).toBe(1);
  expect((await a.increment('login-user')).totalHits).toBe(2);
  expect((await a.increment('login-user')).totalHits).toBe(3);

  // One request fails on instance B and refunds 1 shared hit (3 -> 2).
  await b.decrement('login-user');
  expect(sharedCounter).toBe(2);

  // 4th attempt on instance A must consult Redis (2 -> 3 <= 3, allowed), NOT false-block locally!
  expect((await a.increment('login-user')).totalHits).toBe(3);
  // 5th attempt exceeds limit (3 -> 4 > 3) and caches local block for subsequent flood hits.
  expect((await a.increment('login-user')).totalHits).toBe(4);
  const callsAfterOverLimit = redis.eval.mock.calls.length;
  expect((await a.increment('login-user')).totalHits).toBe(5);
  expect(redis.eval.mock.calls.length).toBe(callsAfterOverLimit);
  clock.mockRestore();
});
