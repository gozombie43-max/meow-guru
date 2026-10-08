import { renderHook } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useQuizSync } from './useQuizSync';
import type { QuizQuestion } from '../model/types';
import { createResumeSaver } from '../model/resumeDelta';

const save = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/userApi', () => ({ saveRecentQuiz: save }));
vi.mock('@/lib/axios', () => ({ getAccessToken: () => 'token', AUTH_TOKEN_CHANGED_EVENT: 'auth-token-changed' }));
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
  const props = { ...options, saver: createResumeSaver('token', 'test') };
  const hook = renderHook(props => useQuizSync(props), { initialProps: props });
  hook.rerender({ ...props, selectedAnswers: { 0: 2 } });
  hook.unmount();
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenLastCalledWith('token', expect.objectContaining({ selectedAnswers: { 0: 2 }, status: 'in-progress' }), expect.any(AbortSignal));
  expect(JSON.parse(localStorage.getItem('sync-test')!)).toMatchObject({ selectedAnswers: { 0: 2 } });
});

it('keeps completion as the final checkpoint when unmounting', async () => {
  const props = { ...options, saver: createResumeSaver('token', 'test') };
  const hook = renderHook(props => useQuizSync(props), { initialProps: props });
  hook.rerender({ ...props, showAnalytics: true });
  hook.unmount();
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalled();
  expect(save.mock.calls.every(([, snapshot]) => snapshot.status === 'completed')).toBe(true);
});
