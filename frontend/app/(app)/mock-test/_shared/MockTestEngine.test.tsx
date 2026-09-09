import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MockTestEngine from './MockTestEngine';
import { autosaveAttempt, startTest, submitAttempt } from './api';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => null }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('@/components/MathRenderer', () => ({ default: ({ text }: { text: string }) => <span>{text}</span> }));
vi.mock('./api', () => ({ startTest: vi.fn(), getAttempt: vi.fn(), autosaveAttempt: vi.fn(), submitAttempt: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-09T00:00:00Z'));
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(startTest).mockResolvedValue({ attemptId: 'attempt', timeLeft: 60, paper: {
    sections: [{ key: 'quant', label: 'Maths', questions: [{ id: 'q', question: 'Two plus two?', options: ['three', 'four'] }] }],
  } });
  vi.mocked(autosaveAttempt).mockResolvedValue({ ok: true });
  vi.mocked(submitAttempt).mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function mount() {
  await act(async () => { render(<MockTestEngine examSlug="ssc-cgl" testId="test" />); });
}

describe('test attempt persistence and expiry', () => {
  it('shows load failures with a retry action', async () => {
    vi.mocked(startTest).mockRejectedValueOnce(new Error('Paper is unavailable'));
    await mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Paper is unavailable');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry loading test' })); });
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('does not repeatedly submit and alert after an expiry network failure', async () => {
    await mount();
    vi.mocked(submitAttempt).mockRejectedValueOnce(new Error('Network unavailable'));
    vi.setSystemTime(new Date('2026-09-09T00:02:00Z'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(submitAttempt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Submission failed');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry submission' })); });
    expect(submitAttempt).toHaveBeenCalledTimes(2);
  });

  it('surfaces multi-tab conflicts and stops further saves until reload', async () => {
    await mount();
    vi.mocked(autosaveAttempt).mockRejectedValueOnce(Object.assign(new Error('Another tab saved'), { conflict: true }));
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(screen.getByRole('button', { name: 'Reload saved attempt' })).toBeVisible();
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(autosaveAttempt).toHaveBeenCalledTimes(1);
  });
  it('saves current answers after 20 seconds even when the student keeps changing them', async () => {
    await mount();
    for (let i = 0; i < 3; i++) {
      await act(async () => { vi.advanceTimersByTime(5000); });
      fireEvent.click(screen.getAllByRole('radio')[i % 2]);
    }
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(autosaveAttempt).toHaveBeenCalledWith('attempt', expect.objectContaining({ answers: { q: '0' } }), 'test-token');
  });

  it('submits after a background time jump even when the confirmation modal is open and autosave has expired', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Test' }));
    vi.mocked(autosaveAttempt).mockRejectedValue(Object.assign(new Error('Expired'), { submissionAllowed: true }));
    vi.setSystemTime(new Date('2026-09-09T00:02:00Z'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(submitAttempt).toHaveBeenCalledWith('attempt', 'test-token');
    expect(push).toHaveBeenCalledWith('/mock-test/ssc-cgl/test/result/attempt');
  });
});
