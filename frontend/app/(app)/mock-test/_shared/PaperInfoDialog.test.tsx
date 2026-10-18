import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PaperInfoDialog from './PaperInfoDialog';
import { startTest } from './api';
import { mockStartStorageKey } from './startKey';

const mocks = vi.hoisted(() => ({ push: vi.fn(), seed: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'token', user: { id: 'student' } }) }));
vi.mock('@/lib/start-response-cache', () => ({ seedStartResponse: mocks.seed, startResponseEpoch: () => 0 }));
vi.mock('./api', () => ({ startTest: vi.fn() }));
const slot = { id: 'paper', examSlug: 'ssc-chsl', configKey: 'ssc-chsl-tier1', title: 'Official paper', order: 1, isFree: true };
const fresh = { attemptId: 'new-attempt', answers: {}, paper: { sections: [{ questions: [{ id: 'q' }] }] } };
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); vi.mocked(startTest).mockResolvedValue(fresh); });
afterEach(cleanup);

it('opens without resetting and closes without changing progress', () => {
  const close = vi.fn();
  render(<PaperInfoDialog slot={slot} canRestart onClose={close} />);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(startTest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close paper info' }));
  expect(close).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss paper info' }));
  expect(close).toHaveBeenCalledTimes(2);
  expect(startTest).not.toHaveBeenCalled();
});

it('starts a fresh attempt and navigates with the new attempt ID', async () => {
  render(<PaperInfoDialog slot={slot} canRestart onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Restart test' }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/mock-test/ssc-chsl/paper/attempt?resume=new-attempt'));
  expect(startTest).toHaveBeenCalledWith('ssc-chsl', 'paper', 'token', expect.any(String), true);
  expect(sessionStorage.getItem(mockStartStorageKey('student', 'ssc-chsl', 'paper'))).toBe(vi.mocked(startTest).mock.calls[0][3]);
  expect(mocks.seed).toHaveBeenCalledWith('mock:ssc-chsl:paper', 'student', 'new-attempt', fresh, 0);
});

it('retains an idempotency key when retrying a failed restart', async () => {
  vi.mocked(startTest).mockRejectedValueOnce(new Error('Connection interrupted'));
  render(<PaperInfoDialog slot={slot} canRestart onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Restart test' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Restart test' }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
  expect(vi.mocked(startTest).mock.calls[0][3]).toBe(vi.mocked(startTest).mock.calls[1][3]);
});

it.each([false, true])('does not offer a restart for confidential papers (attempted: %s)', canRestart => {
  render(<PaperInfoDialog slot={{ ...slot, assessmentMode: 'confidential' }} canRestart={canRestart} onClose={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Restart test' })).not.toBeInTheDocument();
  expect(startTest).not.toHaveBeenCalled();
});
