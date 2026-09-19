import type { Difficulty, QuizQuestion, SessionResult } from '@/features/quiz/model/types';
import { nextDifficulty, recordAnswer } from './answerLifecycle';

export type QuizPhase = 'idle' | 'running' | 'answered' | 'solution' | 'completed';
export interface QuizSessionState {
  phase: QuizPhase;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  submittedQuestions: Set<number>;
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
  | { type: 'NAVIGATE'; index: number; count: number }
  | { type: 'SOLUTION'; open: boolean }
  | { type: 'ERROR'; message: string }
  | { type: 'RESTORE'; snapshot: RestoreSession };

export function initialQuizSession(): QuizSessionState {
  return { phase: 'idle', currentIndex: 0, selectedAnswers: {}, submittedQuestions: new Set(), difficulty: 'medium', streak: 0, bestStreak: 0, results: [], submitError: '', restored: false };
}
export function quizSessionReducer(state: QuizSessionState, event: QuizEvent): QuizSessionState {
  switch (event.type) {
    case 'START': return { ...state, phase: state.submittedQuestions.has(state.currentIndex) ? 'answered' : 'running' };
    case 'RESTART': return { ...initialQuizSession(), difficulty: state.difficulty, restored: true };
    case 'RESTORE': {
      if (state.restored) return state;
      const { currentIndex = 0, selectedAnswers = {}, submittedQuestions = [], results = [], difficulty = state.difficulty } = event.snapshot;
      const submitted = new Set(submittedQuestions);
      return { ...initialQuizSession(), currentIndex: Math.max(0, currentIndex), selectedAnswers: { ...selectedAnswers }, submittedQuestions: submitted, results: [...results], difficulty, phase: submitted.has(currentIndex) ? 'answered' : 'running', restored: true };
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
      const correct = selected === event.question.correctAnswer;
      const streak = correct ? state.streak + 1 : 0;
      return { ...state, phase: 'answered', submittedQuestions: new Set([...state.submittedQuestions, state.currentIndex]), results: recordAnswer(state.results, event.question, state.currentIndex, selected, event.timeTaken), difficulty: nextDifficulty(state.results, state.difficulty, correct), streak, bestStreak: Math.max(state.bestStreak, streak), submitError: '' };
    }
    case 'NAVIGATE': {
      if (event.count <= 0) return state;
      const currentIndex = Math.max(0, Math.min(event.index, event.count - 1));
      return { ...state, currentIndex, submitError: '', phase: state.phase === 'idle' ? 'idle' : state.submittedQuestions.has(currentIndex) ? 'answered' : 'running' };
    }
    case 'SOLUTION': return state.phase === 'idle' || state.phase === 'completed' ? state : { ...state, phase: event.open ? 'solution' : state.submittedQuestions.has(state.currentIndex) ? 'answered' : 'running' };
    case 'FINISH': return { ...state, phase: 'completed' };
    case 'ERROR': return { ...state, submitError: event.message };
  }
}
