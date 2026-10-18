import { beforeEach, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ requestResponse: request }));
const payload = { slots: [], metadata: { mockCount: 120, pyqCount: 140, tiers: ['Tier I'] }, total: 120, nextOffset: 20 };

beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  sessionStorage.clear();
  localStorage.clear();
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
  sessionStorage.setItem('mock-catalog-v4:/expired', JSON.stringify({ savedAt: Date.now() - 11 * 60 * 1000, data: payload }));
  const cache = await import('./catalog-cache');
  request.mockResolvedValueOnce({ ok: false });
  await expect(cache.fetchCatalog('/expired')).rejects.toThrow('Could not load');
  expect(cache.readCatalog('/expired')?.data.metadata.pyqCount).toBe(140);
  await cache.fetchCatalog('/expired');
  expect(request).toHaveBeenCalledTimes(2);
});

it('invalidates every cached page of the edited exam while keeping other exams cached', async () => {
  const cache = await import('./catalog-cache');
  const { invalidateMockCatalog } = await import('@/lib/mock-catalog-revision');
  const base = '/api/mocktest/ssc-chsl/slots?catalog=1';
  const keys = [`${base}&limit=0`, `${base}&kind=pyq&offset=0`, `${base}&kind=pyq&offset=20`];
  const other = '/api/mocktest/ssc-cgl/slots?catalog=1&limit=20';
  await Promise.all([...keys, other].map(cache.fetchCatalog));
  invalidateMockCatalog('ssc-chsl');
  expect(keys.map(cache.readCatalog)).toEqual([undefined, undefined, undefined]);
  expect(cache.readCatalog(other)?.data).toEqual(payload);
  const renamed = { ...payload, slots: [{ id: 'paper', title: 'New paper title' }] };
  request.mockResolvedValueOnce({ ok: true, json: async () => renamed });
  expect(await cache.fetchCatalog(keys[1])).toEqual(renamed);
  await cache.fetchCatalog(other);
  expect(request).toHaveBeenCalledTimes(5);
  vi.resetModules();
  const restored = await import('./catalog-cache');
  expect(restored.readCatalog(keys[0])).toBeUndefined();
  expect(restored.readCatalog(keys[1])?.data).toEqual(renamed);
});

it('does not let a request started before the rename restore the old title', async () => {
  const cache = await import('./catalog-cache');
  const { invalidateMockCatalog } = await import('@/lib/mock-catalog-revision');
  const key = '/api/mocktest/ssc-chsl/slots?catalog=1&kind=pyq&offset=0';
  let resolveOld!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const staleRequest = cache.fetchCatalog(key);
  invalidateMockCatalog('ssc-chsl');
  const renamed = { ...payload, slots: [{ id: 'paper', title: 'New paper title' }] };
  request.mockResolvedValueOnce({ ok: true, json: async () => renamed });
  await cache.fetchCatalog(key);
  resolveOld({ ok: true, json: async () => payload });
  expect(await staleRequest).toEqual(renamed);
  expect(cache.readCatalog(key)?.data).toEqual(renamed);
  expect(request).toHaveBeenCalledTimes(2);
});
