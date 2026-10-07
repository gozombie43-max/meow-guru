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
import { readTopicProgressCache, writeTopicProgressCache, advanceTopicProgressRevision, invalidateTopicProgress, cachedTopicProgress } from './topicProgressCache.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { redisGetJson } from '../../config/redis.js';
import { getCacheCounter } from '../../repositories/cacheRevisionRepository.js';
beforeEach(() => { state.values.clear(); state.revisions.clear(); state.online = true; clearSharedLocalCaches(); vi.clearAllMocks(); });
it('isolates owners and rejects surviving cache entries after a mutation during an outage', async () => {
  const first = await readTopicProgressCache('user-a');
  await writeTopicProgressCache(first.key, { solved: 1 });
  expect((await readTopicProgressCache('user-a')).value).toEqual({ solved: 1 });
  expect((await readTopicProgressCache('user-b')).value).toBeNull();
  state.online = false;
  await advanceTopicProgressRevision('user-a', {});
  await invalidateTopicProgress('user-a');
  state.online = true;
  const next = await readTopicProgressCache('user-a');
  expect(next.key).not.toBe(first.key);
  expect(next.value).toBeNull();
  await writeTopicProgressCache(first.key, { solved: 0 });
  expect((await readTopicProgressCache('user-a')).value).toBeNull();
});
it('rechecks the durable revision when a cache read overlaps a committed mutation', async () => {
  const first = await readTopicProgressCache('user-a');
  await writeTopicProgressCache(first.key, { solved: 1 });
  vi.mocked(redisGetJson).mockImplementationOnce(async () => {
    await advanceTopicProgressRevision('user-a', {});
    return { solved: 1 };
  });
  expect((await readTopicProgressCache('user-a')).value).toBeNull();
});
it('does not trust Redis when the durable revision lookup fails', async () => {
  vi.mocked(getCacheCounter).mockRejectedValueOnce(new Error('Mongo unavailable'));
  await expect(readTopicProgressCache('user-a')).rejects.toThrow('Mongo unavailable');
});

it('coalesces source/revision reads and rechecks a mutation committed during a rebuild', async () => {
  state.online = false;
  const build = vi.fn(async () => {
    if (build.mock.calls.length === 1) { await advanceTopicProgressRevision('user-a', {}); return { solved: 0 }; }
    return { solved: 1 };
  });
  const results = await Promise.all(Array.from({ length: 100 }, () => cachedTopicProgress('user-a', build)));
  expect(results).toEqual(Array(100).fill({ solved: 1 }));
  expect(build).toHaveBeenCalledTimes(2);
  expect(getCacheCounter).toHaveBeenCalledTimes(4);
  expect(await cachedTopicProgress('user-a', build)).toEqual({ solved: 1 });
  expect(build).toHaveBeenCalledTimes(2);
  expect(await cachedTopicProgress('user-b', async () => ({ solved: 9 }))).toEqual({ solved: 9 });
});

it('falls back to an uncached source read after repeated concurrent mutations', async () => {
  const build = vi.fn(async () => { await advanceTopicProgressRevision('user-a', {}); return { solved: build.mock.calls.length }; });
  expect(await cachedTopicProgress('user-a', build)).toEqual({ solved: 4 });
  expect(build).toHaveBeenCalledTimes(4);
});
