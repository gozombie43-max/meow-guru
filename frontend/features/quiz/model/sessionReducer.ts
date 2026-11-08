import type { Difficulty, QuizQuestion, SessionResult } from '@/features/quiz/model/types';
import type { QuizAnswerResponse } from './resumeDelta';
import { nextDifficulty, recordAnswer } from './answerLifecycle';

export type QuizPhase = 'idle' | 'running' | 'answered' | 'solution' | 'completed';
/** Prefix of the transient "answer still syncing" message; cleared once the server reveals. */
export const ANSWER_RETRY_PREFIX = 'Checking your answer';

export interface QuizSessionState {
  phase: QuizPhase;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  submittedQuestions: Set<number>;
  revealedByIndex: Record<number, QuizAnswerResponse>;
  sessionGeneration: number;
  difficulty: Difficulty;
  streak: number;
  bestStreak: number;
  results: SessionResult[];
  submitError: string;
  restored: boolean;
}
export type RestoreSession = Partial<Pick<QuizSessionState, 'currentIndex' | 'selectedAnswers' | 'results' | 'difficulty'>> & { submittedQuestions?: number[] };
export type QuizEvent =
  | { type: 'START' | 'CLEAR' | 'FINISH' | 'RESTART' }
  | { type: 'SELECT'; answer: number; optionCount: number }
  | { type: 'SUBMIT'; question: QuizQuestion; timeTaken: number }
  | { type: 'REVEAL'; index: number; questionId?: string | number; generation?: number; revealed: QuizAnswerResponse }
  | { type: 'NAVIGATE'; index: number; count: number }
  | { type: 'SOLUTION'; open: boolean }
  | { type: 'ERROR'; message: string; index?: number; generation?: number }
  | { type: 'RESTORE'; snapshot: RestoreSession };

