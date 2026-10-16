import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useExamCatalog } from './useExamCatalog';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), read: vi.fn() }));
vi.mock('./catalog-cache', () => ({ fetchCatalog: mocks.fetch, readCatalog: mocks.read }));
const metadata = { mockCount: 125, pyqCount: 110, tiers: ['Tier I', 'Tier II'] };
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
