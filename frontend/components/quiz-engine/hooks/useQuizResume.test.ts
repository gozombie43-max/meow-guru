import { describe, expect, it } from 'vitest';
import { isResumeData } from './useQuizResume';
describe('persisted quiz progress', () => {
  it('accepts optional legacy fields and a valid session beyond the first page', () => {
    expect(isResumeData({ currentIndex: 75, selectedAnswers: { 74: 2 }, submittedQuestions: [74] })).toBe(true);
  });
  it.each([null, [], { currentIndex: -1 }, { currentIndex: '50' }, { selectedAnswers: { 0: '1' } }, { submittedQuestions: ['1'] }, { selectedClassificationConcepts: [1] }, { difficulty: 'invalid' }])('rejects malformed persisted state: %j', value => {
    expect(isResumeData(value)).toBe(false);
  });
});
