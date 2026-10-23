import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import TestInstructions from './TestInstructions';
import { getSlotDetails, startTest } from './api';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('@/hooks/useAppNavigation', () => ({ useAppNavigation: () => navigation }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'token', user: { id: 'student' } }) }));
vi.mock('./api', () => ({ getSlotDetails: vi.fn(), startTest: vi.fn() }));
vi.mock('./exam-config', () => ({ getSlotById: () => null, getExamConfig: () => ({ name: 'Exam', totalDurationMin: 60, compositeTimer: true, sections: [] }), getTotalQuestions: () => 100 }));
const slot = { id: 'paper', title: 'Practice paper', configKey: 'ssc', examSlug: 'ssc-cgl', order: 1, isFree: true };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getSlotDetails).mockResolvedValue({ slot }); });

it('shows a retry and parent Back when instructions fail, then recovers', async () => {
  vi.mocked(getSlotDetails).mockRejectedValueOnce(new Error('Paper unavailable'));
  render(<TestInstructions examSlug="ssc-cgl" testId="paper" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Paper unavailable');
  expect(screen.queryByText('Loading test instructions…')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading instructions' }));
  expect(await screen.findByRole('button', { name: 'Start Mock Test' })).toBeVisible();
});

it('does not navigate back into a test when its start response arrives after leaving', async () => {
  let finish!: (value: { attemptId: string }) => void;
  vi.mocked(startTest).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<TestInstructions examSlug="ssc-cgl" testId="paper" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Mock Test' }));
  view.unmount();
  await act(async () => finish({ attemptId: 'late-attempt' }));
  expect(navigation.replace).not.toHaveBeenCalled();
});

it('goes directly to an already completed result without briefly opening the attempt', async () => {
  vi.mocked(startTest).mockResolvedValue({ attemptId: 'done', status: 'completed' });
  render(<TestInstructions examSlug="ssc-cgl" testId="paper" />);
  const start = await screen.findByRole('button', { name: 'Start Mock Test' });
  await act(async () => fireEvent.click(start));
  expect(navigation.replace).toHaveBeenCalledExactlyOnceWith('/mock-test/ssc-cgl/paper/result/done');
});

it('allows changing language on retake and starts a fresh attempt with restart flag', async () => {
  vi.mocked(startTest).mockResolvedValue({ attemptId: 'retake-attempt', paper: { sections: [{ questions: [] }] } });
  render(<TestInstructions examSlug="ssc-cgl" testId="paper" isRetake />);
  expect(await screen.findByText('Practice paper')).toBeInTheDocument();
  expect(screen.getByText('Exam')).toBeInTheDocument();
  expect(screen.getByText('60 mins')).toBeInTheDocument();
  const langSelect = screen.getByRole('combobox', { name: 'Test language' });
  expect(langSelect).toHaveValue('en');
  fireEvent.change(langSelect, { target: { value: 'bn' } });
  const start = screen.getByRole('button', { name: 'Start Mock Test' });
  await act(async () => fireEvent.click(start));
  expect(startTest).toHaveBeenCalledWith('ssc-cgl', 'paper', 'token', expect.any(String), true);
  expect(navigation.replace).toHaveBeenCalledWith('/mock-test/ssc-cgl/paper/attempt?resume=retake-attempt&lang=bn');
});

it('preselects initialLanguage on retake and allows rechanging language before starting', async () => {
  vi.mocked(startTest).mockResolvedValue({ attemptId: 'retake-attempt-bn', paper: { sections: [{ questions: [] }] } });
  render(<TestInstructions examSlug="ssc-cgl" testId="paper" isRetake initialLanguage="bn" />);
  const langSelect = await screen.findByRole('combobox', { name: 'Test language' });
  expect(langSelect).toHaveValue('bn');
  // Re-change language back to English before starting
  fireEvent.change(langSelect, { target: { value: 'en' } });
  const start = screen.getByRole('button', { name: 'Start Mock Test' });
  await act(async () => fireEvent.click(start));
  expect(startTest).toHaveBeenCalledWith('ssc-cgl', 'paper', 'token', expect.any(String), true);
  expect(navigation.replace).toHaveBeenCalledWith('/mock-test/ssc-cgl/paper/attempt?resume=retake-attempt-bn&lang=en');
});

it('does not resume a previous attempt when retaking even if resumeAttemptId is passed', async () => {
  vi.mocked(startTest).mockResolvedValue({ attemptId: 'fresh-retake-attempt', paper: { sections: [{ questions: [] }] } });
  render(<TestInstructions examSlug="ssc-cgl" testId="paper" isRetake resumeAttemptId="stale-attempt-99" />);
  const start = await screen.findByRole('button', { name: 'Start Mock Test' });
  expect(start).toHaveTextContent('Start Mock Test');
  await act(async () => fireEvent.click(start));
  expect(startTest).toHaveBeenCalledWith('ssc-cgl', 'paper', 'token', expect.any(String), true);
  expect(navigation.replace).toHaveBeenCalledWith('/mock-test/ssc-cgl/paper/attempt?resume=fresh-retake-attempt&lang=en');
});

it('disables retake start and warns if assessment is confidential', async () => {
  vi.mocked(getSlotDetails).mockResolvedValueOnce({ slot: { ...slot, assessmentMode: 'confidential' } });
  render(<TestInstructions examSlug="ssc-cgl" testId="paper" isRetake />);
  const start = await screen.findByRole('button', { name: 'Start Mock Test' });
  expect(start).toBeDisabled();
  await act(async () => fireEvent.click(start));
  expect(startTest).not.toHaveBeenCalled();
});
