import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizQuestion, SubjectConfig } from '@/features/quiz/model/types';
import { useQuizController } from '@/features/quiz/hooks/useQuizController';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  authLoading: false,
  questions: [] as QuizQuestion[],
  hasMore: false,
  isFetchingMore: false,
  fetchMore: vi.fn(),
  ensureQuestion: vi.fn().mockResolvedValue(undefined),
  start: vi.fn(), stop: vi.fn(), progress: vi.fn().mockResolvedValue({}),
  refreshUser: vi.fn(), recentQuizzes: [] as Record<string, unknown>[], submitQuizAnswer: vi.fn().mockResolvedValue({}),
  prefetchQuestionReveals: vi.fn().mockResolvedValue({}),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.params }));
vi.mock('@/hooks/useAppNavigation', () => ({ useBackLayer: vi.fn(), useQuizLeaveGuard: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'token', loading: mocks.authLoading, user: { recentQuizzes: mocks.recentQuizzes }, refreshUser: mocks.refreshUser }) }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/features/quiz/components/QuizThemeProvider', () => ({ useQuizTheme: () => 'light', useQuizThemeControls: () => ({ toggleTheme: vi.fn() }) }));
vi.mock('@/features/quiz/components/useQuizPreferences', () => ({ useQuizPreferences: () => ({}) }));
vi.mock('@/hooks/useTranslatedQuestion', () => ({ useTranslatedQuestion: () => ({}) }));
vi.mock('@/lib/userApi', () => ({
  updateProgress: mocks.progress,
  submitQuizAnswer: mocks.submitQuizAnswer,
  prefetchQuestionReveals: mocks.prefetchQuestionReveals,
  saveRecentQuiz: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/features/quiz/hooks/useQuizFilters', () => ({
  useQuizFilters: () => ({
    questions: mocks.questions,
    hasMore: mocks.hasMore,
    isFetchingMore: mocks.isFetchingMore,
    fetchMore: mocks.fetchMore,
    ensureQuestion: mocks.ensureQuestion,
    selectedClassificationConcepts: new Set(),
    setConceptFilter: vi.fn(),
    setExamFilter: vi.fn(),
    setSelectedClassificationConcepts: vi.fn(),
  }),
}));
vi.mock('@/features/quiz/hooks/useQuizBookmarks', () => ({ useQuizBookmarks: () => ({}) }));
vi.mock('@/features/quiz/hooks/useQuizKeyboard', () => ({ useQuizKeyboard: vi.fn() }));
vi.mock('@/features/quiz/hooks/useQuizSync', () => ({ useQuizSync: vi.fn() }));
vi.mock('@/features/quiz/hooks/useQuizTimer', () => ({ useQuizTimer: () => ({ timerRef: { current: { getTimeLeft: () => 45 } }, maxTime: 60, startTimer: mocks.start, stopTimer: mocks.stop }) }));

const subjectConfig: SubjectConfig = { subjectId: 'math', subjectLabel: 'Math', cssClassName: 'math', topicConcepts: {}, classificationCategories: [], getClassificationCategoryId: () => '' };
const question = (id: number): QuizQuestion => ({ id, concept: 'percentages', formula: '', question: 'One plus one?', options: ['1', '2'], correctAnswer: 1, answer: '2', difficulty: 'medium', estimatedTime: 60, year: '', exam: '', solution: '2' });
const unrevealedQuestion = (id: number, overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  ...question(id),
  correctAnswer: -1,
  answer: '',
  solution: '',
  ...overrides,
});
const setup = () => renderHook(() => useQuizController({ subjectConfig, title: 'Percentages', slug: 'percentages' }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.params = new URLSearchParams();
  mocks.authLoading = false;
  mocks.isFetchingMore = false;
  mocks.questions = [question(1), question(2)]; mocks.hasMore = false; mocks.recentQuizzes = [];
  mocks.submitQuizAnswer.mockResolvedValue({});
  mocks.prefetchQuestionReveals.mockResolvedValue({});
  mocks.ensureQuestion.mockResolvedValue(undefined);
});

