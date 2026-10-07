import { expect, it } from 'vitest';
import { canonicalQuestionQuery, questionQueryIdentity } from './questionQueryIdentity.js';
it('collapses reordered/default/ignored parameters and equivalent boolean limits', () => {
  const a = { subject: ' Mathematics ', includeTotal: 'true', limit: '50', tracking: 'one' };
  const b = { limit: 50, includeTotal: true, subject: 'mathematics', tracking: 'two' };
  expect(questionQueryIdentity('cursor', a)).toBe(questionQueryIdentity('cursor', b));
  expect(questionQueryIdentity('cursor', a)).not.toContain('tracking');
});
it('preserves exact legacy topics and exact normalized exam/concept filters', () => {
  expect(canonicalQuestionQuery('session', { topic: 'Algebra', exam: 'SSC CGL', concept: 'X' }, false).topic).toBe('Algebra');
  expect(canonicalQuestionQuery('session', { topic: ' Algebra ', exam: 'SSC CGL', concept: 'X' }, true)).toMatchObject({ topic: 'algebra', exam: 'SSC CGL', concept: 'X' });
  expect(canonicalQuestionQuery('session', { exam: 'B,A,B', letter: 'b,a', mode: 'ai-challenge' })).toMatchObject({ exam: 'A,B', letter: 'A,B', mode: 'aiChallenge' });
  expect(questionQueryIdentity('session', { letter: 'b,A,a' })).toBe(questionQueryIdentity('session', { letter: 'A,B' }));
});
it.each([{ topic: ['algebra'] }, { cursor: 'x'.repeat(2049) }, { subject: { $ne: '' } }, { mode: 'unknown' }])('rejects malformed query %j before cache/database access', input => {
  expect(() => canonicalQuestionQuery('session', input)).toThrow();
});

it('retains subject-dependent facets and removes resume parameters ignored by a cursor', () => {
  expect(canonicalQuestionQuery('cursor', { topic: 'algebra', subject: 'Mathematics', includeFacets: true })).toMatchObject({ topic: 'algebra', subject: 'mathematics', includeFacets: 'true' });
  expect(canonicalQuestionQuery('session', { cursor: 'ABCDEF0123456789ABCDEF01', resumeIndex: 30, windowOffset: 20, anchor: 'abcdef0123456789abcdef01' })).toEqual({ cursor: 'abcdef0123456789abcdef01', limit: 50 });
});
it.each([{ cursor: 'invalid' }, { anchor: 'invalid' }, { windowOffset: 10001 }, { resumeIndex: -1 }])('rejects invalid pagination before allocating cache keys %j', input => {
  expect(() => canonicalQuestionQuery('session', input)).toThrow();
});
