import { describe, expect, it } from 'vitest';
import { transition } from './sessionStateMachine.js';
import { sessionUpdate } from './sessionUpdate.js';
import { publicSession, publicActionDelta } from '../serializers/publicSession.js';

const now = 1700000000000;
function fixture(mode = 'section') {
  return { id: 'session', userId: 'learner', exam: 'ssc-cgl', mode, status: 'active', revision: 0,
    current: 0, lives: 3, lastEventAt: now, startedAt: new Date(now).toISOString(), deadline: new Date(now + 3600000).toISOString(), duration: 3600,
    marking: { correct: 1, wrong: .25 }, baseline: {}, reserve: [], answers: {}, events: [{ type: 'visit', questionId: 'q0', at: now }],
    questions: Array.from({ length: 50 }, (_, i) => ({ id: `q${i}`, subject: 'mathematics', topic: `Topic ${i % 5}`, difficulty: i % 5 + 1, expectedTime: 60, text: 'Question '.repeat(100), options: ['A', 'B'], correctIndex: 0, solution: 'Private solution '.repeat(100) })),
  };
}
function freeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return value;
}
describe('incremental training transitions', () => {
  it.each(['adaptive','challenge','sprint','pressure','section','gauntlet','nightmare','survival','review'])('preserves its immutable input and public equivalence in %s', mode => {
    const previous = freeze(fixture(mode));
    const updated = transition(previous, { type: 'answer', choice: 0, confidence: 'sure' }, now + 5000);
    const delta = publicActionDelta(previous, updated, now + 5000);
    const oldPublic = publicSession(previous, now + 5000);
    const byId = new Map(oldPublic.questions.map(q => [q.id, q]));
    for (const q of delta.questionUpdates || []) byId.set(q.id, q);
    const { kind, baseRevision, questionOrder, questionUpdates, ...state } = delta;
    const merged = { ...oldPublic, ...state, answers: { ...oldPublic.answers, ...state.answers }, questions: questionOrder ? questionOrder.map(id => byId.get(id)) : oldPublic.questions };
    expect(merged).toEqual(publicSession(updated, now + 5000));
    expect(previous.answers).toEqual({});
    expect(updated.questions[0]).toBe(previous.questions[0]);
    if (!questionOrder) expect(sessionUpdate(previous, updated).$set.questions).toBeUndefined();
    if (questionOrder) expect(sessionUpdate(previous, updated).$set.questionOrder).toEqual(questionOrder);
  });
  it('writes one answer and appended event, and sends a much smaller normal response', () => {
    const previous = fixture();
    const updated = transition(previous, { type: 'answer', choice: 1 }, now + 2000);
    const update = sessionUpdate(previous, updated);
    expect(Object.keys(update.$set).sort()).toEqual(['answers.q0', 'lastEventAt']);
    expect(update.$inc).toEqual({ revision: 1 });
    expect(update.$push.events.$each).toHaveLength(1);
    const delta = publicActionDelta(previous, updated);
    expect(delta).not.toHaveProperty('questions');
    expect(delta).not.toHaveProperty('questionOrder');
    expect(JSON.stringify(delta).length).toBeLessThan(JSON.stringify(publicSession(updated)).length * .1);
  });
  it('reveals full results only at completion and preserves finish timing', () => {
    const previous = freeze(fixture());
    const updated = transition(previous, { type: 'finish' }, now + 3600001);
    const response = publicActionDelta(previous, updated);
    expect(response.kind).toBeUndefined();
    expect(response.completionReason).toBe('timeout');
    expect(response.questions[0].solution).toContain('Private solution');
    expect(updated.answers.q0.seconds).toBe(3600);
  });
  it('sends only new recovery questions without answer keys', () => {
    const previous = fixture('gauntlet');
    const updated = { ...previous, revision: 1, questions: [...previous.questions, { ...previous.questions[0], id: 'recovery' }] };
    const delta = publicActionDelta(previous, updated);
    expect(delta.questionOrder).toHaveLength(51);
    expect(delta.questionUpdates).toHaveLength(1);
    expect(delta.questionUpdates[0]).not.toHaveProperty('correctIndex');
    expect(delta.questionUpdates[0]).not.toHaveProperty('solution');
  });
});
