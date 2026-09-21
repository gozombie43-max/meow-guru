import { afterEach, expect, it, vi } from 'vitest';
import { cachedTrainingCatalog, invalidateTrainingCatalog } from './catalogCache.js';
afterEach(() => { vi.useRealTimers(); invalidateTrainingCatalog(); });
it('coalesces reads, isolates databases, expires and invalidates uploads', async () => {
  vi.useFakeTimers();
  const db = {}, build = vi.fn(async () => ['catalog']);
  await Promise.all([cachedTrainingCatalog(db, 'ssc-cgl', build), cachedTrainingCatalog(db, 'ssc-cgl', build)]);
  expect(build).toHaveBeenCalledTimes(1);
  await cachedTrainingCatalog({}, 'ssc-cgl', build);
  expect(build).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(300001);
  await cachedTrainingCatalog(db, 'ssc-cgl', build);
  expect(build).toHaveBeenCalledTimes(3);
  invalidateTrainingCatalog();
  await cachedTrainingCatalog(db, 'ssc-cgl', build);
  expect(build).toHaveBeenCalledTimes(4);
});
it('does not cache failures', async () => {
  const db = {}, build = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await expect(cachedTrainingCatalog(db, 'cat', build)).rejects.toThrow('offline');
  await expect(cachedTrainingCatalog(db, 'cat', build)).resolves.toEqual([]);
});
