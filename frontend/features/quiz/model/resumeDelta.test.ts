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
