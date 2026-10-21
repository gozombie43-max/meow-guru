import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { discardEarlySession } from '@/lib/early-session';
const mocks = vi.hoisted(() => ({ get: vi.fn(), refresh: vi.fn(), restore: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: vi.fn() }, AUTH_TOKEN_CHANGED_EVENT: 'auth-token',
  clearLegacyAuthStorage: vi.fn(), getAccessToken: () => 'token', requestTokenRefresh: mocks.refresh, updateAccessToken: vi.fn() }));
vi.mock('@/lib/session-bootstrap', () => ({ restorePreparedSession: mocks.restore, discardPreparedSession: vi.fn() }));
vi.mock('@/lib/socket-lifecycle', () => ({ disconnectSocket: vi.fn() }));
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
beforeEach(() => { vi.clearAllMocks(); mocks.restore.mockResolvedValue('token'); });
afterEach(() => { cleanup(); discardEarlySession(); vi.useRealTimers(); });

function preload(profile: Promise<unknown | undefined>) {
  const state: NonNullable<Window['__MEOW_SESSION_BOOTSTRAP__']> = {
    base: '/backend-api', expiresAt: Date.now() + 15_000, token: 'token',
    refreshConsumed: true, profileConsumed: false, cancelled: false,
    refresh: Promise.resolve('token'), profile,
    cancel: () => {
      state.cancelled = true;
      if (window.__MEOW_SESSION_BOOTSTRAP__ === state) delete window.__MEOW_SESSION_BOOTSTRAP__;
    },
  };
  window.__MEOW_SESSION_BOOTSTRAP__ = state;
  return state;
}

it('adopts the verified preload without issuing another profile request', async () => {
  preload(Promise.resolve({ id: 'preloaded-owner' }));
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.user?.id).toBe('preloaded-owner');
  expect(mocks.get).not.toHaveBeenCalled();
  expect(window.__MEOW_SESSION_BOOTSTRAP__).toBeUndefined();
});

it('counts a failed preload in the existing profile read budget', async () => {
  preload(Promise.resolve(undefined));
  mocks.get.mockResolvedValue({ data: { id: 'recovered-owner' } });
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.user?.id).toBe('recovered-owner'));
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/users/me', expect.objectContaining({ apiPolicy: { retries: 1 } }));
});

it('does not let a late preload replace a newly logged-in owner', async () => {
  let release!: (value: { id: string }) => void;
  const state = preload(new Promise(resolve => { release = resolve; }));
  mocks.get.mockResolvedValue({ data: { id: 'new-owner' } });
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(state.profileConsumed).toBe(true));
  await act(async () => hook.result.current.login('new-token'));
  expect(state.cancelled).toBe(true);
  await act(async () => release({ id: 'old-owner' }));
  expect(hook.result.current.user?.id).toBe('new-owner');
  expect(hook.result.current.token).toBe('new-token');
});

it('cancels a pending preload when its provider unmounts', async () => {
  const state = preload(new Promise(() => {}));
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(state.profileConsumed).toBe(true));
  hook.unmount();
  expect(state.cancelled).toBe(true);
  expect(mocks.get).not.toHaveBeenCalled();
});
it('leaves network retry recovery to transport without an outer profile loop', async () => {
  mocks.get.mockRejectedValue({ response: { status: 503 } });
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  vi.useFakeTimers(); await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/users/me', expect.objectContaining({ apiPolicy: { retries: 2 }, signal: expect.any(AbortSignal) }));
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it('clears terminal auth failure without a second context refresh', async () => {
  mocks.get.mockRejectedValue({ response: { status: 401 } });
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.token).toBeNull(); expect(mocks.refresh).not.toHaveBeenCalled();
});

it('aborts an unfinished bootstrap profile when its provider unmounts', async () => {
  mocks.get.mockReturnValue(new Promise(() => {}));
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  const signal = mocks.get.mock.calls[0][1].signal as AbortSignal;
  hook.unmount(); expect(signal.aborted).toBe(true);
});

it('cancels an old bootstrap profile when a new login becomes authoritative', async () => {
  let release!: (value: { data: { id: string } }) => void;
  mocks.get.mockReturnValueOnce(new Promise(resolve => { release = resolve; }))
    .mockResolvedValue({ data: { id: 'new-owner' } });
  const hook = renderHook(useAuth, { wrapper });
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  const oldSignal = mocks.get.mock.calls[0][1].signal as AbortSignal;
  await act(async () => hook.result.current.login('new-token'));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => release({ data: { id: 'old-owner' } }));
  expect(hook.result.current.user?.id).toBe('new-owner');
  expect(hook.result.current.token).toBe('new-token');
});
