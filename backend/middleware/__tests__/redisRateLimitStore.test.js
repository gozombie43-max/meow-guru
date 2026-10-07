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
