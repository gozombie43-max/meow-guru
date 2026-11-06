import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ApplicationProviders from '@/app/providers';
import { questionCountsUrl, useQuestionCounts } from './useQuestionCounts';
import { __resetPersistedMemory } from '@/lib/persistentQueryCache';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ loading: false, user: null }) }));
vi.mock('@/lib/api/http', () => ({ fetchWithRetry: mocks.fetch }));

const wrapper = ({ children }: { children: ReactNode }) => <ApplicationProviders>{children}</ApplicationProviders>;
const payload = (concept: number) => ({ concept, formula: 0, mixed: 0, aiChallenge: 0, easy: 0, hard: 0, studyMode: 0 });
const params = { topic: 'jainism', subject: 'general-awareness' };
const storageKey = () => `meow:qcache:v1:${questionCountsUrl(params)}`;

beforeEach(() => {
  window.localStorage.clear();
  __resetPersistedMemory();
  mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async () => ({ ok: true, json: async () => payload(64) }));
});

describe('useQuestionCounts persistence', () => {
  it('persists fetched counts and serves them instantly on a fresh session without refetching', async () => {
    const first = renderHook(() => useQuestionCounts(params), { wrapper });
    expect(first.result.current.isPending).toBe(true);
    await waitFor(() => expect(first.result.current.counts.concept).toBe(64));
    expect(window.localStorage.getItem(storageKey())).toContain('"concept":64');
    first.unmount();

    // New providers => empty SWR memory cache, like a page reload.
    const second = renderHook(() => useQuestionCounts(params), { wrapper });
    expect(second.result.current.isPending).toBe(false);
    expect(second.result.current.counts.concept).toBe(64);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('shows stale persisted counts immediately and refreshes them in the background', async () => {
    window.localStorage.setItem(storageKey(), JSON.stringify({ data: payload(10), savedAt: Date.now() - 5 * 60_000 }));
    mocks.fetch.mockImplementation(async () => ({ ok: true, json: async () => payload(24) }));
    const { result } = renderHook(() => useQuestionCounts(params), { wrapper });
    expect(result.current.counts.concept).toBe(10);
    expect(result.current.isPending).toBe(false);
    await waitFor(() => expect(result.current.counts.concept).toBe(24));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps last-known counts and hides the error when the refresh fails', async () => {
    window.localStorage.setItem(storageKey(), JSON.stringify({ data: payload(7), savedAt: Date.now() - 5 * 60_000 }));
    mocks.fetch.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const { result } = renderHook(() => useQuestionCounts(params), { wrapper });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    expect(result.current.counts.concept).toBe(7);
    expect(result.current.isError).toBeUndefined();
  });

  it('ignores expired entries', () => {
    window.localStorage.setItem(storageKey(), JSON.stringify({ data: payload(3), savedAt: Date.now() - 8 * 24 * 60 * 60_000 }));
    const { result } = renderHook(() => useQuestionCounts(params), { wrapper });
    expect(result.current.isPending).toBe(true);
  });

  it('intent-prefetches counts so the next mount renders instantly with zero duplicate fetches', async () => {
    const { prefetchQuestionCounts } = await import('./useQuestionCounts');
    prefetchQuestionCounts(params);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));

    const { result } = renderHook(() => useQuestionCounts(params), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.counts.concept).toBe(64);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('clears persisted counts when question queries are invalidated', async () => {
    const { invalidateQuestionQueries } = await import('@/features/quiz/api/questionWrites');
    const first = renderHook(() => useQuestionCounts(params), { wrapper });
    await waitFor(() => expect(first.result.current.counts.concept).toBe(64));
    expect(window.localStorage.getItem(storageKey())).not.toBeNull();
    first.unmount();

    await invalidateQuestionQueries();
    expect(window.localStorage.getItem(storageKey())).toBeNull();
  });
});
