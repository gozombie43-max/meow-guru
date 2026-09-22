import { describe, expect, it } from 'vitest';
import {
  applySessionToLearnerState,
  createLearnerState,
} from '../learnerStateReducer.js';

const session = (id, completedAt, choice, confidence = 'sure') => ({
  id,
  userId: 'learner',
  exam: 'ssc-cgl',
  status: 'completed',
  completedAt,
  result: {},
  questions: [{
    id: 'q1', subject: 'mathematics', topic: 'Algebra', correctIndex: 1, expectedTime: 10,
  }],
  answers: { q1: { choice, confidence, seconds: 12 } },
});

describe('learnerStateReducer', () => {
  it('keeps EMA, review stages, and exposure fields in chronological order', () => {
    const state = createLearnerState();
    applySessionToLearnerState(state, session('old-wrong', '2026-01-01T00:00:00.000Z', 0));
    applySessionToLearnerState(state, session('new-correct', '2026-01-02T00:00:00.000Z', 1));

    const skill = state.skills.get('mathematics / Algebra');
    expect(skill.mastery).toBeCloseTo(0.52);
    expect(skill.seconds).toBeCloseTo(42.72);
    expect(skill.attempts).toBe(2);
    const review = state.reviews.get('q1');
    expect(review).toMatchObject({ stage: 1, lastSessionId: 'new-correct' });
    expect(review.dueAt).toBe('2026-01-05T00:00:00.000Z');
    expect(state.exposures.get('q1')).toMatchObject({
      timesSeen: 2,
      timesCorrect: 1,
      lastSeenAt: '2026-01-02T00:00:00.000Z',
      lastCorrect: true,
      lastConfidence: 'sure',
    });
  });
});
