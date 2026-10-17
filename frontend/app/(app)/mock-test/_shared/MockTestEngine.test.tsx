import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MockTestEngine from './MockTestEngine';
import { StrictMode } from 'react';
import { seedStartResponse } from '@/lib/start-response-cache';
import { getMockStartKey } from './startKey';
import TestInstructions from './TestInstructions';
import { autosaveAttempt, getAttempt, getSlotDetails, startTest, submitAttempt } from './api';
import type { MockAttempt } from './api';
import { ApiError } from '@/shared/api/error';

const { replace, push, renderQuestion, search, authState } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), renderQuestion: vi.fn(), search: { resume: null as string | null }, authState: { token: 'test-token', user: { id: 'student' } as { id: string } | null, loading: false } }));
const router = { replace, push };
vi.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => ({ get: () => search.resume }) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('@/components/MathRenderer', () => ({ default: ({ text }: { text: string }) => {
  renderQuestion(text);
  return <span>{text}</span>;
} }));
vi.mock('./exam-config', () => ({ getSlotById: () => ({ configKey: 'ssc', title: 'Mock' }), getTotalQuestions: () => 1, getExamConfig: () => ({ name: 'Exam', totalDurationMin: 1, compositeTimer: true, sections: [{ label: 'Maths', questionCount: 1, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 } }] }) }));
vi.mock('./api', () => ({ startTest: vi.fn(), getAttempt: vi.fn(), getSlotDetails: vi.fn().mockResolvedValue({ slot: null }), autosaveAttempt: vi.fn(), submitAttempt: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-09T00:00:00Z'));
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  search.resume = null;
  authState.token = 'test-token';
  authState.user = { id: 'student' };
  authState.loading = false;
  window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: null }));
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
    fireEvent.click(screen.getAllByRole('radio')[0]);
    vi.mocked(autosaveAttempt).mockRejectedValueOnce(Object.assign(new Error('Another tab saved'), { conflict: true }));
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(screen.getByRole('button', { name: 'Reload saved attempt' })).toBeVisible();
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(autosaveAttempt).toHaveBeenCalledTimes(1);
  });
  it('does not autosave an unchanged attempt or rerender question content for clock ticks', async () => {
    await mount();
    renderQuestion.mockClear();
    await act(async () => { vi.advanceTimersByTime(40000); });
    expect(autosaveAttempt).not.toHaveBeenCalled();
    expect(renderQuestion).not.toHaveBeenCalled();
    expect(screen.getByText('00:20')).toBeVisible();
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
    expect(replace).toHaveBeenCalledWith('/mock-test/ssc-cgl/test/result/attempt');
  });
});

