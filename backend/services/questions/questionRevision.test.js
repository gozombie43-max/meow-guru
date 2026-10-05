import { afterEach, expect, it, vi } from 'vitest';
const read = vi.hoisted(() => vi.fn());
vi.mock('../../repositories/questionMetadataRepository.js', () => ({ readQuestionRevision: read }));
import { getQuestionRevision, invalidateQuestionCacheRevision } from './questionCache.js';
afterEach(() => { vi.useRealTimers(); invalidateQuestionCacheRevision(); read.mockReset(); });

it('performs one Mongo read for concurrent callers and warm hits for ten seconds', async () => {
  vi.useFakeTimers(); read.mockResolvedValue({ revision: 4 });
  expect(await Promise.all(Array.from({ length: 20 }, getQuestionRevision))).toEqual(Array(20).fill(4));
  await getQuestionRevision();
  expect(read).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(10001);
  await getQuestionRevision();
  expect(read).toHaveBeenCalledTimes(2);
});

it('does not overwrite invalidation with an older in-flight revision', async () => {
  let release;
  read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue({ revision: 9 });
  const old = getQuestionRevision();
  invalidateQuestionCacheRevision();
  expect(await getQuestionRevision()).toBe(9);
  release({ revision: 8 });
  expect(await old).toBe(9);
  expect(await getQuestionRevision()).toBe(9);
});
