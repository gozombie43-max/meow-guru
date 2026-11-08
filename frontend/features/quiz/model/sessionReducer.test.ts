import { expect, it } from 'vitest';
import { initialQuizSession, quizSessionReducer as reduce } from './sessionReducer';
import type { QuizQuestion } from '@/features/quiz/model/types';

const question = { id: 1, options: ['A', 'B'], correctAnswer: 1, concept: 'math', difficulty: 'medium' } as QuizQuestion;
it('atomically restores a session once, preserving submitted answers', () => {
  const restored = reduce(initialQuizSession(), { type: 'RESTORE', snapshot: { currentIndex: 2, selectedAnswers: { 2: 1 }, submittedQuestions: [2], difficulty: 'hard' } });
  expect(restored.phase).toBe('answered');
  expect(restored.selectedAnswers[2]).toBe(1);
  expect(reduce(restored, { type: 'RESTORE', snapshot: {} })).toBe(restored);
  expect(reduce(restored, { type: 'SELECT', answer: 0, optionCount: 2 })).toBe(restored);
  expect(reduce(restored, { type: 'CLEAR' })).toBe(restored);
  expect(reduce(restored, { type: 'SUBMIT', question, timeTaken: 10 })).toBe(restored);
  expect(reduce(restored, { type: 'START' }).phase).toBe('answered');
  expect(reduce(initialQuizSession(), { type: 'RESTORE', snapshot: {} }).phase).toBe('running');
});
it('handles selection, scoring, solution, navigation and completion without conflicting phases', () => {
  let state = initialQuizSession();
  expect(reduce(state, { type: 'SOLUTION', open: true })).toBe(state);
  expect(reduce(state, { type: 'NAVIGATE', index: 0, count: 0 })).toBe(state);
  expect(reduce(state, { type: 'NAVIGATE', index: 0, count: 2 }).phase).toBe('idle');
  state = reduce(state, { type: 'START' });
  for (const answer of [-1, 2, 0.5]) expect(reduce(state, { type: 'SELECT', answer, optionCount: 2 })).toBe(state);
  state = reduce(state, { type: 'SUBMIT', question, timeTaken: 10 });
  expect(state.submitError).toContain('choose');
  state = reduce(state, { type: 'SELECT', answer: 0, optionCount: 2 });
  state = reduce(state, { type: 'CLEAR' });
  expect(state.selectedAnswers).toEqual({});
  state = reduce(state, { type: 'SELECT', answer: 1, optionCount: 2 });
  state = reduce(state, { type: 'SUBMIT', question, timeTaken: 10 });
  expect(state.results[0].isCorrect).toBe(true); expect(state.bestStreak).toBe(1);
  state = reduce(state, { type: 'SOLUTION', open: true }); expect(state.phase).toBe('solution');
  state = reduce(state, { type: 'SOLUTION', open: false }); expect(state.phase).toBe('answered');
  state = reduce(state, { type: 'NAVIGATE', index: 10, count: 2 }); expect(state.currentIndex).toBe(1);
  state = reduce(state, { type: 'SOLUTION', open: false }); expect(state.phase).toBe('running');
  state = reduce(state, { type: 'SELECT', answer: 0, optionCount: 2 });
  state = reduce(state, { type: 'SUBMIT', question: { ...question, id: 2 }, timeTaken: 20 });
  expect(state.streak).toBe(0); expect(state.bestStreak).toBe(1);
  state = reduce(state, { type: 'NAVIGATE', index: 0, count: 2 }); expect(state.phase).toBe('answered');
  state = reduce(state, { type: 'ERROR', message: 'Loading' }); expect(state.submitError).toBe('Loading');
  state = reduce(state, { type: 'FINISH' }); expect(state.phase).toBe('completed');
  expect(reduce(state, { type: 'SELECT', answer: 1, optionCount: 2 })).toBe(state);
  expect(reduce(state, { type: 'SUBMIT', question, timeTaken: 10 })).toBe(state);
  expect(reduce(state, { type: 'SOLUTION', open: true })).toBe(state);
  state = reduce(state, { type: 'RESTART' });
  expect(state.phase).toBe('idle'); expect(state.results).toEqual([]); expect(state.restored).toBe(true);
});
it('defers grading until the server reveals the answer key and restores revealed keys on resume', () => {
  const unrevealed = { ...question, correctAnswer: -1 };
  let state = reduce(initialQuizSession(), { type: 'START' });
  state = reduce(state, { type: 'SELECT', answer: 1, optionCount: 2 });
  state = reduce(state, { type: 'SUBMIT', question: unrevealed, timeTaken: 12 });
  expect(state.phase).toBe('answered');
  expect(state.results[0]).toMatchObject({ selected: 1, correct: -1, isCorrect: false });
  expect(state.streak).toBe(0);
  expect(state.bestStreak).toBe(0);

  state = reduce(state, { type: 'ERROR', message: 'Checking your answer… it will retry automatically when the connection recovers.' });
  expect(reduce(state, { type: 'REVEAL', index: 0, questionId: 999, revealed: { correct: 1, isCorrect: true } })).toBe(state);

  state = reduce(state, { type: 'REVEAL', index: 0, questionId: 1, revealed: { correct: 1, isCorrect: true, solution: 'Because 1+1=2' } });
  expect(state.results[0]).toMatchObject({ selected: 1, correct: 1, isCorrect: true });
  expect(state.streak).toBe(1);
  expect(state.bestStreak).toBe(1);
  expect(state.submitError).toBe('');

  // Re-revealing an already graded question updates metadata without double-counting streak,
  // and invalid/stale generation or index guards are ignored.
  state = reduce(state, { type: 'REVEAL', index: 0, questionId: 1, generation: state.sessionGeneration, revealed: { correct: 1, isCorrect: true, solution: 'Updated explanation' } });
  expect(state.streak).toBe(1);
  expect(state.revealedByIndex[0]?.solution).toBe('Updated explanation');
  state = reduce(state, { type: 'REVEAL', index: 0, questionId: 1, revealed: { correct: -1, isCorrect: false } });
  expect(state.results[0].correct).toBe(1);
  expect(reduce(state, { type: 'REVEAL', index: 0, generation: 99, revealed: { correct: 0, isCorrect: false } })).toBe(state);
  expect(reduce(state, { type: 'ERROR', message: 'Stale gen', generation: 99 })).toBe(state);
  expect(reduce(state, { type: 'ERROR', message: 'Other index', index: 5 })).toBe(state);
  state = reduce(state, { type: 'ERROR', message: 'Current error', index: 0, generation: state.sessionGeneration });
  expect(state.submitError).toBe('Current error');

  const resumed = reduce(initialQuizSession(), {
    type: 'RESTORE',
    snapshot: {
      currentIndex: 0,
      selectedAnswers: { 0: 1 },
      submittedQuestions: [0],
      results: [{ questionId: 1, questionIndex: 0, selected: 1, correct: 1, isCorrect: true, timeTaken: 12, concept: 'math', difficulty: 'medium' }],
    },
  });
  expect(resumed.revealedByIndex[0]).toEqual({ correct: 1, isCorrect: true });
});
