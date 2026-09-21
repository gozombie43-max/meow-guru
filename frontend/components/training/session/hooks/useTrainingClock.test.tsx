import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TrainingSession } from '../../training-types';
import { useTrainingClock, useTrainingNow } from './useTrainingClock';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1700000000000); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const session = () => ({ status: 'active', deadline: new Date(Date.now() + 10000).toISOString() }) as TrainingSession;

it('keeps the parent stable while the leaf clock ticks and finishes at the server deadline', async () => {
  const s = session();
  const sync = { serverNow: Date.now(), receivedAt: Date.now() };
  const finish = vi.fn().mockResolvedValue(undefined);
  let renders = 0;
  const parent = renderHook(() => { renders++; return useTrainingClock(s, sync, finish, false, ''); });
  const leaf = renderHook(() => useTrainingNow(sync));
  const initialRenders = renders;
  act(() => vi.advanceTimersByTime(5000));
  expect(renders).toBe(initialRenders);
  expect(leaf.result.current).toBe(sync.serverNow + 5000);
  expect(finish).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
  expect(parent.result.current.expired).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(finish).toHaveBeenCalledExactlyOnceWith({ type: 'finish' });
});

it('waits for an in-flight action and suppresses timeout retries after an error', async () => {
  const s = session(), sync = { serverNow: Date.now(), receivedAt: Date.now() }, finish = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ busy, error }) => useTrainingClock(s, sync, finish, busy, error), { initialProps: { busy: true, error: '' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
  expect(finish).not.toHaveBeenCalled();
  hook.rerender({ busy: false, error: 'Save failed' });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(finish).not.toHaveBeenCalled();
  hook.rerender({ busy: false, error: '' });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(finish).toHaveBeenCalledTimes(1);
});

it('uses server time skew and cleans up timers on unmount', async () => {
  const s = session();
  const sync = { serverNow: Date.now() + 9000, receivedAt: Date.now() };
  const finish = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useTrainingClock(s, sync, finish, false, ''));
  await act(async () => { await vi.advanceTimersByTimeAsync(999); });
  expect(finish).not.toHaveBeenCalled();
  hook.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(finish).not.toHaveBeenCalled();
});
