import { findLearnerStateMeta, findCompletedLearnerSessions, persistRebuiltLearnerState, readLearnerStateEvidence, LEARNER_STATE_EPOCH_CHANGED as EPOCH_CHANGED } from '../../../repositories/trainingLearnerStateRepository.js';
export { completedLearnerPairs } from '../../../repositories/trainingLearnerStateRepository.js';

import {
  applySessionToLearnerState,
  createLearnerState,
  learnerStateDocuments,
} from '../domain/learnerStateReducer.js';

const META_VERSION = 1;
const metaId = (userId, exam) => `${userId}:${exam}`;


const attemptCount = session => (session.questions || []).filter(question => {
  const answer = session.answers?.[question.id];
  return answer && answer.choice !== null;
}).length;

export async function inspectLearnerStatePair(db, userId, exam) {
  const { meta, sessions } = await readLearnerStateEvidence(db, userId, exam);
  return { userId, exam, meta, sourceSessionCount: sessions.length, sourceAttemptCount: sessions.reduce((total, session) => total + attemptCount(session), 0) };
}

export async function rebuildLearnerStateForPair(db, userId, exam, { maxRetries = 4, afterMetaRead, beforeCommit } = {}) {
  for (let retry = 0; retry < maxRetries; retry++) {
    // The epoch defines the historical snapshot boundary. Read it first: a
    // completion before this read is included below, while one afterwards
    // increments the epoch and makes the final compare-and-set fail.
    const meta = await findLearnerStateMeta(db, userId, exam);
    const completionEpoch = meta?.completionEpoch || 0;
    if (afterMetaRead) await afterMetaRead({ retry, completionEpoch });
    const sessions = await findCompletedLearnerSessions(db, userId, exam);
    const state = createLearnerState();
    for (const session of sessions) applySessionToLearnerState(state, session);
    const sourceAttemptCount = sessions.reduce((total, session) => total + attemptCount(session), 0);
    if (beforeCommit) await beforeCommit({ retry, completionEpoch, sessions });

    try {
      await persistRebuiltLearnerState(db, { userId, exam, meta, completionEpoch, sessions, sourceAttemptCount, buildDocuments: now => learnerStateDocuments(state, userId, exam, now) });
      return { userId, exam, retries: retry, sourceSessionCount: sessions.length, sourceAttemptCount };
    } catch (error) {
      if ((error.message !== EPOCH_CHANGED && error.code !== 11000) || retry === maxRetries - 1) throw error;
    }
  }
}

export { META_VERSION, metaId as learnerStateMetaId };
