import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ResultReport from './ResultReport';
import { getAttempt, getSlotDetails, startTest, type MockAttempt } from './api';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('@/hooks/useAppNavigation', () => ({ useAppNavigation: () => navigation }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'token', user: { id: 'student' }, loading: false }) }));
vi.mock('./api', () => ({ getAttempt: vi.fn(), getSlotDetails: vi.fn(), startTest: vi.fn() }));
const attempt: MockAttempt = { assessmentMode: 'practice', paper: { examName: 'SSC CHSL Tier I', sections: [] }, result: {
  totalScore: 20, maxScore: 50, sections: [{ key: 'math', label: 'Math', correct: 10, incorrect: 0, skipped: 15, score: 20, maxScore: 50 }],
} };
const slot = { id: 'paper', examSlug: 'ssc-chsl', title: 'Official paper', configKey: 'ssc-chsl-tier1', order: 1, isFree: true };
const mount = () => render(<ResultReport examSlug="ssc-chsl" testId="paper" attemptId="completed-attempt" />);
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  vi.mocked(getAttempt).mockResolvedValue(attempt);
  vi.mocked(getSlotDetails).mockResolvedValue({ slot });
  vi.mocked(startTest).mockResolvedValue({ attemptId: 'fresh-attempt', paper: { sections: [] } });
});

it('navigates directly to a selected review section and returns to the exam catalog', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Review Math' }));
  expect(navigation.push).toHaveBeenCalledWith('/mock-test/ssc-chsl/paper/review/completed-attempt?section=math');
  fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));
  expect(navigation.push).toHaveBeenCalledWith('/mock-test/ssc-chsl/paper/review/completed-attempt');
  fireEvent.click(screen.getByRole('button', { name: 'All tests' }));
  expect(navigation.back).toHaveBeenCalledWith('/mock-test/ssc-chsl');
});

it('prepares a retake without starting it, then starts a fresh attempt after confirmation', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Retake' }));
  await screen.findByRole('dialog', { name: 'Paper info' });
  expect(getSlotDetails).toHaveBeenCalledWith('paper', 'ssc-chsl', expect.any(AbortSignal));
  expect(startTest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Restart test' }));
  await waitFor(() => expect(startTest).toHaveBeenCalledWith('ssc-chsl', 'paper', 'token', expect.any(String), true));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/mock-test/ssc-chsl/paper/attempt?resume=fresh-attempt'));
});

it('allows retrying a failed retake preparation while keeping the result visible', async () => {
  vi.mocked(getSlotDetails).mockRejectedValueOnce(new Error('Paper unavailable. Try again.'));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Retake' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Paper unavailable. Try again.');
  expect(screen.getByRole('region', { name: 'Score summary' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
  await screen.findByRole('dialog', { name: 'Paper info' });
  expect(getSlotDetails).toHaveBeenCalledTimes(2);
});

it('retries a failed result read without leaving the page', async () => {
  vi.mocked(getAttempt).mockRejectedValueOnce(new Error('Network unavailable'));
  mount();
  expect(screen.getByRole('status')).toHaveTextContent('Loading results…');
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await screen.findByRole('region', { name: 'Score summary' });
  expect(getAttempt).toHaveBeenCalledTimes(2);
});
