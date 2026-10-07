import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ revision: 1, shared: new Map() }));
vi.mock('../../config/redis.js', () => ({
  getRedisClient: vi.fn(async () => ({ eval: async () => 1 })), redisKey: key => key,
  redisGetJson: vi.fn(async key => state.shared.get(key) ?? null),
  redisSetJson: vi.fn(async (key, value) => { state.shared.set(key, value); }),
}));
vi.mock('../questions/questionCache.js', () => ({
  getQuestionRevision: vi.fn(async () => state.revision),
  clearQuestionRevisionCache: vi.fn(),
}));

import { cachedTrainingCatalog, invalidateTrainingCatalog } from './catalogCache.js';

beforeEach(() => {
  state.revision = 1;
  state.shared.clear();
  invalidateTrainingCatalog();
});

it('shares a catalog across local caches and rebuilds after a question revision', async () => {
  const build = vi.fn().mockResolvedValueOnce([{ topic: 'algebra' }]).mockResolvedValueOnce([{ topic: 'geometry' }]);
  expect(await cachedTrainingCatalog({}, 'ssc-cgl:false', build)).toEqual([{ topic: 'algebra' }]);
  expect(await cachedTrainingCatalog({}, 'ssc-cgl:false', build)).toEqual([{ topic: 'algebra' }]);
  expect(build).toHaveBeenCalledTimes(1);

  state.revision++;
  invalidateTrainingCatalog();
  expect(await cachedTrainingCatalog({}, 'ssc-cgl:false', build)).toEqual([{ topic: 'geometry' }]);
  expect(build).toHaveBeenCalledTimes(2);
});
