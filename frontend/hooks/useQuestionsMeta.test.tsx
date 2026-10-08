import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { useQuestionsMeta } from './useQuestionsMeta';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/http', () => ({ fetchWithRetry: fetchMock }));
afterEach(() => { vi.useRealTimers(); fetchMock.mockReset(); });
const fingerprint = 'a'.repeat(64);
const metadata = { total: 12, exams: ['SSC'], concepts: ['equations'], letters: {}, groupingStatus: 'processing', groupingFingerprint: fingerprint };
const response = (data: unknown) => ({ ok: true, json: async () => data });

it('polls status rather than metadata and stops on completion without losing totals', async () => {
  vi.useFakeTimers();
  let ready = false;
  fetchMock.mockImplementation(async (url: string) => response(url.includes('/meta?') ? metadata : {
    groupingFingerprint: fingerprint, groupingStatus: ready ? 'ready' : 'processing',
    ...(ready ? { conceptGroups: [{ id: 'group', label: 'Equations', description: 'Linear', concepts: ['equations'] }] } : {}),
  }));
  const cache = new Map();
  const { result, unmount } = renderHook(() => useQuestionsMeta({ subject: 'mathematics', topic: 'algebra' }), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>,
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  ready = true;
  await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
  expect(result.current.meta.groupingStatus).toBe('ready');
  expect(result.current.meta.total).toBe(12);
  const calls = fetchMock.mock.calls.map(call => call[0] as string);
  expect(calls.filter(url => url.includes('/meta?'))).toHaveLength(1);
  expect(calls.filter(url => url.includes('/concept-groups/'))).toHaveLength(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.meta.total).toBe(12);
  unmount();
});

it('cancels the pending poll when the topic changes and stops polling failed jobs', async () => {
  vi.useFakeTimers();
  const nextFingerprint = 'b'.repeat(64);
  fetchMock.mockImplementation(async (url: string) => response(url.includes('/meta?')
    ? { ...metadata, groupingFingerprint: url.includes('geometry') ? nextFingerprint : fingerprint }
    : { groupingFingerprint: nextFingerprint, groupingStatus: 'failed' }));
  const cache = new Map();
  const { result, rerender, unmount } = renderHook(({ topic }) => useQuestionsMeta({ subject: 'mathematics', topic }), {
    initialProps: { topic: 'algebra' },
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>,
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  rerender({ topic: 'geometry' });
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(fetchMock.mock.calls.every(([url]) => url.includes('/meta?'))).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(result.current.meta.groupingStatus).toBe('failed');
  expect(fetchMock.mock.calls.filter(([url]) => url.includes('/concept-groups/')).map(([url]) => url))
    .toEqual([expect.stringContaining(nextFingerprint)]);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  unmount();
});
