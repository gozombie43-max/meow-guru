import { describe, expect, it, vi } from 'vitest';
import { planQuestionTranslation } from '@/lib/question-translation';
import { mergeQuestionWithReveal } from './quizLruCache';
import { initialQuizSession, quizSessionReducer } from './sessionReducer';
import { createCoalescedSave } from '@/lib/coalesced-save';
import { clearMockStartKey, getMockStartKey } from '@/app/(app)/mock-test/_shared/startKey';
import type { QuizQuestion } from './types';

describe('Mock Test & PYQ Finder Frontend Audit Regressions', () => {
  it('translates solutions on English and coding-decoding questions while keeping literal options intact', () => {
    const plan = planQuestionTranslation(
      {
        question: 'Choose the synonym of "ABANDON".',
        options: ['Forsake', 'Keep', 'Hold', 'Retain'],
        solution: 'Abandon means to leave behind or forsake completely.',
      },
      'english synonyms',
    );
    // Question (0) and solution (last) should both be queued for translation; options (1..4) stay literal
    expect(plan.texts.length).toBe(2);
    const restored = plan.restore(plan.texts.map((text, idx) => (idx === 0 ? `Q_BN: ${text}` : `SOL_BN: ${text}`)));
    expect(restored[0]).toBe('Q_BN: Choose the synonym of "ABANDON".');
    expect(restored.slice(1, 5)).toEqual(['Forsake', 'Keep', 'Hold', 'Retain']);
    expect(restored[5]).toBe('SOL_BN: Abandon means to leave behind or forsake completely.');
  });

  it('deep-merges bilingual translations on reveal instead of clobbering native question and options', () => {
    const baseQuestion: QuizQuestion = {
      id: 'q1',
      concept: 'Arithmetic',
      formula: '',
      question: 'What is 2+2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: -1,
      answer: '',
      difficulty: 'easy',
      estimatedTime: 30,
      year: '2024',
      exam: 'SSC CGL',
      solution: '',
      translations: {
        bn: {
          question: '২+২ কত?',
          options: ['৩', '৪', '৫', '৬'],
        },
      },
    };
    const merged = mergeQuestionWithReveal(baseQuestion, {
      correct: 1,
      solution: 'Four',
      solutionImageWidth: 640,
      solutionImageHeight: 360,
      translations: {
        bn: {
          solution: 'চার',
        },
      },
    });
    expect(merged.correctAnswer).toBe(1);
    expect(merged.translations?.bn?.question).toBe('২+২ কত?');
    expect(merged.translations?.bn?.options).toEqual(['৩', '৪', '৫', '৬']);
    expect(merged.translations?.bn?.solution).toBe('চার');
    expect(merged.solutionImageWidth).toBe(640);
    expect(merged.solutionImageHeight).toBe(360);
  });

  it('exits completed Review Map when clicking the currently active last question', () => {
    let state = initialQuizSession();
    state = quizSessionReducer(state, { type: 'START' });
    state = quizSessionReducer(state, { type: 'NAVIGATE', index: 4, count: 5 });
    state = quizSessionReducer(state, { type: 'FINISH' });
    expect(state.phase).toBe('completed');

    const next = quizSessionReducer(state, { type: 'NAVIGATE', index: 4, count: 5 });
    expect(next.phase).toBe('running');
    expect(next.currentIndex).toBe(4);
  });

  it('recovers cleanly in createCoalescedSave after a transient write failure without dropping subsequent saves', async () => {
    let calls = 0;
    const write = vi.fn(async (val: { v: number }) => {
      calls++;
      if (calls === 1) throw new Error('Transient failure');
      expect(val.v).toBeGreaterThan(0);
    });
    const saver = createCoalescedSave<{ v: number }>(write, (a, b) => a.v === b.v);
    await expect(saver.save({ v: 1 })).rejects.toThrow('Transient failure');
    await expect(saver.save({ v: 2 })).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith({ v: 2 });
  });

  it('falls back to in-memory startKey when sessionStorage throws QuotaExceededError', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const remSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    try {
      const k1 = getMockStartKey('u1', 'ssc-cgl', 'slot-1');
      const k2 = getMockStartKey('u1', 'ssc-cgl', 'slot-1');
      expect(k1).toBeTruthy();
      expect(k1).toBe(k2);
      expect(() => clearMockStartKey('u1', 'ssc-cgl', 'slot-1')).not.toThrow();
      const k3 = getMockStartKey('u1', 'ssc-cgl', 'slot-1');
      expect(k3).not.toBe(k1);
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
      remSpy.mockRestore();
    }
  });
});
