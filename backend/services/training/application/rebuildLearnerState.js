import { withMongoTransaction } from '../../../config/mongodb.js';
import {
  applySessionToLearnerState,
  createLearnerState,
  learnerStateDocuments,
} from '../domain/learnerStateReducer.js';

const META_VERSION = 1;
const metaId = (userId, exam) => `${userId}:${exam}`;
const EPOCH_CHANGED = 'Training learner-state completion epoch changed';

const attemptCount = session => (session.questions || []).filter(question => {
  const answer = session.answers?.[question.id];
  return answer && answer.choice !== null;
}).length;

export async function completedLearnerPairs(db) {
  return db.collection('trainingSessions').aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: { userId: '$userId', exam: '$exam' } } },
    { $sort: { '_id.userId': 1, '_id.exam': 1 } },
  ]).toArray().then(rows => rows.map(row => row._id));
}

export async function inspectLearnerStatePair(db, userId, exam) {
  const [meta, sessions] = await Promise.all([
    db.collection('trainingLearnerStateMeta').findOne({ _id: metaId(userId, exam) }),
    db.collection('trainingSessions').find({ userId, exam, status: 'completed' })
      .project({ questions: 1, answers: 1 }).toArray(),
  ]);
  return { userId, exam, meta, sourceSessionCount: sessions.length, sourceAttemptCount: sessions.reduce((total, session) => total + attemptCount(session), 0) };
}

export async function rebuildLearnerStateForPair(db, userId, exam, { maxRetries = 4, beforeCommit } = {}) {
  for (let retry = 0; retry < maxRetries; retry++) {
    const [meta, sessions] = await Promise.all([
      db.collection('trainingLearnerStateMeta').findOne({ _id: metaId(userId, exam) }),
      db.collection('trainingSessions').find({ userId, exam, status: 'completed' })
        .sort({ completedAt: 1, _id: 1 }).toArray(),
    ]);
    const completionEpoch = meta?.completionEpoch || 0;
    const state = createLearnerState();
    for (const session of sessions) applySessionToLearnerState(state, session);
    const sourceAttemptCount = sessions.reduce((total, session) => total + attemptCount(session), 0);
    if (beforeCommit) await beforeCommit({ retry, completionEpoch, sessions });

    try {
      await withMongoTransaction(async ({ session: mongoSession }) => {
        const now = new Date();
        const nextMeta = {
          userId, exam, version: META_VERSION, status: 'ready', completionEpoch,
          backfilledThroughSessionId: sessions.at(-1)?.id || null,
          backfilledThroughCompletedAt: sessions.at(-1)?.completedAt || null,
          sourceSessionCount: sessions.length,
          sourceAttemptCount,
          rebuiltAt: now,
          updatedAt: now,
        };
        if (meta) {
          const metaWrite = await db.collection('trainingLearnerStateMeta').updateOne(
            { _id: metaId(userId, exam), completionEpoch },
            { $set: nextMeta },
            { session: mongoSession },
          );
          if (!metaWrite.matchedCount) throw new Error(EPOCH_CHANGED);
        } else {
          try {
            await db.collection('trainingLearnerStateMeta').insertOne(
              { _id: metaId(userId, exam), ...nextMeta, createdAt: now },
              { session: mongoSession },
            );
          } catch (error) {
            if (error.code === 11000) throw new Error(EPOCH_CHANGED);
            throw error;
          }
        }

        const durable = learnerStateDocuments(state, userId, exam, now);
        for (const [collection, rows] of [
          ['trainingSkillState', durable.skillRows],
          ['trainingReviewState', durable.reviewRows],
          ['trainingQuestionExposure', durable.exposureRows],
        ]) {
          await db.collection(collection).deleteMany({ userId, exam }, { session: mongoSession });
          if (rows.length) await db.collection(collection).insertMany(rows, { session: mongoSession });
        }
        if (sessions.length) await db.collection('trainingSessions').updateMany(
          { _id: { $in: sessions.map(item => item._id) } },
          { $set: { learningApplied: true, learningAppliedVersion: META_VERSION } },
          { session: mongoSession },
        );
      });
      return { userId, exam, retries: retry, sourceSessionCount: sessions.length, sourceAttemptCount };
    } catch (error) {
      if ((error.message !== EPOCH_CHANGED && error.code !== 11000) || retry === maxRetries - 1) throw error;
    }
  }
}

export { META_VERSION, metaId as learnerStateMetaId };