describe('creation response handoff', () => {
  it('uses uploaded paper instructions instead of the static exam layout', async () => {
    vi.mocked(getSlotDetails).mockResolvedValueOnce({ slot: { id: 'test', examSlug: 'ssc-chsl', configKey: 'ssc-chsl-tier1', title: 'Uploaded CHSL', isFree: true, order: 1,
      paperMetadata: { schemaDriven: true, examName: 'SSC CHSL Tier 1', compositeTimer: false, totalDurationMin: 30,
        sections: ['Math', 'English'].map(label => ({ key: label.toLowerCase(), label, questionCount: 25, timeLimitMin: 15, marking: { correct: 2, incorrect: 0.5 } })) } } });
    await act(async () => { render(<TestInstructions examSlug="ssc-chsl" testId="test" />); });
    expect(screen.getByText('Uploaded CHSL')).toBeVisible();
    expect(screen.getByText('Per section')).toBeVisible();
    expect(screen.getByText('50')).toBeVisible();
    expect(screen.getAllByText('25 questions · 15 min')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: 'हिन्दी' })).not.toBeInTheDocument();
  });
  it('waits for both completed restoration and a verified owner before loading an attempt', async () => {
    authState.loading = true;
    authState.user = null;
    search.resume = 'attempt';
    const data = { attemptId: 'attempt', timeLeft: 60, paper: { sections: [{ key: 'quant', label: 'Maths', questions: [{ id: 'q', question: 'Two plus two?', options: ['three', 'four'] }] }] } };
    vi.mocked(getAttempt).mockResolvedValue(data);
    const view = render(<MockTestEngine examSlug="ssc-cgl" testId="test" />);
    expect(getAttempt).not.toHaveBeenCalled();
    authState.loading = false;
    await act(async () => view.rerender(<MockTestEngine examSlug="ssc-cgl" testId="test" />));
    expect(getAttempt).not.toHaveBeenCalled();
    authState.user = { id: 'student' };
    await act(async () => view.rerender(<MockTestEngine examSlug="ssc-cgl" testId="test" />));
    expect(getAttempt).toHaveBeenCalledOnce();
  });
  it('uses one keyed POST through instructions and no attempt GET, including effect replay', async () => {
    await act(async () => { render(<TestInstructions examSlug="ssc-cgl" testId="test" />); });
    fireEvent.change(screen.getByRole('combobox', { name: 'Test language' }), { target: { value: 'hi' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start Mock Test/ })));
    expect(startTest).toHaveBeenCalledExactlyOnceWith('ssc-cgl', 'test', 'test-token', expect.any(String));
    expect(push).toHaveBeenCalledWith('/mock-test/ssc-cgl/test/attempt?resume=attempt&lang=hi');
    cleanup();
    search.resume = 'attempt';
    vi.advanceTimersByTime(5000);
    await act(async () => { render(<StrictMode><MockTestEngine examSlug="ssc-cgl" testId="test" /></StrictMode>); });
    expect(getAttempt).not.toHaveBeenCalled();
    expect(startTest).toHaveBeenCalledOnce();
    expect(screen.getByText('00:55')).toBeVisible();
    cleanup();
    vi.mocked(getAttempt).mockResolvedValue({ ...await vi.mocked(startTest).mock.results[0].value, timeLeft: 50 });
    await mount();
    expect(getAttempt).toHaveBeenCalledExactlyOnceWith('attempt', 'test-token', expect.any(AbortSignal));
    expect(screen.getByText('00:50')).toBeVisible();
  });
  it('ignores another account handoff and fetches on direct entry', async () => {
    const data = { attemptId: 'attempt', timeLeft: 60, paper: { sections: [{ key: 'quant', label: 'Maths', questions: [{ id: 'q', question: 'Two plus two?', options: ['three', 'four'] }] }] } };
    seedStartResponse('mock:ssc-cgl:test', 'other-account', 'attempt', data);
    search.resume = 'attempt';
    vi.mocked(getAttempt).mockResolvedValue(data);
    await mount();
    expect(getAttempt).toHaveBeenCalledOnce();
  });
  it('uses the same start key after a failed instruction request and isolates accounts', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(startTest).mockRejectedValueOnce(new Error('Response lost'));
    await act(async () => { render(<TestInstructions examSlug="ssc-cgl" testId="test" />); });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start Mock Test/ })));
    expect(screen.getByRole('alert')).toHaveTextContent('Response lost');
    expect(screen.getByRole('button', { name: 'Retry Start Mock Test' })).toBeEnabled();
    expect(alert).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start Mock Test/ })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const keys = vi.mocked(startTest).mock.calls.map(call => call[3]);
    expect(keys[0]).toBe(keys[1]);
    expect(getMockStartKey('student', 'ssc-cgl', 'test')).toBe(keys[0]);
    expect(getMockStartKey('other-account', 'ssc-cgl', 'test')).not.toBe(keys[0]);
    vi.restoreAllMocks();
  });
  it('explains an expired session and offers sign-in without a browser popup', async () => {
    vi.mocked(startTest).mockRejectedValueOnce(new ApiError('Unauthorized', 'http', 401));
    await act(async () => { render(<TestInstructions examSlug="ssc-cgl" testId="test" />); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start Mock Test' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired');
    expect(screen.getByRole('button', { name: 'Start Mock Test' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in again' }));
    expect(push).toHaveBeenCalledWith('/login');
  });
});

it('keeps local answers and save revision through token rotation without reloading', async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MockTestEngine examSlug="ssc-cgl" testId="test" />); });
  fireEvent.click(screen.getByRole('radio', { name: 'Answer four' }));
  authState.token = 'rotated';
  await act(async () => view.rerender(<MockTestEngine examSlug="ssc-cgl" testId="test" />));
  expect(startTest).toHaveBeenCalledTimes(1); expect(getAttempt).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: 'Answer four' })).toBeChecked();
  await act(async () => vi.advanceTimersByTime(20_000));
  expect(autosaveAttempt).toHaveBeenLastCalledWith('attempt', expect.objectContaining({ answers: { q: '1' }, revision: 1 }), 'rotated');
});
it('aborts stale attempt reads and ignores a late response', async () => {
  search.resume = 'old';
  let release!: (value: Awaited<ReturnType<typeof getAttempt>>) => void;
  vi.mocked(getAttempt).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MockTestEngine examSlug="ssc-cgl" testId="test" />); });
  const signal = vi.mocked(getAttempt).mock.calls[0][2];
  search.resume = 'new';
  vi.mocked(getAttempt).mockResolvedValue({ paper: { sections: [{ questions: [{ id: 'new', question: 'New attempt' }] }] }, timeLeft: 60 });
  await act(async () => view.rerender(<MockTestEngine examSlug="ssc-cgl" testId="test" />));
  expect(signal?.aborted).toBe(true);
  await act(async () => release({ status: 'completed', id: 'old' }));
  expect(replace).not.toHaveBeenCalled(); expect(screen.getByText('New attempt')).toBeVisible();
});

