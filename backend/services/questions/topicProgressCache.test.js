import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  const values = new Map();
  return {
    values,
    client: {
      get: vi.fn(async key => values.get(key) ?? null),
      eval: vi.fn(async (_script, { keys }) => {
        const next = Number(values.get(keys[0]) || 0) + 1;
        values.set(keys[0], String(next));
        return next;
      }),
    },
  };
});
vi.mock('../../config/redis.js', () => ({
  getRedisClient: vi.fn(async () => state.client),
  redisKey: key => `test:${key}`,
  redisGetJson: vi.fn(async key => state.values.get(`test:${key}`) ?? null),
  redisSetJson: vi.fn(async (key, value) => { state.values.set(`test:${key}`, value); }),
  reportRedisFailure: vi.fn(),
}));

import { readTopicProgressCache, writeTopicProgressCache, invalidateTopicProgress } from './topicProgressCache.js';

beforeEach(() => { state.values.clear(); vi.clearAllMocks(); });

it('isolates users and changes the cache key after a progress update', async () => {
  const first = await readTopicProgressCache('user-a');
  await writeTopicProgressCache(first.key, [{ topic: 'algebra', solvedCount: 1 }]);
  expect((await readTopicProgressCache('user-a')).value).toHaveLength(1);
  expect((await readTopicProgressCache('user-b')).value).toBeNull();
  await invalidateTopicProgress('user-a');
  const next = await readTopicProgressCache('user-a');
  expect(next.key).not.toBe(first.key);
  expect(next.value).toBeNull();
});
