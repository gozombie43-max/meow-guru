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

import { readTrainingDashboardCache, writeTrainingDashboardCache, invalidateTrainingDashboard } from './dashboardCache.js';

beforeEach(() => { state.values.clear(); vi.clearAllMocks(); });

it('isolates learners and exams and invalidates only the changed dashboard', async () => {
  const first = await readTrainingDashboardCache('user-a', 'ssc-cgl');
  await writeTrainingDashboardCache(first.key, { attempts: 2 });
  expect((await readTrainingDashboardCache('user-a', 'ssc-cgl')).value).toEqual({ attempts: 2 });
  expect((await readTrainingDashboardCache('user-a', 'ssc-chsl')).value).toBeNull();
  await invalidateTrainingDashboard('user-a', 'ssc-cgl');
  expect((await readTrainingDashboardCache('user-a', 'ssc-cgl')).value).toBeNull();
});
