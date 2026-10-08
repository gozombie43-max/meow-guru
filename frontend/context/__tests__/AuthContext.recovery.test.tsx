import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
const mocks = vi.hoisted(() => ({ get: vi.fn(), refresh: vi.fn(), restore: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: vi.fn() }, AUTH_TOKEN_CHANGED_EVENT: 'auth-token',
  clearLegacyAuthStorage: vi.fn(), getAccessToken: () => 'token', requestTokenRefresh: mocks.refresh, updateAccessToken: vi.fn() }));
vi.mock('@/lib/session-bootstrap', () => ({ restorePreparedSession: mocks.restore, discardPreparedSession: vi.fn() }));
vi.mock('@/lib/socket-lifecycle', () => ({ disconnectSocket: vi.fn() }));
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
beforeEach(() => { vi.clearAllMocks(); mocks.restore.mockResolvedValue('token'); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
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
