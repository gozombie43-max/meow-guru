import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  redis: { set: vi.fn(), eval: vi.fn() },
  getRedisClient: vi.fn(),
}));
vi.mock('../../config/redis.js', () => ({
  getRedisClient: state.getRedisClient,
  redisKey: key => `test:${key}`,
  reportRedisFailure: vi.fn(),
}));
import { acquireMatchmakingPass } from '../matchmakingLock.js';

beforeEach(() => {
  vi.clearAllMocks();
  state.getRedisClient.mockResolvedValue(state.redis);
  state.redis.set.mockResolvedValue('OK');
});

it('claims and releases one shared matchmaking pass with owner fencing', async () => {
  const lease = await acquireMatchmakingPass();
  expect(lease.acquired).toBe(true);
  expect(state.redis.set).toHaveBeenCalledWith('test:battle:matchmaking-pass', expect.any(String), { NX: true, PX: 5000 });
  await lease.release();
  expect(state.redis.eval.mock.calls[0][1]).toEqual({
    keys: ['test:battle:matchmaking-pass'], arguments: [state.redis.set.mock.calls[0][1]],
  });
});

it('skips a busy pass and keeps Mongo fallback during Redis outages', async () => {
  state.redis.set.mockResolvedValueOnce(null);
  expect((await acquireMatchmakingPass()).acquired).toBe(false);
  state.getRedisClient.mockResolvedValueOnce(null);
  expect((await acquireMatchmakingPass()).acquired).toBe(true);
});
