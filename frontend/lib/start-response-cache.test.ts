import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { seedStartResponse, readStartResponse, clearStartResponse, startResponseEpoch } from './start-response-cache';
const logout = () => window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: null }));
beforeEach(() => { logout(); vi.useFakeTimers(); vi.setSystemTime(100_000); });
afterEach(() => { logout(); vi.useRealTimers(); });
it('isolates owner, resource and id, and retains the original receive time', () => {
  seedStartResponse('training', 'one', 'id', { revision: 0 });
  vi.advanceTimersByTime(5000);
  expect(readStartResponse('training', 'one', 'id')).toEqual({ data: { revision: 0 }, receivedAt: 100_000 });
  expect(readStartResponse('training', 'two', 'id')).toBeUndefined();
  expect(readStartResponse('mock', 'one', 'id')).toBeUndefined();
  expect(readStartResponse('training', undefined, 'id')).toBeUndefined();
  clearStartResponse('training', 'one', 'id');
  expect(readStartResponse('training', 'one', 'id')).toBeUndefined();
});
it('expires handoffs and clears them on logout', () => {
  seedStartResponse('training', 'one', 'id', {});
  vi.advanceTimersByTime(30_000);
  expect(readStartResponse('training', 'one', 'id')).toBeUndefined();
  seedStartResponse('training', 'one', 'id', {});
  logout();
  expect(readStartResponse('training', 'one', 'id')).toBeUndefined();
});

it('does not seed a create response that arrived after logout', () => {
  const epoch = startResponseEpoch();
  logout();
  seedStartResponse('training', 'one', 'id', {}, epoch);
  expect(readStartResponse('training', 'one', 'id')).toBeUndefined();
});
