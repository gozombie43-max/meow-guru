import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ values: new Map(), revisions: new Map(), online: true }));
vi.mock('../../config/redis.js', () => ({
  redisGetJson: vi.fn(async key => state.online ? state.values.get(key) ?? null : null),
  redisSetJson: vi.fn(async (key, value) => { if (state.online) state.values.set(key, value); }),
  getRedisClient: vi.fn(async () => null), redisKey: key => key, reportRedisFailure: vi.fn(),
}));
vi.mock('../../repositories/cacheRevisionRepository.js', () => ({
  getCacheCounter: vi.fn(async scope => state.revisions.get(scope) ?? 0),
  advanceCacheCounter: vi.fn(async scope => { state.revisions.set(scope, (state.revisions.get(scope) ?? 0) + 1); }),
}));
import { readTrainingDashboardCache, writeTrainingDashboardCache, advanceTrainingDashboardRevision, invalidateTrainingDashboard } from './dashboardCache.js';
import { redisGetJson } from '../../config/redis.js';
import { getCacheCounter } from '../../repositories/cacheRevisionRepository.js';
beforeEach(() => { state.values.clear(); state.revisions.clear(); state.online = true; vi.clearAllMocks(); });
it('isolates owners and rejects surviving cache entries after a mutation during an outage', async () => {
  const first = await readTrainingDashboardCache('user-a', 'ssc-cgl');
  await writeTrainingDashboardCache(first.key, { solved: 1 });
  expect((await readTrainingDashboardCache('user-a', 'ssc-cgl')).value).toEqual({ solved: 1 });
  expect((await readTrainingDashboardCache('user-a', 'ssc-chsl')).value).toBeNull();
  state.online = false;
  await advanceTrainingDashboardRevision('user-a', 'ssc-cgl', {});
  await invalidateTrainingDashboard('user-a', 'ssc-cgl');
  state.online = true;
  const next = await readTrainingDashboardCache('user-a', 'ssc-cgl');
  expect(next.key).not.toBe(first.key);
  expect(next.value).toBeNull();
  await writeTrainingDashboardCache(first.key, { solved: 0 });
  expect((await readTrainingDashboardCache('user-a', 'ssc-cgl')).value).toBeNull();
});
it('rechecks the durable revision when a cache read overlaps a committed mutation', async () => {
  const first = await readTrainingDashboardCache('user-a', 'ssc-cgl');
  await writeTrainingDashboardCache(first.key, { solved: 1 });
  vi.mocked(redisGetJson).mockImplementationOnce(async () => {
    await advanceTrainingDashboardRevision('user-a', 'ssc-cgl', {});
    return { solved: 1 };
  });
  expect((await readTrainingDashboardCache('user-a', 'ssc-cgl')).value).toBeNull();
});
it('does not trust Redis when the durable revision lookup fails', async () => {
  vi.mocked(getCacheCounter).mockRejectedValueOnce(new Error('Mongo unavailable'));
  await expect(readTrainingDashboardCache('user-a', 'ssc-cgl')).rejects.toThrow('Mongo unavailable');
});