it('keeps a late autosave completion from replacing another attempt revision', async () => {
  const loaded = { revision: 5, timeLeft: 60, paper: { sections: [{ questions: [{ id: 'q', question: 'Two plus two?', options: ['three', 'four'] }] }] } };
  search.resume = 'old'; vi.mocked(getAttempt).mockResolvedValue(loaded);
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MockTestEngine examSlug="ssc-cgl" testId="test" />); });
  let finishOld!: (value: { revision: number }) => void;
  vi.mocked(autosaveAttempt).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
  fireEvent.click(screen.getByRole('radio', { name: 'Answer four' }));
  await act(async () => vi.advanceTimersByTime(20_000));
  expect(autosaveAttempt).toHaveBeenLastCalledWith('old', expect.objectContaining({ baseRevision: 5, revision: 6 }), 'test-token');
  search.resume = 'new'; vi.mocked(getAttempt).mockResolvedValue({ ...loaded, revision: 1 });
  await act(async () => view.rerender(<MockTestEngine examSlug="ssc-cgl" testId="test" />));
  await act(async () => finishOld({ revision: 6 }));
  vi.mocked(autosaveAttempt).mockResolvedValue({ revision: 2 });
  fireEvent.click(screen.getByRole('radio', { name: 'Answer four' }));
  await act(async () => vi.advanceTimersByTime(20_000));
  expect(autosaveAttempt).toHaveBeenLastCalledWith('new', expect.objectContaining({ baseRevision: 1, revision: 2 }), 'test-token');
});


describe('shared JAM answer controls', () => {
  it('saves multiple selections as a set and deselects individual options', async () => {
    vi.mocked(startTest).mockResolvedValueOnce({ attemptId: 'attempt', timeLeft: 60, paper: { sections: [{ key: 'b', questions: [{ id: 'q', question: 'Select all', questionType: 'MSQ', options: ['A', 'B', 'C'] }] }] } });
    await mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Answer A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Answer C' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Answer A' }));
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(autosaveAttempt).toHaveBeenCalledWith('attempt', expect.objectContaining({ answers: { q: ['2'] } }), 'test-token');
  });
  it('saves numerical zero as an answer', async () => {
    vi.mocked(startTest).mockResolvedValueOnce({ attemptId: 'attempt', timeLeft: 60, paper: { sections: [{ key: 'c1', questions: [{ id: 'q', question: 'Number?', questionType: 'NAT', options: [] }] }] } });
    await mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Numerical answer' }), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(autosaveAttempt).toHaveBeenCalledWith('attempt', expect.objectContaining({ answers: { q: '0' }, questionStatuses: { q: 'answered' } }), 'test-token');
  });
});

function nativeAttempt(): MockAttempt & { attemptId: string } {
  const nativeQuestion = (id: string) => ({ id, question: `English ${id}`, options: ['A', 'B', 'C', 'D'].map((letter, i) => ({ id: letter, text: `Option ${i + 1}` })),
    translations: { question: { en: `English ${id}`, bn: `বাংলা ${id}` }, options: { en: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], bn: ['এক', 'দুই', 'তিন', 'চার'] } } });
  return { attemptId: 'native', language: 'en', currentSection: 0, currentQuestion: 0, revision: 0,
    sectionRemainingTimes: { english: 60, computer: 120 }, lockedSections: [],
    paper: { schemaDriven: true, compositeTimer: false, sections: [
      { key: 'english', label: 'English', timeLimitMin: 1, questions: [nativeQuestion('e1'), nativeQuestion('e2')] },
      { key: 'computer', label: 'Computer', timeLimitMin: 2, questions: [nativeQuestion('c1')] },
    ] } };
}