export function initialQuizSession(): QuizSessionState {
  return {
    phase: 'idle',
    currentIndex: 0,
    selectedAnswers: {},
    submittedQuestions: new Set(),
    revealedByIndex: {},
    sessionGeneration: 0,
    difficulty: 'medium',
    streak: 0,
    bestStreak: 0,
    results: [],
    submitError: '',
    restored: false,
  };
}
export function quizSessionReducer(state: QuizSessionState, event: QuizEvent): QuizSessionState {
  switch (event.type) {
    case 'START': return { ...state, phase: state.submittedQuestions.has(state.currentIndex) ? 'answered' : 'running' };
    case 'RESTART': return {
      ...initialQuizSession(),
      difficulty: state.difficulty,
      sessionGeneration: state.sessionGeneration + 1,
      restored: true,
    };
    case 'RESTORE': {
      if (state.restored) return state;
      const { currentIndex = 0, selectedAnswers = {}, submittedQuestions = [], results = [], difficulty = state.difficulty } = event.snapshot;
      const submitted = new Set(submittedQuestions);
      // Server-graded rows carry the answer key, so resumed questions show the
      // correct option immediately instead of waiting for a new reveal.
      const revealedByIndex: Record<number, QuizAnswerResponse> = {};
      for (const row of results) {
        if (row && Number.isInteger(row.correct) && row.correct >= 0) {
          revealedByIndex[row.questionIndex] = { correct: row.correct, isCorrect: row.isCorrect };
        }
      }
      return {
        ...initialQuizSession(),
        currentIndex: Math.max(0, currentIndex),
        selectedAnswers: { ...selectedAnswers },
        submittedQuestions: submitted,
        revealedByIndex,
        sessionGeneration: state.sessionGeneration + 1,
        results: [...results],
        difficulty,
        phase: submitted.has(currentIndex) ? 'answered' : 'running',
        restored: true,
      };
    }
    case 'SELECT':
      if (state.phase === 'completed' || state.submittedQuestions.has(state.currentIndex) || !Number.isInteger(event.answer) || event.answer < 0 || event.answer >= event.optionCount) return state;
      return { ...state, selectedAnswers: { ...state.selectedAnswers, [state.currentIndex]: event.answer }, submitError: '' };
    case 'CLEAR': {
      if (state.submittedQuestions.has(state.currentIndex)) return state;
      const selectedAnswers = { ...state.selectedAnswers }; delete selectedAnswers[state.currentIndex];
      return { ...state, selectedAnswers, submitError: '' };
    }
    case 'SUBMIT': {
      if (state.phase === 'completed' || state.submittedQuestions.has(state.currentIndex)) return state;
      const selected = state.selectedAnswers[state.currentIndex];
      if (selected === undefined) return { ...state, submitError: 'Please choose an option before submitting.' };
      const submittedQuestions = new Set([...state.submittedQuestions, state.currentIndex]);
      const results = recordAnswer(state.results, event.question, state.currentIndex, selected, event.timeTaken);
      // Without a known answer key, grade later when the server reveals it.
      if (event.question.correctAnswer < 0) return { ...state, phase: 'answered', submittedQuestions, results, submitError: '' };
      const correct = selected === event.question.correctAnswer;
      const streak = correct ? state.streak + 1 : 0;
      const revealedByIndex = {
        ...state.revealedByIndex,
        [state.currentIndex]: {
          ...state.revealedByIndex[state.currentIndex],
          correct: event.question.correctAnswer,
          isCorrect: correct,
          solution: event.question.solution,
          translations: event.question.translations,
        },
      };
      return { ...state, phase: 'answered', submittedQuestions, revealedByIndex, results, difficulty: nextDifficulty(state.results, state.difficulty, correct), streak, bestStreak: Math.max(state.bestStreak, streak), submitError: '' };
    }
    case 'REVEAL': {
      if (event.generation !== undefined && event.generation !== state.sessionGeneration) return state;
      const row = state.results.find(entry => entry.questionIndex === event.index);
      // Ignore late responses that belong to a restarted or different question.
      if (!row || (event.questionId !== undefined && row.questionId !== event.questionId)) return state;
      const mergedReveal: QuizAnswerResponse = { ...state.revealedByIndex[event.index], ...event.revealed };
      const revealedByIndex = { ...state.revealedByIndex, [event.index]: mergedReveal };
      const submitError = state.submitError.startsWith(ANSWER_RETRY_PREFIX) ? '' : state.submitError;
      const correctIndex = mergedReveal.correct;
      if (typeof correctIndex !== 'number' || correctIndex < 0) return { ...state, revealedByIndex, submitError };
      const wasPending = !(row.correct >= 0);
      const isCorrect = row.selected === correctIndex;
      const others = state.results.filter(entry => entry !== row);
      const results = state.results.map(entry => entry === row ? { ...entry, correct: correctIndex, isCorrect } : entry);
      if (!wasPending) return { ...state, revealedByIndex, results, submitError };
      const streak = isCorrect ? state.streak + 1 : 0;
      return { ...state, revealedByIndex, results, submitError, difficulty: nextDifficulty(others, state.difficulty, isCorrect), streak, bestStreak: Math.max(state.bestStreak, streak) };
    }
    case 'NAVIGATE': {
      if (event.count <= 0) return state;
      const currentIndex = Math.max(0, Math.min(event.index, event.count - 1));
      if (currentIndex === state.currentIndex && state.submitError === '') return state;
      return { ...state, currentIndex, submitError: '', phase: state.phase === 'idle' ? 'idle' : state.submittedQuestions.has(currentIndex) ? 'answered' : 'running' };
    }
    case 'SOLUTION': return state.phase === 'idle' || state.phase === 'completed' ? state : { ...state, phase: event.open ? 'solution' : state.submittedQuestions.has(state.currentIndex) ? 'answered' : 'running' };
    case 'FINISH': return { ...state, phase: 'completed' };
    case 'ERROR': {
      if (event.generation !== undefined && event.generation !== state.sessionGeneration) return state;
      if (event.index !== undefined && event.index !== state.currentIndex) return state;
      return { ...state, submitError: event.message };
    }
  }
}
