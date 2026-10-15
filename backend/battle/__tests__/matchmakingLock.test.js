import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  redis: { set: vi.fn(), eval: vi.fn() }, getRedisClient: vi.fn(),
  locks: { findOneAndUpdate: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() },
}));
vi.mock('../../config/redis.js', () => ({ getRedisClient: state.getRedisClient, redisKey: key => `test:${key}`, reportRedisFailure: vi.fn() }));
vi.mock('../../config/mongodb.js', () => ({ getMongoDB: () => ({ collection: () => state.locks }) }));
import { acquireMatchmakingPass } from '../matchmakingLock.js';
beforeEach(() => {
  vi.clearAllMocks(); state.getRedisClient.mockResolvedValue(state.redis); state.redis.set.mockResolvedValue('OK');
  state.locks.findOneAndUpdate.mockImplementation(async (_filter, update) => update.$set);
  state.locks.updateOne.mockResolvedValue({ matchedCount: 1 }); state.locks.deleteOne.mockResolvedValue({ deletedCount: 1 });
});
it('fences every pass in Mongo, renews ownership, and releases only its own leases', async () => {
  const lease = await acquireMatchmakingPass();
  expect(lease).toMatchObject({ acquired: true, degraded: false });
  const owner = state.redis.set.mock.calls[0][1];
  expect(state.locks.findOneAndUpdate.mock.calls[0][1].$set.owner).toBe(owner);
  expect(await lease.renew()).toBe(true);
  await lease.release();
  expect(state.locks.deleteOne).toHaveBeenCalledWith({ _id: 'pass', owner }, expect.anything());
  expect(state.redis.eval.mock.calls[0][1]).toEqual({ keys: ['test:battle:matchmaking-pass'], arguments: [owner] });
});
it('skips Redis contention without scanning Mongo', async () => {
  state.redis.set.mockResolvedValue(null);
  expect((await acquireMatchmakingPass()).acquired).toBe(false);
  expect(state.locks.findOneAndUpdate).not.toHaveBeenCalled();
});
it.each(['absent', 'error'])('uses the common Mongo lease when Redis is %s', async failure => {
  if (failure === 'absent') state.getRedisClient.mockResolvedValue(null); else state.redis.set.mockRejectedValue(new Error('offline'));
  const first = await acquireMatchmakingPass();
  expect(first).toMatchObject({ acquired: true, degraded: true });
  state.locks.findOneAndUpdate.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 11000 }));
  expect(await acquireMatchmakingPass()).toMatchObject({ acquired: false, degraded: true });
  await first.release();
});
it('fails closed if the Mongo coordinator is unavailable and fences a lost renewal', async () => {
  state.locks.findOneAndUpdate.mockRejectedValueOnce(new Error('db unavailable'));
  await expect(acquireMatchmakingPass()).rejects.toThrow('db unavailable');
  expect(state.redis.eval).toHaveBeenCalled();
  const lease = await acquireMatchmakingPass(); state.locks.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
  expect(await lease.renew()).toBe(false); await lease.release();
});
