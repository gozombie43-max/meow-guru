import { describe, expect, it } from 'vitest';
import { QuizLruCache, sanitizeUnrevealedQuestion } from './quizLruCache';
import type { QuizQuestion } from './types';

const makeQuestion = (id: number, overrides: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id,
  concept: 'algebra',
  formula: '',
  question: `Question ${id}?`,
  options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
  correctAnswer: -1,
  answer: '',
  difficulty: 'medium',
  estimatedTime: 60,
  year: '2024',
  exam: 'SSC CGL',
  solution: '',
  ...overrides,
});

describe('QuizLruCache', () => {
  it('strips unrevealed answer keys, correctLetter, and translated solutions before caching', () => {
    const raw = makeQuestion(1, {
      correctAnswer: -1,
      answer: 'Opt C',
      solution: 'Leaked solution',
      correctLetter: 'C',
      translations: {
        hi: { question: 'Q1 hi', options: ['A', 'B', 'C', 'D'], solution: 'Leaked hi solution' },
      },
    });
    const sanitized = sanitizeUnrevealedQuestion(raw);
    expect(sanitized.correctAnswer).toBe(-1);
    expect(sanitized.answer).toBe('');
    expect(sanitized.solution).toBe('');
    expect(sanitized.correctLetter).toBeUndefined();
    expect(sanitized.translations?.hi?.solution).toBeUndefined();
    expect(sanitized.translations?.hi?.question).toBe('Q1 hi');
  });

  it('caches authoritative answer reveals and reuses referentially stable merged questions on back navigation', () => {
    const cache = new QuizLruCache(8);
    const q0 = makeQuestion(10);
    const q1 = makeQuestion(11);

    const initial = cache.getQuestion(0, q0);
    expect(initial?.correctAnswer).toBe(-1);

    const revealed = cache.setAnswerResult(0, 10, {
      correct: 2,
      isCorrect: true,
      solution: 'Step-by-step explanation',
      solutionImage: 'https://cdn.example.com/sol10.png',
    }, q0);

    expect(revealed?.correctAnswer).toBe(2);
    expect(revealed?.answer).toBe('Opt C');
    expect(revealed?.solution).toContain('Step-by-step explanation');
    expect(revealed?.solution).toContain('![solution](https://cdn.example.com/sol10.png)');

    // Navigate forward to question 1, then back to question 0.
    cache.getQuestion(1, q1);
    const revisited = cache.getQuestion(0, q0);
    expect(revisited).toBe(revealed);
    expect(revisited?.correctAnswer).toBe(2);
    expect(revisited?.solution).toContain('Step-by-step explanation');
  });

  it('evicts the least-recently-used unpinned entries while protecting the pinned navigation window', () => {
    const cache = new QuizLruCache(5);
    // Pin window around index 1 (pins 0, 1, 2, 3)
    cache.pinWindow(1);
    for (let i = 0; i < 5; i++) {
      cache.setQuestion(i, makeQuestion(i + 1));
    }
    expect(cache.size).toBe(5);

    // Adding index 5 should evict index 4 (the only unpinned entry among 0..4).
    cache.setQuestion(5, makeQuestion(6));
    expect(cache.size).toBe(5);
    expect(cache.hasQuestion(4)).toBe(false);
    expect(cache.hasQuestion(0)).toBe(true);
    expect(cache.hasQuestion(1)).toBe(true);
    expect(cache.hasQuestion(2)).toBe(true);
    expect(cache.hasQuestion(3)).toBe(true);
    expect(cache.hasQuestion(5)).toBe(true);

    // Session cleanup clears all cached state.
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.hasQuestion(1)).toBe(false);
  });

  it('completes cached question navigation well under the 50ms budget', () => {
    const cache = new QuizLruCache(64);
    const questions = Array.from({ length: 64 }, (_, i) => makeQuestion(i + 1));
    for (let i = 0; i < 64; i++) {
      cache.setQuestion(i, questions[i]);
    }
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const idx = i % 64;
      const q = cache.getQuestion(idx, questions[idx]);
      expect(q?.id).toBe(idx + 1);
    }
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(50);
  });
});