describe('native bilingual paper attempts', () => {
  it('submits once after the last section expires', async () => {
    const data = nativeAttempt();
    vi.mocked(startTest).mockResolvedValue({ ...data, currentSection: 1, lockedSections: ['english'], sectionRemainingTimes: { english: 0, computer: 1 } });
    vi.mocked(autosaveAttempt).mockImplementation(async (_id, progress) => progress.advanceSection ? { revision: progress.revision, currentSection: 1, currentQuestion: 0,
      lockedSections: ['english', 'computer'], sectionRemainingTimes: { english: 0, computer: 0 }, sectionsExhausted: true } : { revision: progress.revision });
    await mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Answer Option 2' }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(autosaveAttempt).toHaveBeenCalledWith('native', expect.objectContaining({ advanceSection: true }), 'test-token');
    expect(submitAttempt).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith('/mock-test/ssc-cgl/test/result/native');
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(submitAttempt).toHaveBeenCalledOnce();
  });
  it('retries a failed section save without submitting the entire paper', async () => {
    vi.mocked(startTest).mockResolvedValue(nativeAttempt());
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Save & Next' }));
    vi.mocked(autosaveAttempt).mockRejectedValueOnce(new Error('Section save failed'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save & Next' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Section save failed');
    vi.mocked(autosaveAttempt).mockResolvedValue({ revision: 1, currentSection: 1, currentQuestion: 0, lockedSections: ['english'], sectionRemainingTimes: { english: 0, computer: 120 } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry saving section' })); });
    expect(screen.getByText('English c1')).toBeVisible();
    expect(submitAttempt).not.toHaveBeenCalled();
  });
  it('does not invent a global countdown for a paper with no durations', async () => {
    const data = nativeAttempt();
    vi.mocked(startTest).mockResolvedValue({ ...data, paper: { ...data.paper!, compositeTimer: true }, sectionRemainingTimes: undefined });
    await mount();
    expect(screen.getByText('Untimed')).toBeVisible();
    await act(async () => { vi.advanceTimersByTime(3600000); });
    expect(submitAttempt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Computer' }));
    expect(screen.getByText('English c1')).toBeVisible();
  });
  it('preserves answers, review flags, visits, navigation and elapsed time across language changes', async () => {
    vi.mocked(startTest).mockResolvedValue(nativeAttempt());
    await mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Answer Option 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark for Review' }));
    expect(screen.getByText('English e2')).toBeVisible();
    await act(async () => { vi.advanceTimersByTime(10000); });
    fireEvent.click(screen.getByRole('button', { name: 'বাংলা' }));
    expect(screen.getByText('বাংলা e2')).toBeVisible();
    expect(screen.getByText('00:50')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('radio', { name: 'Answer দুই' })).toBeChecked();
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(autosaveAttempt).toHaveBeenLastCalledWith('native', expect.objectContaining({ language: 'bn', answers: { e1: 'B' }, questionStatuses: { e1: 'answered_marked', e2: 'not_answered' } }), 'test-token');
    expect(startTest).toHaveBeenCalledOnce();
  });
  it('saves expiring sections, moves to the next timer and blocks returning to a locked section', async () => {
    vi.mocked(startTest).mockResolvedValue(nativeAttempt());
    vi.mocked(autosaveAttempt).mockImplementation(async (_id, progress) => progress.advanceSection
      ? { revision: progress.revision, currentSection: 1, currentQuestion: 0, lockedSections: ['english'], sectionRemainingTimes: { english: 0, computer: 119 }, sectionsExhausted: false }
      : { revision: progress.revision });
    await mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Answer Option 2' }));
    vi.setSystemTime(new Date('2026-09-09T00:01:01Z'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('English c1')).toBeVisible();
    expect(screen.getByText('01:59')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'English (locked)' }));
    expect(screen.getByText('English c1')).toBeVisible();
    expect(autosaveAttempt).toHaveBeenCalledWith('native', expect.objectContaining({ answers: { e1: 'B' }, advanceSection: true }), 'test-token');
    expect(submitAttempt).not.toHaveBeenCalled();
  });
  it('recovers an unsent draft and language after refresh without restarting the server timer', async () => {
    vi.mocked(startTest).mockResolvedValue(nativeAttempt());
    await mount();
    fireEvent.click(screen.getByRole('radio', { name: 'Answer Option 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'বাংলা' }));
    cleanup();
    const resumed = { ...nativeAttempt(), sectionRemainingTimes: { english: 45, computer: 120 } };
    vi.mocked(startTest).mockResolvedValue(resumed);
    await mount();
    expect(screen.getByRole('button', { name: 'বাংলা' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'Answer দুই' })).toBeChecked();
    expect(screen.getByText('00:45')).toBeVisible();
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(autosaveAttempt).toHaveBeenLastCalledWith('native', expect.objectContaining({ language: 'bn', answers: { e1: 'B' } }), 'test-token');
  });
});
