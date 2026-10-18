import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useExamCatalog } from './useExamCatalog';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), read: vi.fn() }));
vi.mock('./catalog-cache', () => ({ fetchCatalog: mocks.fetch, readCatalog: mocks.read }));
const metadata = { mockCount: 125, pyqCount: 110, tiers: ['Tier I', 'Tier II'], years: [2024, 2025, 2023] };
function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}
beforeEach(() => {
  mocks.read.mockReset();
  mocks.fetch.mockReset().mockImplementation(async (key: string) => {
    const query = new URL(key, 'http://localhost').searchParams;
    const offset = Number(query.get('offset') || 0);
    return { metadata, total: 125, nextOffset: offset === 0 ? 20 : null,
      slots: query.get('limit') === '0' ? [] : Array.from({ length: 20 }, (_, i) => ({ id: `${query.get('kind')}-${query.get('tier')}-${offset + i}` })),
    };
  });
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
