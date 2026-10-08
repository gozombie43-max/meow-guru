import { expect, it } from 'vitest';
import { quizSnapshotDelta } from './resumeDelta';
import type { RecentQuizPayload } from '@/lib/userApi';
import type { SessionResult } from './types';

it('sends only changed answers/results, deletions and new submissions across a long session', () => {
  const results = Array.from({ length: 240 }, (_, questionIndex) => ({ questionIndex } as SessionResult));
  const previous: RecentQuizPayload = { quizKey: 'math:algebra', title: 'Algebra', subject: 'mathematics', href: '/quiz',
    selectedAnswers: { 0: 1, 1: 0 }, results, submittedQuestions: results.map(row => row.questionIndex) };
  const next = { ...previous, currentIndex: 241, selectedAnswers: { 1: 0, 240: 2 },
    results: [...results, { questionIndex: 240 } as SessionResult], submittedQuestions: [...previous.submittedQuestions!, 240] };
  const delta = quizSnapshotDelta(previous, next);
  expect(delta).toMatchObject({ delta: true, removedAnswers: [0], selectedAnswers: { 240: 2 }, submittedQuestions: [240] });
  expect(delta.results).toHaveLength(1);
  expect(JSON.stringify(delta).length).toBeLessThan(JSON.stringify(next).length / 5);
});

it('keeps restored sessions above the history request limit writable using a bounded delta', () => {
  const next: RecentQuizPayload = { quizKey: 'math:algebra', title: 'Algebra', subject: 'math', href: '/quiz',
    selectedAnswers: Object.fromEntries(Array.from({ length: 601 }, (_, index) => [index, 1])),
    submittedQuestions: Array.from({ length: 601 }, (_, index) => index),
    results: Array.from({ length: 601 }, (_, questionIndex) => ({ questionIndex })) };
  const delta = quizSnapshotDelta(undefined, next);
  expect(delta.delta).toBe(true); expect(Object.keys(delta.selectedAnswers!)).toHaveLength(500);
  expect(delta.submittedQuestions).toHaveLength(500); expect(delta.results).toHaveLength(500);
  expect(delta.selectedAnswers?.[600]).toBe(1);
});
