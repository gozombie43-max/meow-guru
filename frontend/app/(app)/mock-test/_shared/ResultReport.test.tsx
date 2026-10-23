import { fireEvent, render, screen } from '@testing-library/react';
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

it('navigates to instructions page on retake without directly starting the test and preserves attempt language', async () => {
  vi.mocked(getAttempt).mockResolvedValueOnce({ ...attempt, language: 'bn' });
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Retake' }));
  expect(startTest).not.toHaveBeenCalled();
  expect(navigation.push).toHaveBeenCalledWith('/mock-test/ssc-chsl/paper?retake=true&lang=bn');
});

it('does not allow retake navigation for confidential assessments', async () => {
  vi.mocked(getAttempt).mockResolvedValueOnce({ ...attempt, assessmentMode: 'confidential' });
  mount();
  expect(await screen.findByText('Confidential · Review and retakes unavailable.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Retake' })).not.toBeInTheDocument();
  expect(startTest).not.toHaveBeenCalled();
});

it('retries a failed result read without leaving the page', async () => {
  vi.mocked(getAttempt).mockRejectedValueOnce(new Error('Network unavailable'));
  mount();
  expect(screen.getByRole('status')).toHaveTextContent('Loading results…');
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  await screen.findByRole('region', { name: 'Score summary' });
  expect(getAttempt).toHaveBeenCalledTimes(2);
});

it('shows the saved paper title below the result heading', async () => {
  mount();
  expect(await screen.findByText('Official paper')).toHaveAttribute('title', 'Official paper');
});

it('keeps results available when paper metadata cannot be loaded', async () => {
  vi.mocked(getSlotDetails).mockRejectedValueOnce(new Error('Unavailable'));
  mount();
  expect(await screen.findByRole('region', { name: 'Score summary' })).toBeInTheDocument();
  expect(screen.getByText('SSC CHSL Tier I')).toBeInTheDocument();
});

it('includes the saved exam date in the result subtitle', async () => {
  vi.mocked(getSlotDetails).mockResolvedValueOnce({ slot: { ...slot, title: 'SSC CHSL 2025 S2', examDate: '2025-11-12' } });
  mount();
  expect(await screen.findByText('SSC CHSL 2025 12 NOV S2')).toBeInTheDocument();
});
