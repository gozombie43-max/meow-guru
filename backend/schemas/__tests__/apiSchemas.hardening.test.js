import { describe, expect, it } from 'vitest';
import { progressPatchSchema, recentQuizPatchSchema } from '../apiSchemas.js';

describe('quiz persistence validation', () => {
  it('rejects invalid counters and unsafe Mongo field names', () => {
    expect(progressPatchSchema.safeParse({ topic: 'math.score', attempted: 2, correct: 1 }).success).toBe(false);
    expect(progressPatchSchema.safeParse({ topic: '$math', attempted: 2, correct: 1 }).success).toBe(false);
    expect(progressPatchSchema.safeParse({ topic: 'math', attempted: 2, correct: 3 }).success).toBe(false);
    expect(progressPatchSchema.safeParse({ topic: 'math', attempted: 2, correct: 1 }).success).toBe(true);
  });

  it('bounds client-owned resume snapshots', () => {
    const oversizedAnswers = Object.fromEntries(
      Array.from({ length: 501 }, (_, index) => [String(index), 'A']),
    );
    const parsed = recentQuizPatchSchema.safeParse({
      quizKey: 'math:test',
      title: 'Math test',
      subject: 'Mathematics',
      href: '/mathematics/test',
      selectedAnswers: oversizedAnswers,
    });
    expect(parsed.success).toBe(false);
  });
});
