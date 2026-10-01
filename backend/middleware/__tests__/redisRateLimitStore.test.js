import { beforeEach, expect, it, vi } from 'vitest';

const { redis, fallback, getRedisClient } = vi.hoisted(() => ({
  redis: { eval: vi.fn(), del: vi.fn() },
  fallback: { init: vi.fn(), increment: vi.fn(), decrement: vi.fn(), resetKey: vi.fn() },
  getRedisClient: vi.fn(),
}));
vi.mock('../../config/redis.js', () => ({ getRedisClient, redisKey: key => `test:${key}`, reportRedisFailure: vi.fn() }));
vi.mock('../mongoRateLimitStore.js', () => ({ MongoRateLimitStore: class { constructor() { return fallback; } } }));

import { RedisRateLimitStore } from '../redisRateLimitStore.js';

beforeEach(() => {
  vi.clearAllMocks();
  getRedisClient.mockResolvedValue(redis);
  redis.eval.mockResolvedValue([3, 8000]);
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
    keys: [expect.stringMatching(/^test:rate:auth:[a-f0-9]{64}$/)], arguments: ['9000'],
  });
  expect(fallback.increment).not.toHaveBeenCalled();
});

it('falls back to MongoDB when Redis is unavailable or a command fails', async () => {
  const store = new RedisRateLimitStore('auth');
  store.init({ windowMs: 9000 });
  getRedisClient.mockResolvedValueOnce(null);
  expect((await store.increment('ip')).totalHits).toBe(2);
  redis.eval.mockRejectedValueOnce(new Error('connection lost'));
  expect((await store.increment('ip')).totalHits).toBe(2);
  expect(fallback.increment).toHaveBeenCalledTimes(2);
});

it('decrements in Redis and clears both backends on reset', async () => {
  const store = new RedisRateLimitStore('upload');
  store.init({ windowMs: 9000 });
  await store.decrement('ip');
  await store.resetKey('ip');
  expect(redis.eval).toHaveBeenCalledTimes(1);
  expect(redis.del).toHaveBeenCalledTimes(1);
  expect(fallback.resetKey).toHaveBeenCalledWith('ip');
});
