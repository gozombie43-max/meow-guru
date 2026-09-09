import { describe, expect, it } from 'vitest';
import { mockAnswerIndex } from '../mockAnswer.js';
import { activePaper } from '../mockTestPresentation.js';

describe('mock answer compatibility', () => {
  it.each([1, 'B', '(B)', 'B)', 'four'])('resolves stored key %s', answer => {
    expect(mockAnswerIndex(answer, ['three', 'four', 'five'])).toBe(1);
  });
  it('distinguishes a submitted index from numeric answer text', () => {
    expect(mockAnswerIndex('1', ['1', '4'], true)).toBe(1);
    expect(mockAnswerIndex('1', ['1', '4'])).toBe(0);
  });
  it('supports object option IDs and rejects malformed keys', () => {
    expect(mockAnswerIndex('opt-b', [{ id: 'opt-a', text: '3' }, { id: 'opt-b', text: '4' }], true)).toBe(1);
    for (const answer of [null, {}, [], -1, 99, 'Z']) expect(mockAnswerIndex(answer, ['one', 'two'])).toBeNull();
  });
  it('removes nested option answer flags without mutating persisted review data', () => {
    const paper = { sections: [{ questions: [{ id: 'q', options: [{ id: 'a', text: 'four', isCorrect: true }], solution: 'private' }] }] };
    expect(activePaper(paper).sections[0].questions[0]).toEqual({ id: 'q', options: [{ id: 'a', text: 'four' }] });
    expect(paper.sections[0].questions[0].solution).toBe('private');
  });
});
