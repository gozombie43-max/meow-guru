// services/__tests__/mockTestEngine.test.js
import { describe, it, expect } from 'vitest';
import { gradeAttempt } from '../mockTestEngine.js';

/**
 * gradeAttempt() expects an attemptDoc with:
 *   - configKey  → looked up via getExamConfig() in exam-config.js
 *   - paper.sections[]  → each section's key must match a section key in the config
 *   - answers   → { [questionId]: userAnswer }
 *   - answerKey → { [questionId]: correctAnswer }
 *
 * SSC CGL Tier-1 config has these section keys:
 *   ga, reasoning, quant, english  (all with marking: { correct: 2, incorrect: 0.5 })
 */

// Helper: build a minimal attemptDoc using the real 'quant' section key
function makeAttempt({ questions, answers, answerKey, configKey = 'ssc-cgl-tier1' }) {
  return {
    configKey,
    paper: {
      sections: [
        {
          key: 'quant',  // must match the actual section key in exam-config.js
          questions: questions.map((id) => ({ id })),
        },
      ],
    },
    answers,
    answerKey,
  };
}

describe('gradeAttempt', () => {
  it('scores all-correct answers', () => {
    const attempt = makeAttempt({
      questions: ['q1', 'q2', 'q3'],
      answers:   { q1: 'A', q2: 'B', q3: 'C' },
      answerKey: { q1: 'A', q2: 'B', q3: 'C' },
    });

    const result = gradeAttempt({ attemptDoc: attempt });
    const section = result.sections[0];

    expect(section.correct).toBe(3);
    expect(section.incorrect).toBe(0);
    expect(section.skipped).toBe(0);
    // Each correct = +2 marks (SSC CGL Tier-1 marking)
    expect(section.score).toBe(6);
    expect(section.accuracy).toBe(100);
  });

  it('applies negative marking for all-wrong answers', () => {
    const attempt = makeAttempt({
      questions: ['q1', 'q2', 'q3', 'q4'],
      answers:   { q1: 'B', q2: 'C', q3: 'D', q4: 'A' },
      answerKey: { q1: 'A', q2: 'A', q3: 'A', q4: 'B' },
    });

    const result = gradeAttempt({ attemptDoc: attempt });
    const section = result.sections[0];

    expect(section.correct).toBe(0);
    expect(section.incorrect).toBe(4);
    // Each wrong = -0.5 marks → -2.0 total (raw score can be negative)
    expect(section.score).toBe(-2);
  });

  it('scores all-skipped as zero', () => {
    const attempt = makeAttempt({
      questions: ['q1', 'q2', 'q3'],
      answers:   {},             // nothing answered
      answerKey: { q1: 'A', q2: 'B', q3: 'C' },
    });

    const result = gradeAttempt({ attemptDoc: attempt });
    const section = result.sections[0];

    expect(section.correct).toBe(0);
    expect(section.incorrect).toBe(0);
    expect(section.skipped).toBe(3);
    expect(section.score).toBe(0);
  });

  it('handles empty-string answers as skipped', () => {
    const attempt = makeAttempt({
      questions: ['q1', 'q2'],
      answers:   { q1: '', q2: '' },
      answerKey: { q1: 'A', q2: 'B' },
    });

    const result = gradeAttempt({ attemptDoc: attempt });
    const section = result.sections[0];

    expect(section.skipped).toBe(2);
    expect(section.score).toBe(0);
  });

  it('calculates mixed correct/wrong/skipped correctly', () => {
    const attempt = makeAttempt({
      questions: ['q1', 'q2', 'q3', 'q4', 'q5'],
      answers:   { q1: 'A', q2: 'C', q3: 'B' },  // q4 and q5 unanswered
      answerKey: { q1: 'A', q2: 'B', q3: 'B', q4: 'D', q5: 'A' },
    });

    const result = gradeAttempt({ attemptDoc: attempt });
    const section = result.sections[0];

    expect(section.correct).toBe(2);     // q1, q3
    expect(section.incorrect).toBe(1);   // q2
    expect(section.skipped).toBe(2);     // q4, q5
    // 2*2 - 1*0.5 = 3.5
    expect(section.score).toBe(3.5);
    // accuracy = correct / (correct + incorrect) = 2/3 ≈ 66.67%
    expect(section.accuracy).toBeCloseTo(66.67, 1);
  });

  it('calculates totalScore and percentage across sections', () => {
    const attempt = makeAttempt({
      questions: ['q1', 'q2'],
      answers:   { q1: 'A' },
      answerKey: { q1: 'A', q2: 'B' },
    });

    const result = gradeAttempt({ attemptDoc: attempt });

    // 1 correct (2 marks), 0 wrong, 1 skipped → total 2, max 4
    expect(result.totalScore).toBe(2);
    expect(result.maxScore).toBe(4);
    expect(result.percentage).toBe(50);
  });

  it('handles numeric answer comparison via string coercion', () => {
    const attempt = makeAttempt({
      questions: ['q1'],
      answers:   { q1: 2 },      // numeric
      answerKey: { q1: '2' },    // string in answer key
    });

    const result = gradeAttempt({ attemptDoc: attempt });
    // String(2) === String('2') should match
    expect(result.sections[0].correct).toBe(1);
  });
});
