import { describe, expect, it } from 'vitest';
import type { TrainingSession } from '../training-types';
import { mergeTrainingResponse, type TrainingDelta } from './sessionDelta';

export const sessionFixture = (): TrainingSession => ({
  id: 's1', mode: 'section', effectiveMode: 'section', exam: 'ssc-cgl', status: 'active', completionReason: null,
  revision: 1, current: 0, duration: 60, deadline: new Date(Date.now() + 60000).toISOString(), serverNow: Date.now(), lastEventAt: Date.now(), lives: 3,
  policy: { id: 'section', navigation: 'free', confidence: true, sectional: true, requiresSubject: true, supportsFullSection: true, supportsTier: true, clock: 'target', clockMultiplier: 1, minuteOptions: [], minDifficulty: 1, lives: null },
  allowedVisitIndices: [0, 1], marking: { correct: 1, wrong: .25 }, result: null, answers: {},
  questions: ['q1','q2'].map(id => ({ id, text: id, options: ['A','B'], image: '', subject: 'mathematics', topic: 'Algebra', subtopic: '', difficulty: 2, expectedTime: 60, targetSource: 'catalog', sourceType: 'bank' })),
});

describe('training delta merge', () => {
  const deltaFor = (s: TrainingSession): TrainingDelta => {
    const { questions: _questions, ...state } = s;
    return { ...state, kind: 'delta', baseRevision: s.revision, revision: s.revision + 1, answers: { q1: { choice: 1, confidence: 'sure', seconds: 5 } } };
  };
  it('keeps question identities and earlier answers during ordinary saves', () => {
    const session = sessionFixture();
    session.answers.q2 = { choice: 0, confidence: 'guess', seconds: 10 };
    const merged = mergeTrainingResponse(session, deltaFor(session));
    expect(merged.questions).toBe(session.questions);
    expect(merged.answers.q2).toBe(session.answers.q2);
    expect(merged.answers.q1.choice).toBe(1);
    expect(session.answers.q1).toBeUndefined();
  });
  it('supports adaptive ordering and inserted recovery questions', () => {
    const session = sessionFixture();
    const newQuestion = { ...session.questions[0], id: 'recovery' };
    const merged = mergeTrainingResponse(session, { ...deltaFor(session), questionOrder: ['q2', 'recovery', 'q1'], questionUpdates: [newQuestion] });
    expect(merged.questions.map(q => q.id)).toEqual(['q2', 'recovery', 'q1']);
    expect(merged.questions[0]).toBe(session.questions[1]);
  });
  it('rejects stale, foreign, malformed and missing-question updates', () => {
    const session = sessionFixture();
    for (const patch of [{ baseRevision: 0 }, { id: 'other' }, { revision: 9 }, { questionOrder: ['missing'] }, { current: 10 }, { questionOrder: ['q1','q1'] }]) {
      expect(() => mergeTrainingResponse(session, { ...deltaFor(session), ...patch })).toThrow(/Reload/);
    }
  });
  it('accepts full reload, legacy and completion snapshots', () => {
    const session = sessionFixture();
    const full = { ...session, status: 'completed' as const };
    expect(mergeTrainingResponse(session, full)).toBe(full);
  });
});
