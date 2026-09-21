import { isDeepStrictEqual } from 'node:util';

// Keep the revision predicate in the repository. These operators only describe
// changed values, including recovery insertions and future transition fields.
export function sessionUpdate(previous, updated) {
  const set = {}, unset = {}, push = {};
  for (const key of new Set([...Object.keys(previous), ...Object.keys(updated)])) {
    if (key === '_id' || key === 'revision' || key === 'questionOrder') continue;
    if (isDeepStrictEqual(previous[key], updated[key])) continue;
    if (!(key in updated)) { unset[key] = ''; continue; }
    if (key === 'answers') {
      for (const id of new Set([...Object.keys(previous.answers), ...Object.keys(updated.answers)])) {
        if (isDeepStrictEqual(previous.answers[id], updated.answers[id])) continue;
        if (!(id in updated.answers)) unset[`answers.${id}`] = '';
        else set[`answers.${id}`] = updated.answers[id];
      }
    } else if (key === 'questions') {
      const old = new Map(previous.questions.map(q => [q.id, q]));
      const sameContent = updated.questions.every(q => !old.has(q.id) || isDeepStrictEqual(old.get(q.id), q));
      const keepsOld = previous.questions.every(q => updated.questions.some(next => next.id === q.id));
      if (sameContent && keepsOld) {
        const added = updated.questions.filter(q => !old.has(q.id));
        if (added.length) push.questions = { $each: added };
      } else set.questions = updated.questions;
      // Store ordering separately from immutable question content. Adaptive
      // reordering and recovery insertion never retransmit unchanged questions.
      set.questionOrder = updated.questions.map(q => q.id);
    } else if (key === 'events' && updated.events.length >= previous.events.length &&
      previous.events.every((event, i) => isDeepStrictEqual(event, updated.events[i]))) {
      push.events = { $each: updated.events.slice(previous.events.length) };
    } else {
      set[key] = updated[key];
    }
  }
  return {
    ...(Object.keys(set).length ? { $set: set } : {}),
    ...(Object.keys(unset).length ? { $unset: unset } : {}),
    ...(Object.keys(push).length ? { $push: push } : {}),
    $inc: { revision: updated.revision - previous.revision },
  };
}

export function orderedTrainingSession(session) {
  if (!session?.questionOrder) return session;
  const byId = new Map(session.questions.map(q => [q.id, q]));
  if (session.questionOrder.length !== session.questions.length ||
      new Set(session.questionOrder).size !== session.questionOrder.length ||
      session.questionOrder.some(id => !byId.has(id))) {
    throw new Error('Invalid stored training question order');
  }
  return { ...session, questions: session.questionOrder.map(id => byId.get(id)) };
}
