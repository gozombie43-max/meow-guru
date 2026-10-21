import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useExamCatalog } from './useExamCatalog';
import { invalidateMockCatalog } from '@/lib/mock-catalog-revision';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), read: vi.fn() }));
vi.mock('./catalog-cache', () => ({ fetchCatalog: mocks.fetch, readCatalog: mocks.read }));
const metadata = { mockCount: 125, pyqCount: 110, tiers: ['Tier I', 'Tier II'], years: [2024, 2025, 2023] };
function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}
beforeEach(() => {
  localStorage.clear();
  mocks.read.mockReset();
  mocks.fetch.mockReset().mockImplementation(async (key: string) => {
    const query = new URL(key, 'http://localhost').searchParams;
    const offset = Number(query.get('offset') || 0);
    return { metadata, total: 125, nextOffset: offset === 0 ? 20 : null,
      slots: query.get('limit') === '0' ? [] : Array.from({ length: 20 }, (_, i) => ({ id: `${query.get('kind')}-${query.get('tier')}-${offset + i}` })),
    };
  });
});

it('refreshes an open catalog after a successful rename and ignores edits to other exams', async () => {
  const { result } = renderHook(() => useExamCatalog('ssc-chsl', 'prev', 'Tier I', false), { wrapper });
  await waitFor(() => expect(result.current.slots).toHaveLength(20));
  const before = mocks.fetch.mock.calls.length;
  act(() => invalidateMockCatalog('ssc-cgl'));
  expect(mocks.fetch).toHaveBeenCalledTimes(before);
  mocks.fetch.mockImplementation(async () => ({ metadata, total: 1, nextOffset: null, slots: [{ id: 'renamed', title: 'New paper title' }] }));
  act(() => invalidateMockCatalog('ssc-chsl'));
  await waitFor(() => expect(result.current.slots[0]?.title).toBe('New paper title'));
});

it('refreshes an open catalog when another tab changes the exam revision', async () => {
  const { result } = renderHook(() => useExamCatalog('ssc-chsl', 'prev', 'Tier I', false), { wrapper });
  await waitFor(() => expect(result.current.slots).toHaveLength(20));
  mocks.fetch.mockImplementation(async () => ({ metadata, total: 1, nextOffset: null, slots: [{ id: 'renamed', title: 'Title from another tab' }] }));
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'mock-catalog-revision:ssc-chsl', oldValue: null, newValue: 'updated' }));
  });
  await waitFor(() => expect(result.current.slots[0]?.title).toBe('Title from another tab'));
});

it('loads one batch, appends on demand, and isolates tabs and tiers', async () => {
  const { result, rerender } = renderHook(({ tab, tier }) => useExamCatalog('ssc-cgl', tab, tier, false), {
    initialProps: { tab: 'mock', tier: 'Tier I' }, wrapper,
  });
  await waitFor(() => expect(result.current.slots).toHaveLength(20));
  expect(result.current.metadata?.mockCount).toBe(125);
  await act(async () => { result.current.loadMore(); });
  await waitFor(() => expect(result.current.slots).toHaveLength(40));
  expect(result.current.hasMore).toBe(false);
  rerender({ tab: 'prev', tier: 'Tier II' });
  await waitFor(() => expect(result.current.slots[0]?.id).toBe('pyq-Tier II-0'));
  expect(result.current.slots).toHaveLength(20);
});

