import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizQuestion, SubjectConfig } from '../types';
import { useQuizController } from './useQuizController';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  questions: [] as QuizQuestion[],
  hasMore: false,
  fetchMore: vi.fn(),
  start: vi.fn(), stop: vi.fn(), progress: vi.fn().mockResolvedValue({}),
  refreshUser: vi.fn(), recentQuizzes: [] as Record<string, unknown>[],
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.params }));
vi.mock('@/hooks/useAppNavigation', () => ({ useBackLayer: vi.fn(), useQuizLeaveGuard: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ token: 'token', user: { recentQuizzes: mocks.recentQuizzes }, refreshUser: mocks.refreshUser }) }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('../QuizThemeProvider', () => ({ useQuizTheme: () => 'light', useQuizThemeControls: () => ({ toggleTheme: vi.fn() }) }));
vi.mock('../useQuizPreferences', () => ({ useQuizPreferences: () => ({}) }));
vi.mock('@/hooks/useTranslatedQuestion', () => ({ useTranslatedQuestion: () => ({}) }));
vi.mock('@/lib/userApi', () => ({ updateProgress: mocks.progress }));
vi.mock('./useQuizFilters', () => ({ useQuizFilters: () => ({ questions: mocks.questions, hasMore: mocks.hasMore, fetchMore: mocks.fetchMore, selectedClassificationConcepts: new Set(), setConceptFilter: vi.fn(), setExamFilter: vi.fn(), setSelectedClassificationConcepts: vi.fn() }) }));
vi.mock('./useQuizBookmarks', () => ({ useQuizBookmarks: () => ({}) }));
vi.mock('./useQuizKeyboard', () => ({ useQuizKeyboard: vi.fn() }));
vi.mock('./useQuizSync', () => ({ useQuizSync: vi.fn() }));
vi.mock('./useQuizTimer', () => ({ useQuizTimer: () => ({ timerRef: { current: { getTimeLeft: () => 45 } }, maxTime: 60, startTimer: mocks.start, stopTimer: mocks.stop }) }));

const subjectConfig: SubjectConfig = { subjectId: 'math', subjectLabel: 'Math', cssClassName: 'math', topicConcepts: {}, classificationCategories: [], getClassificationCategoryId: () => '' };
const question = (id: number): QuizQuestion => ({ id, concept: 'percentages', formula: '', question: 'One plus one?', options: ['1', '2'], correctAnswer: 1, answer: '2', difficulty: 'medium', estimatedTime: 60, year: '', exam: '', solution: '2' });
const setup = () => renderHook(() => useQuizController({ subjectConfig, title: 'Percentages', slug: 'percentages' }));

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mocks.params = new URLSearchParams();
  mocks.questions = [question(1), question(2)]; mocks.hasMore = false; mocks.recentQuizzes = [];
});

describe('quiz controller public behavior', () => {
  it('requires an answer, clears an unsubmitted selection, records elapsed time, and locks submissions', () => {
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
    expect(mocks.progress).toHaveBeenCalledTimes(1);
  });

  it('sends progress once for repeated submit calls before rerender', () => {
    const { result } = setup();
    act(() => result.current.handleSelectAnswer(1));
    act(() => { result.current.handleSubmitCurrent(); result.current.handleSubmitCurrent(); });
    expect(mocks.progress).toHaveBeenCalledTimes(1);
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

  it('offers and restores the existing local resume format', () => {
    localStorage.setItem('math_quiz_resume_percentages_concept', JSON.stringify({ selectedAnswers: { 0: 1 }, submittedQuestions: [0], currentIndex: 1 }));
    const { result } = setup();
    act(() => result.current.handleStart());
    expect(result.current.resumeData).not.toBeNull();
    expect(result.current.started).toBe(false);
    act(() => result.current.handleResume());
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.submittedQuestions.has(0)).toBe(true);
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

  it('finds a deep linked question after another page arrives', () => {
    mocks.params.set('qid', '3'); mocks.hasMore = true;
    const { result, rerender } = setup();
    expect(result.current.started).toBe(false);
    mocks.questions = [...mocks.questions, question(3)]; rerender();
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.started).toBe(true);
  });
});
