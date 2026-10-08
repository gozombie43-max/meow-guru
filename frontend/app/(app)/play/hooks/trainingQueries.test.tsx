import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import type { PropsWithChildren } from 'react';
import { useTrainingCapabilities } from './useTrainingCapabilities';
import { useTrainingDashboard } from './useTrainingDashboard';
import { useInvalidateTrainingDashboard } from './trainingQueries';

const mocks = vi.hoisted(() => ({ get: vi.fn(), auth: { user: { id: 'student' }, token: 'token', loading: false } }));
vi.mock('@/shared/api/client', () => ({ default: { get: mocks.get } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
let wrapper: (props: PropsWithChildren) => React.ReactNode;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth = { user: { id: 'student' }, token: 'token', loading: false };
  mocks.get.mockImplementation(async (url, options) => ({ data: { url, exam: options?.params?.exam, owner: mocks.auth.user.id } }));
  const cache = new Map();
  wrapper = ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const useQueries = (exam: string) => ({ capabilities: useTrainingCapabilities(), dashboard: useTrainingDashboard(exam) });

it('shares parallel hub reads with setup and concurrent consumers, even after token rotation', async () => {
  const hub = renderHook(() => useQueries('ssc'), { wrapper });
  await waitFor(() => expect(hub.result.current.dashboard.loading).toBe(false));
  await waitFor(() => expect(hub.result.current.capabilities.loading).toBe(false));
  hub.unmount();
  mocks.auth.token = 'rotated-token';
  const setup = renderHook(() => useQueries('ssc'), { wrapper });
  const other = renderHook(() => useQueries('ssc'), { wrapper });
  expect(setup.result.current.dashboard.dashboard).toBeTruthy();
  expect(other.result.current.capabilities.capabilities).toBeTruthy();
  await act(async () => { await Promise.resolve(); });
  expect(mocks.get.mock.calls.map(call => call[0]).sort()).toEqual(['/api/training/capabilities', '/api/training/dashboard']);
});

it('deduplicates simultaneous cold mounts', async () => {
  const one = renderHook(() => useQueries('ssc'), { wrapper });
  const two = renderHook(() => useQueries('ssc'), { wrapper });
  await waitFor(() => expect(one.result.current.dashboard.loading || two.result.current.capabilities.loading).toBe(false));
  expect(mocks.get).toHaveBeenCalledTimes(2);
});

it('refreshes a cached dashboard at an active deadline before its normal TTL', async () => {
  const now = Date.now();
  mocks.get.mockResolvedValue({ data: { active: [{ id: 'expiring', deadline: new Date(now + 1000).toISOString() }] } });
  const hub = renderHook(() => useTrainingDashboard('ssc'), { wrapper });
  await waitFor(() => expect(hub.result.current.loading).toBe(false));
  hub.unmount();
  vi.spyOn(Date, 'now').mockReturnValue(now + 1500);
  mocks.get.mockResolvedValue({ data: { active: [] } });
  const setup = renderHook(() => useTrainingDashboard('ssc'), { wrapper });
  await waitFor(() => expect(setup.result.current.dashboard?.active).toEqual([]));
  expect(mocks.get).toHaveBeenCalledTimes(2);
});

it('keys private data by owner and exam without showing another resource', async () => {
  const hook = renderHook(({ exam }) => useTrainingDashboard(exam), { initialProps: { exam: 'ssc' }, wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  hook.rerender({ exam: 'cat' });
  expect(hook.result.current.dashboard).toBeNull();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  mocks.auth.user = { id: 'second-student' };
  hook.rerender({ exam: 'cat' });
  expect(hook.result.current.dashboard).toBeNull();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(mocks.get).toHaveBeenCalledTimes(3);
});

it('expires dashboard snapshots and retries failures explicitly', async () => {
  const hub = renderHook(() => useQueries('ssc'), { wrapper });
  await waitFor(() => expect(hub.result.current.dashboard.loading).toBe(false));
  hub.unmount();
  await new Promise(resolve => setTimeout(resolve, 1100));
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + 16_000);
  mocks.get.mockRejectedValueOnce(new Error('offline'));
  const setup = renderHook(() => useQueries('ssc'), { wrapper });
  await waitFor(() => expect(setup.result.current.dashboard.error).toBeTruthy());
  expect(mocks.get).toHaveBeenCalledTimes(3);
  await act(async () => setup.result.current.dashboard.retry());
  await waitFor(() => expect(setup.result.current.dashboard.error).toBe(''));
  expect(mocks.get).toHaveBeenCalledTimes(4);
});

it('invalidates a dashboard after a session write even inside the deduplication window', async () => {
  const hub = renderHook(() => useQueries('ssc'), { wrapper });
  await waitFor(() => expect(hub.result.current.dashboard.loading).toBe(false));
  hub.unmount();
  const session = renderHook(() => useInvalidateTrainingDashboard(), { wrapper });
  await act(async () => session.result.current('student'));
  const next = renderHook(() => useQueries('ssc'), { wrapper });
  await waitFor(() => expect(next.result.current.dashboard.loading).toBe(false));
  expect(mocks.get.mock.calls.filter(call => call[0].endsWith('/dashboard'))).toHaveLength(2);
  expect(mocks.get.mock.calls.filter(call => call[0].endsWith('/capabilities'))).toHaveLength(1);
});

it('keeps a shared read alive for remaining consumers and aborts after the last leaves', async () => {
  let release!: (value: { data: object }) => void;
  mocks.get.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const one = renderHook(() => useTrainingDashboard('ssc'), { wrapper });
  const two = renderHook(() => useTrainingDashboard('ssc'), { wrapper });
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  const signal = mocks.get.mock.calls[0][1].signal as AbortSignal;
  one.unmount(); await act(async () => { await Promise.resolve(); });
  expect(signal.aborted).toBe(false);
  two.unmount(); await act(async () => { await Promise.resolve(); });
  expect(signal.aborted).toBe(true);
  await act(async () => release({ data: { stale: true } }));
});
