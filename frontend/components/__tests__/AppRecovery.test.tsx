import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AppRecovery from '../AppRecovery';
vi.mock('@/lib/feedback', () => ({ announceFeedback: vi.fn() }));
afterEach(() => { sessionStorage.clear(); vi.useRealTimers(); });

it('preserves the mounted application through ordinary offline/online cycles', async () => {
  vi.useFakeTimers();
  render(<AppRecovery />);
  act(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(sessionStorage.getItem('app-recovery-last-reload-at')).toBeNull();
  expect(sessionStorage.getItem('app-recovery-offline-detected')).toBeNull();
});
