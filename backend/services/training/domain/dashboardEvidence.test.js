import { expect, it } from 'vitest';
import { dashboardEvidence } from './dashboardEvidence.js';
import { buildIntelligence } from './mastery.js';
import { readinessWithEvidence } from './readiness.js';
it('preserves readiness factors when completed sessions omit questions, answers and result rows', () => {
  const session = { completedAt: new Date().toISOString(), questions: [{ id: 'a', correctIndex: 0, difficulty: 3 }, { id: 'b', correctIndex: 1, difficulty: 5 }], answers: { a: { choice: 0 }, b: { choice: 0 } }, result: { maxScore: 4, negativeLoss: 0.5, rows: [{ attempted: true, correct: true, target: 20, seconds: 30 }, { attempted: true, correct: false, target: 20, seconds: 30 }] } };
  const compact = { ...session, questions: [], answers: {}, dashboardEvidence: dashboardEvidence(session), result: { ...session.result, rows: undefined } };
  const fullResult = readinessWithEvidence(buildIntelligence([session], Date.now(), true), [session], [], []);
  const compactResult = readinessWithEvidence(buildIntelligence([compact], Date.now(), true), [compact], [], []);
  expect(compactResult.factors).toEqual(fullResult.factors);
});
