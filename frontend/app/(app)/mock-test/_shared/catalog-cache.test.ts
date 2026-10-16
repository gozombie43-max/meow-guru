import { beforeEach, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ requestResponse: request }));
const payload = { slots: [], metadata: { mockCount: 120, pyqCount: 140, tiers: ['Tier I'] }, total: 120, nextOffset: 20 };

beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  sessionStorage.clear();
  request.mockResolvedValue({ ok: true, json: async () => payload });
});

it('deduplicates requests and restores counts across reloads without fetching again', async () => {
  let cache = await import('./catalog-cache');
  await Promise.all([cache.fetchCatalog('/exam-a'), cache.fetchCatalog('/exam-a')]);
  expect(request).toHaveBeenCalledTimes(1);
  vi.resetModules();
  cache = await import('./catalog-cache');
  expect(cache.readCatalog('/exam-a')?.data.metadata.mockCount).toBe(120);
  await cache.fetchCatalog('/exam-a');
  expect(request).toHaveBeenCalledTimes(1);
  await cache.fetchCatalog('/exam-b');
  expect(request).toHaveBeenCalledTimes(2);
});

it('refreshes expired data and retains saved metadata when refresh fails', async () => {
  sessionStorage.setItem('mock-catalog-v1:/expired', JSON.stringify({ savedAt: Date.now() - 11 * 60 * 1000, data: payload }));
  const cache = await import('./catalog-cache');
  request.mockResolvedValueOnce({ ok: false });
  await expect(cache.fetchCatalog('/expired')).rejects.toThrow('Could not load');
  expect(cache.readCatalog('/expired')?.data.metadata.pyqCount).toBe(140);
  await cache.fetchCatalog('/expired');
  expect(request).toHaveBeenCalledTimes(2);
});
