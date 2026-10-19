import { beforeEach, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ requestResponse: request }));
const exams = ['ssc-cgl', 'ssc-chsl'];
const saved = [{ examSlug: 'ssc-chsl', mockCount: 2, pyqCount: 15, total: 17, updatedAt: 'now' }];
beforeEach(() => { vi.resetModules(); sessionStorage.clear(); localStorage.clear(); request.mockReset().mockResolvedValue({ ok: true, json: async () => ({ exams: saved }) }); });

it('uses one request for all exam cards and restores saved counts without refetching', async () => {
  let summary = await import('./catalog-summary');
  const [first, second] = await Promise.all([summary.fetchCatalogSummary(exams), summary.fetchCatalogSummary(exams)]);
  expect(first).toEqual(saved); expect(second).toEqual(saved); expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toContain('/api/mocktest/catalog-metadata');
  vi.resetModules(); summary = await import('./catalog-summary');
  expect(await summary.fetchCatalogSummary(exams)).toEqual(saved); expect(request).toHaveBeenCalledTimes(1);
});

it('refreshes after a paper write or global seed revision and avoids stale cache restoration', async () => {
  const summary = await import('./catalog-summary');
  const { invalidateMockCatalog } = await import('@/lib/mock-catalog-revision');
  await summary.fetchCatalogSummary(exams);
  invalidateMockCatalog('ssc-chsl');
  request.mockResolvedValueOnce({ ok: true, json: async () => ({ exams: [{ ...saved[0], pyqCount: 16, total: 18 }] }) });
  expect((await summary.fetchCatalogSummary(exams))[0].total).toBe(18);
  invalidateMockCatalog('*');
  await summary.fetchCatalogSummary(exams); expect(request).toHaveBeenCalledTimes(3);
});

it('rejects missing and invalid metadata instead of supplying fabricated counts', async () => {
  const summary = await import('./catalog-summary');
  request.mockResolvedValueOnce({ ok: false });
  await expect(summary.fetchCatalogSummary(exams)).rejects.toThrow('unavailable');
  request.mockResolvedValueOnce({ ok: true, json: async () => ({ exams: [{ ...saved[0], total: -1 }] }) });
  await expect(summary.fetchCatalogSummary(exams)).rejects.toThrow('Invalid');
});
