import type { TrainingSession, TrainingQuestion } from '../training-types';

export type TrainingDelta = Omit<TrainingSession, 'questions'> & {
  kind: 'delta'; baseRevision: number;
  questionOrder?: string[];
  questionUpdates?: TrainingQuestion[];
};

export function mergeTrainingResponse(session: TrainingSession, data: TrainingSession | TrainingDelta): TrainingSession {
  if (!('kind' in data) || data.kind !== 'delta') return data as TrainingSession;
  if (data.id !== session.id || data.baseRevision !== session.revision || data.revision !== session.revision + 1) {
    throw new Error('Session changed. Reload before continuing.');
  }
  const { kind: _kind, baseRevision: _baseRevision, questionOrder, questionUpdates, ...state } = data;
  let questions = session.questions;
  if (questionOrder || questionUpdates?.length) {
    const byId = new Map(questions.map(q => [q.id, q]));
    for (const q of questionUpdates || []) byId.set(q.id, q);
    const order = questionOrder || questions.map(q => q.id);
    if (new Set(order).size !== order.length || order.some(id => !byId.has(id))) {
      throw new Error('Invalid session update. Reload before continuing.');
    }
    questions = order.map(id => byId.get(id)!);
  }
  if (!questions[data.current]) throw new Error('Invalid session position. Reload before continuing.');
  return { ...session, ...state, questions, answers: { ...session.answers, ...data.answers } };
}