describe('quiz controller public behavior', () => {
  it('waits for auth restoration before starting or accepting a local resume', () => {
    mocks.authLoading = true;
    const { result, rerender } = setup();
    act(() => { result.current.handleStart(); result.current.handleResume(); result.current.handleRestartFromPopup(); });
    expect(result.current.started).toBe(false);
    expect(mocks.start).not.toHaveBeenCalled();
    mocks.authLoading = false; rerender();
    act(() => result.current.handleStart());
    expect(result.current.started).toBe(true);
  });
  it('requires an answer, clears an unsubmitted selection, records elapsed time, and locks submissions', async () => {
    const { result } = setup();
    act(() => result.current.handleStart());
    act(() => result.current.handleSubmitCurrent());
    expect(result.current.submitError).toContain('choose an option');
    act(() => result.current.handleSelectAnswer(1));
    act(() => result.current.handleClearResponse());
    expect(result.current.selectedAnswer).toBeNull();
    act(() => result.current.handleSelectAnswer(1));
    act(() => result.current.handleSubmitCurrent());
    expect(result.current.results[0]).toMatchObject({ questionId: 1, selected: 1, isCorrect: true, timeTaken: 15 });
    act(() => { result.current.handleClearResponse(); result.current.handleSelectAnswer(0); result.current.handleSubmitCurrent(); });
    expect(result.current.selectedAnswer).toBe(1);
    await act(async () => {});
    expect(mocks.progress).not.toHaveBeenCalled();
    expect(mocks.submitQuizAnswer).toHaveBeenCalledTimes(1);
    expect(mocks.submitQuizAnswer.mock.calls[0][0]).toMatchObject({ questionId: 1, answer: 1, timeTaken: 15,
      resume: { selectedAnswers: { 0: 1 }, submittedQuestions: [0] } });
  });

  it('reveals the server answer key without flashing option A when session questions omit correctAnswer', async () => {
    mocks.questions = [unrevealedQuestion(1), unrevealedQuestion(2)];
    let resolveAnswer!: (value: unknown) => void;
    mocks.submitQuizAnswer.mockReturnValueOnce(new Promise(resolve => { resolveAnswer = resolve; }));

    const { result } = setup();
    act(() => result.current.handleStart());
    act(() => result.current.handleSelectAnswer(1));
    act(() => result.current.handleSubmitCurrent());

    // While in flight, correctAnswer remains -1 (pending) rather than defaulting to 0.
    expect(result.current.currentQ?.correctAnswer).toBe(-1);
    expect(result.current.questions[0].correctAnswer).toBe(-1);
    expect(result.current.results[0]).toMatchObject({ selected: 1, correct: -1, isCorrect: false });

    await act(async () => {
      resolveAnswer({ data: { correct: 1, isCorrect: true, solution: '1 + 1 = 2' } });
    });

    expect(result.current.currentQ?.correctAnswer).toBe(1);
    expect(result.current.questions[0].correctAnswer).toBe(1);
    expect(result.current.results[0]).toMatchObject({ selected: 1, correct: 1, isCorrect: true });
    expect(result.current.stats).toMatchObject({ correct: 1, wrong: 0, accuracy: 100 });
    expect(result.current.bestStreak).toBe(1);
  });

  it('instantly reveals the cached right option in 0ms on Submit without waiting for submitQuizAnswer', async () => {
    mocks.questions = [unrevealedQuestion(1), unrevealedQuestion(2), unrevealedQuestion(3)];
    mocks.prefetchQuestionReveals.mockResolvedValueOnce({
      data: {
        reveals: {
          '1': { correct: 1, solution: 'Prefetched solution 1' },
          '2': { correct: 0, solution: 'Prefetched solution 2' },
          '3': { correct: 1, solution: 'Prefetched solution 3' },
        },
      },
    });
    // Keep submitQuizAnswer pending to prove Submit reveals immediately from the LRU cache.
    mocks.submitQuizAnswer.mockReturnValue(new Promise(() => {}));

    const { result } = setup();
    await act(async () => {});
    act(() => result.current.handleStart());

    // Before submit, unsubmitted question still hides correctAnswer (-1).
    expect(result.current.currentQ?.correctAnswer).toBe(-1);

    act(() => result.current.handleSelectAnswer(0));
    const t0 = performance.now();
    act(() => result.current.handleSubmitCurrent());
    const submitLatencyMs = performance.now() - t0;

    // Immediately on the same synchronous Submit turn (0ms network wait), right/wrong is revealed.
    expect(submitLatencyMs).toBeLessThan(20);
    expect(result.current.currentQ?.correctAnswer).toBe(1);
    expect(result.current.currentQ?.solution).toBe('Prefetched solution 1');
    expect(result.current.questions[0].correctAnswer).toBe(1);
    expect(result.current.results[0]).toMatchObject({ selected: 0, correct: 1, isCorrect: false });
    expect(result.current.stats).toMatchObject({ correct: 0, wrong: 1, accuracy: 0 });
  });

  it('handles rapid navigation, out-of-order reveals, and instant cached back-navigation under 50ms', async () => {
    mocks.questions = [unrevealedQuestion(1), unrevealedQuestion(2), unrevealedQuestion(3)];
    let resolveQ1!: (value: unknown) => void;
    let resolveQ2!: (value: unknown) => void;
    mocks.submitQuizAnswer
      .mockReturnValueOnce(new Promise(resolve => { resolveQ1 = resolve; }))
      .mockReturnValueOnce(new Promise(resolve => { resolveQ2 = resolve; }));

    const { result } = setup();
    act(() => result.current.handleStart());

    // Submit Q1 (index 0) and immediately navigate to Q2 (index 1) while Q1 is still in flight.
    act(() => result.current.handleSelectAnswer(1));
    act(() => result.current.handleSubmitCurrent());
    act(() => result.current.handleNext());
    expect(result.current.currentIndex).toBe(1);

    // Submit Q2 (index 1) and navigate to Q3 (index 2).
    act(() => result.current.handleSelectAnswer(0));
    act(() => result.current.handleSubmitCurrent());
    act(() => result.current.handleNext());
    expect(result.current.currentIndex).toBe(2);

    // Resolve Q1 and Q2 while user is viewing Q3.
    await act(async () => {
      resolveQ1({ data: { correct: 1, isCorrect: true, solution: 'Sol 1' } });
      resolveQ2({ data: { correct: 1, isCorrect: false, solution: 'Sol 2' } });
    });

    expect(result.current.currentIndex).toBe(2);
    expect(result.current.stats).toMatchObject({ correct: 1, wrong: 1, accuracy: 50 });
    expect(result.current.bestStreak).toBe(1);

    // Navigate back to Q2 and Q1: cached results and solutions are available immediately in < 50ms.
    const t0 = performance.now();
    act(() => result.current.handlePrev());
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentQ?.correctAnswer).toBe(1);
    expect(result.current.currentQ?.solution).toBe('Sol 2');

    act(() => result.current.handlePrev());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentQ?.correctAnswer).toBe(1);
    expect(result.current.currentQ?.solution).toBe('Sol 1');
    expect(performance.now() - t0).toBeLessThan(50);
  });

  it('prefetches the next 2 placeholder questions in the background without blocking current navigation', () => {
    mocks.questions = [
      unrevealedQuestion(1),
      unrevealedQuestion(2, { sessionPlaceholder: true }),
      unrevealedQuestion(3, { sessionPlaceholder: true }),
    ];
    const { result } = setup();
    act(() => result.current.handleStart());
    expect(mocks.ensureQuestion).toHaveBeenCalledWith(1);
    expect(mocks.ensureQuestion).toHaveBeenCalledWith(2);
  });

  it('sends one answer command for repeated submit calls before rerender', async () => {
    const { result } = setup();
    act(() => result.current.handleSelectAnswer(1));
    act(() => { result.current.handleSubmitCurrent(); result.current.handleSubmitCurrent(); });
    await act(async () => {});
    expect(mocks.progress).not.toHaveBeenCalled();
    expect(mocks.submitQuizAnswer).toHaveBeenCalledTimes(1);
    expect(result.current.results).toHaveLength(1);
    expect(result.current.bestStreak).toBe(1);
  });

  it('restores selections while navigating and resets results on restart', () => {
    const { result } = setup();
    act(() => result.current.handleStart());
    act(() => result.current.handleSelectAnswer(1));
    act(() => result.current.handleNext());
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.selectedAnswer).toBeNull();
    act(() => result.current.handlePrev());
    expect(result.current.selectedAnswer).toBe(1);
    act(() => result.current.handleSubmitCurrent());
    act(() => result.current.handleRestart());
    expect(result.current).toMatchObject({ started: false, currentIndex: 0, selectedAnswer: null, results: [], bestStreak: 0 });
  });

  it('loads more at a page boundary and only completes at the final boundary', () => {
    mocks.hasMore = true;
    const { result, rerender } = setup();
    act(() => result.current.goToQuestion(2));
    act(() => result.current.handleNext());
    expect(mocks.fetchMore).toHaveBeenCalled();
    expect(result.current.showAnalytics).toBe(false);
    mocks.hasMore = false; rerender();
    act(() => result.current.handleNext());
    expect(result.current.showAnalytics).toBe(true);
  });

  it('offers and restores the existing local resume format including revealed results', () => {
    localStorage.setItem(
      'math_quiz_resume_percentages_concept',
      JSON.stringify({
        selectedAnswers: { 0: 1 },
        submittedQuestions: [0],
        results: [{ questionId: 1, questionIndex: 0, selected: 1, correct: 1, isCorrect: true, timeTaken: 10, concept: 'percentages', difficulty: 'medium' }],
        currentIndex: 1,
      }),
    );
    mocks.questions = [unrevealedQuestion(1), unrevealedQuestion(2)];
    const { result } = setup();
    act(() => result.current.handleStart());
    expect(result.current.resumeData).not.toBeNull();
    expect(result.current.started).toBe(false);
    act(() => result.current.handleResume());
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.submittedQuestions.has(0)).toBe(true);
    expect(result.current.questions[0].correctAnswer).toBe(1);
    expect(result.current.started).toBe(true);
  });

  it('waits for the saved server page before applying resume', () => {
    mocks.params.set('resume', '1'); mocks.hasMore = true;
    mocks.recentQuizzes = [{ quizKey: 'math:percentages', currentIndex: 2, selectedAnswers: { 2: 1 }, submittedQuestions: [2], results: [], status: 'in-progress' }];
    const { result, rerender } = setup();
    expect(result.current.started).toBe(false);
    mocks.questions = [...mocks.questions, question(3)]; rerender();
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.selectedAnswer).toBe(1);
    expect(result.current.started).toBe(true);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('records recent topic only after a question answer is actually submitted', () => {
    localStorage.clear();
    const { result } = setup();
    expect(localStorage.getItem('recent-study:v1')).toBeNull();
    act(() => result.current.handleStart());
    expect(localStorage.getItem('recent-study:v1')).toBeNull();
    act(() => result.current.handleSubmitCurrent());
    expect(localStorage.getItem('recent-study:v1')).toBeNull();
    act(() => result.current.handleSelectAnswer(1));
    expect(localStorage.getItem('recent-study:v1')).toBeNull();
    act(() => result.current.handleSubmitCurrent());
    expect(JSON.parse(localStorage.getItem('recent-study:v1') ?? '{}')).toMatchObject({
      topics: { math: 'percentages' },
    });
  });

  it('finds a deep linked question after another page arrives', () => {
    mocks.params.set('qid', '3'); mocks.hasMore = true;
    const { result, rerender } = setup();
    expect(result.current.started).toBe(false);
    mocks.questions = [...mocks.questions, question(3)]; rerender();
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.started).toBe(true);
  });
});