it('shows saved counts in the route loading shell without making a request', async () => {
  mocks.read.mockReturnValue({ data: { metadata, slots: [], nextOffset: null, total: 0 } });
  const { result } = renderHook(() => useExamCatalog('ssc-cgl', 'mock', '', true), { wrapper });
  await waitFor(() => expect(result.current.metadata?.pyqCount).toBe(110));
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('requests a new first page when year changes and clears the year filter for mocks', async () => {
  const { result, rerender } = renderHook(({ tab, year }) => useExamCatalog('ssc-chsl', tab, 'Tier I', false, year), {
    initialProps: { tab: 'prev', year: '2025' }, wrapper,
  });
  await waitFor(() => expect(result.current.slots).toHaveLength(20));
  expect(mocks.fetch.mock.calls.some(([key]) => key.includes('year=2025') && key.endsWith('offset=0'))).toBe(true);
  rerender({ tab: 'prev', year: '2024' });
  await waitFor(() => expect(mocks.fetch.mock.calls.some(([key]) => key.includes('year=2024') && key.endsWith('offset=0'))).toBe(true));
  rerender({ tab: 'mock', year: '2024' });
  await waitFor(() => expect(result.current.slots[0]?.id).toBe('mock-Tier I-0'));
  expect(mocks.fetch.mock.calls.filter(([key]) => key.includes('kind=mock')).every(([key]) => !key.includes('year='))).toBe(true);
});

it('defaults the first PYQ request to the latest published year and allows all years', async () => {
  const { result, rerender } = renderHook(({ year }: { year: string | undefined }) => useExamCatalog('ssc-chsl', 'prev', '', false, year), {
    initialProps: { year: undefined as string | undefined }, wrapper,
  });
  await waitFor(() => expect(result.current.slots).toHaveLength(20));
  expect(result.current.effectiveYear).toBe('2025');
  const requests = mocks.fetch.mock.calls.map(([key]) => new URL(key, 'http://localhost').searchParams).filter(query => query.get('kind') === 'pyq');
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(query => query.get('year') === '2025')).toBe(true);
  rerender({ year: '' });
  await waitFor(() => expect(result.current.effectiveYear).toBe(''));
  await waitFor(() => expect(mocks.fetch.mock.calls.some(([key]) => key.includes('kind=pyq') && !key.includes('year='))).toBe(true));
});

it('uses the filtered total across year changes and pagination rather than the exam total or loaded card count', async () => {
  let release2024!: () => void;
  mocks.fetch.mockImplementation(async (key: string) => {
    const query = new URL(key, 'http://localhost').searchParams;
    const metadata = { mockCount: 0, pyqCount: 56, tiers: ['Tier I'], years: [2025, 2024] };
    if (query.get('limit') === '0') return { metadata, total: 0, slots: [], nextOffset: null };
    const year = query.get('year') || '';
    const total = year === '2025' ? 50 : year === '2024' ? 6 : year === '2023' ? 0 : 56;
    const offset = Number(query.get('offset'));
    const response = { metadata, total, nextOffset: offset + 20 < total ? offset + 20 : null,
      slots: Array.from({ length: Math.min(20, total - offset) }, (_, i) => ({ id: `${year}-${offset + i}` })) };
    if (year === '2024') return new Promise(resolve => { release2024 = () => resolve(response); });
    return response;
  });
  const { result, rerender } = renderHook(({ year }: { year: string | undefined }) => useExamCatalog('ssc-chsl', 'prev', 'Tier I', false, year), {
    initialProps: { year: undefined as string | undefined }, wrapper,
  });
  await waitFor(() => expect(result.current.total).toBe(50));
  expect(result.current.metadata?.pyqCount).toBe(56);
  expect(result.current.slots).toHaveLength(20);
  await act(async () => { result.current.loadMore(); });
  await waitFor(() => expect(result.current.slots).toHaveLength(40));
  expect(result.current.total).toBe(50);

  rerender({ year: '2024' });
  expect(result.current.total).toBeUndefined();
  await waitFor(() => expect(release2024).toBeTypeOf('function'));
  await act(async () => { release2024(); });
  await waitFor(() => expect(result.current.total).toBe(6));
  expect(result.current.slots).toHaveLength(6);
  expect(result.current.hasMore).toBe(false);

  rerender({ year: '' });
  await waitFor(() => expect(result.current.total).toBe(56));
  expect(result.current.slots).toHaveLength(20);
  rerender({ year: '2023' });
  await waitFor(() => expect(result.current.total).toBe(0));
  expect(result.current.slots).toHaveLength(0);
});
