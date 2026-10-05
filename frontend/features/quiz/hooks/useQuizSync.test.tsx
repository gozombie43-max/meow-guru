import { renderHook } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useQuizSync } from './useQuizSync';
import type { QuizQuestion } from '../model/types';

const save = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/userApi', () => ({ saveRecentQuiz: save }));
const options = {
  token: 'token', started: true, showAnalytics: false,
  questions: [{ sessionAnchor: 'anchor' } as QuizQuestion],
  quizKey: 'math:algebra', title: 'Algebra', subjectId: 'math', slug: 'algebra', quizHref: '/quiz', mode: 'concept',
  currentIndex: 0, selectedAnswers: { 0: 1 }, submittedQuestions: new Set([0]), results: [],
  resumeRequested: false, resumeAppliedRef: { current: false }, storageKey: 'sync-test',
  conceptFilter: null, examFilter: null, selectedClassificationConcepts: new Set<string>(), difficulty: 'medium' as const,
};
beforeEach(() => { save.mockClear(); localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

it('flushes the latest answer when leaving before the debounce', async () => {
  const hook = renderHook(props => useQuizSync(props), { initialProps: options });
  hook.rerender({ ...options, selectedAnswers: { 0: 2 } });
  hook.unmount();
  await Promise.resolve();
  expect(save).toHaveBeenLastCalledWith('token', expect.objectContaining({ selectedAnswers: { 0: 2 }, status: 'in-progress' }));
  expect(JSON.parse(localStorage.getItem('sync-test')!)).toMatchObject({ selectedAnswers: { 0: 2 } });
});

it('keeps completion as the final checkpoint when unmounting', async () => {
  const hook = renderHook(props => useQuizSync(props), { initialProps: options });
  hook.rerender({ ...options, showAnalytics: true });
  hook.unmount();
  await Promise.resolve();
  await Promise.resolve();
  expect(save).toHaveBeenCalled();
  expect(save.mock.calls.every(([, snapshot]) => snapshot.status === 'completed')).toBe(true);
});
