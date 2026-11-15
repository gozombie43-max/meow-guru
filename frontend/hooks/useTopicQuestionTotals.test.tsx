import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invalidateTopicProgressCache, useTopicQuestionTotals } from "./useTopicQuestionTotals";
import { fetchWithRetry } from "@/lib/api/http";
const mocks = vi.hoisted(() => ({ auth: { user: { id: 'one' } as { id: string } | null, token: 'token' as string | null, loading: false } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/api/http", () => ({ fetchWithRetry: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.auth = { user: { id: 'one' }, token: 'token', loading: false }; });
afterEach(cleanup);
const snapshot = (subject: string) => ({ subject, revision: 1, totals: { algebra: 41 }, updatedAt: new Date().toISOString() });
function wrap(seed?: ReturnType<typeof snapshot>) {
  const cache = new Map();
  return function Wrapper({ children }: { children: React.ReactNode }) { return <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false,
    fallback: seed ? { [`/backend-api/api/questions/topic-counts?subject=${seed.subject}`]: seed } : {} }}>{children}</SWRConfig>; };
}
it('reuses SSR totals and requests only owner progress; rotation does not reload it', async () => {
  const seed = snapshot('mathematics');
  vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ subject: seed.subject, userProgress: { algebra: { userSolved: 4, userMastered: 1 } } })));
  const hook = renderHook(() => useTopicQuestionTotals(), { wrapper: wrap(seed) });
  await waitFor(() => expect(hook.result.current.data?.userProgress.algebra.userSolved).toBe(4));
  mocks.auth.token = 'rotated'; hook.rerender();
  expect(hook.result.current.data?.totals.algebra).toBe(41);
  expect(fetchWithRetry).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetchWithRetry).mock.calls[0][0]).toContain('/topics/private?subject=mathematics');
});
it('never shows another account progress and aborts the superseded owner read', async () => {
  const seed = snapshot('english');
  let release!: (response: Response) => void;
  vi.mocked(fetchWithRetry).mockReturnValueOnce(new Promise(resolve => { release = resolve; })).mockResolvedValue(new Response(JSON.stringify({ subject: 'english', userProgress: { algebra: { userSolved: 2, userMastered: 0 } } })));
  const hook = renderHook(() => useTopicQuestionTotals('english'), { wrapper: wrap(seed) });
  await waitFor(() => expect(fetchWithRetry).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(fetchWithRetry).mock.calls[0][1]?.signal;
  mocks.auth.user = { id: 'two' }; hook.rerender();
  expect(hook.result.current.data?.userProgress).toEqual({});
  await waitFor(() => expect(signal?.aborted).toBe(true));
  await act(async () => release(new Response(JSON.stringify({ subject: 'english', userProgress: { algebra: { userSolved: 99 } } }))));
  await waitFor(() => expect(hook.result.current.data?.userProgress.algebra.userSolved).toBe(2));
  mocks.auth.user = null; mocks.auth.token = null; hook.rerender();
  expect(hook.result.current.data?.userProgress).toEqual({});
  expect(localStorage.getItem('english-topic-counts:v4') ?? '').not.toContain('userProgress');
});
it('migrates only public fields from old storage and starts public data during auth restoration', async () => {
  mocks.auth.loading = true;
  const saved = { ...snapshot('reasoning'), userProgress: { algebra: { userSolved: 99 } } };
  localStorage.setItem('reasoning-topic-counts:v3', JSON.stringify(saved));
  vi.mocked(fetchWithRetry).mockResolvedValue(new Response(JSON.stringify({ ...saved, totals: { algebra: 43 } })));
  const hook = renderHook(() => useTopicQuestionTotals('reasoning'), { wrapper: wrap() });
  await waitFor(() => expect(hook.result.current.data?.totals.algebra).toBe(43));
  expect(hook.result.current.data?.userProgress).toEqual({});
  expect(fetchWithRetry).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetchWithRetry).mock.calls[0][2]).toEqual({ auth: 'none' });
  expect(localStorage.getItem('reasoning-topic-counts:v3')).toBeNull();
  expect(JSON.parse(localStorage.getItem('reasoning-topic-counts:v4')!)).not.toHaveProperty('userProgress');
});
it('keeps personal progress warm across remounts even after >5s and only refetches when invalidated', async () => {
  const cache = new Map();
  const seed = snapshot('mathematics');
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SWRConfig value={{ provider: () => cache, shouldRetryOnError: false,
      fallback: { [`/backend-api/api/questions/topic-counts?subject=${seed.subject}`]: seed } }}>
      {children}
    </SWRConfig>
  );
  vi.mocked(fetchWithRetry)
    .mockResolvedValueOnce(new Response(JSON.stringify({ subject: 'mathematics', userProgress: { algebra: { userSolved: 4, userMastered: 1 } } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ subject: 'mathematics', userProgress: { algebra: { userSolved: 5, userMastered: 1 } } })));

  const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
  try {
    const first = renderHook(() => useTopicQuestionTotals(), { wrapper: Wrapper });
    expect(first.result.current.progressPending).toBe(true);
    await waitFor(() => expect(first.result.current.data?.userProgress.algebra.userSolved).toBe(4));
    expect(first.result.current.progressPending).toBe(false);
    expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    first.unmount();

    // Advance clock well past the old 5s threshold without invalidating progress.
    nowSpy.mockReturnValue(60_000);
    const second = renderHook(() => useTopicQuestionTotals(), { wrapper: Wrapper });
    expect(second.result.current.progressPending).toBe(false);
    expect(second.result.current.data?.userProgress.algebra.userSolved).toBe(4);
    expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    second.unmount();

    // After answer submission invalidates progress, remounting fetches the updated count once.
    invalidateTopicProgressCache();
    const third = renderHook(() => useTopicQuestionTotals(), { wrapper: Wrapper });
    expect(third.result.current.data?.userProgress.algebra.userSolved).toBe(4);
    await waitFor(() => expect(third.result.current.data?.userProgress.algebra.userSolved).toBe(5));
    expect(fetchWithRetry).toHaveBeenCalledTimes(2);
  } finally {
    nowSpy.mockRestore();
  }
});
