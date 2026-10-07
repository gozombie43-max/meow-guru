import { withMongoTransaction } from '../config/mongodb.js';
import { dashboardEvidence } from '../services/training/domain/dashboardEvidence.js';
import { advanceTrainingDashboardRevision } from '../services/training/dashboardCache.js';
export const LEARNER_STATE_EPOCH_CHANGED = 'Training learner-state completion epoch changed';
const EPOCH_CHANGED = LEARNER_STATE_EPOCH_CHANGED;
const META_VERSION = 1;
const metaId = (userId, exam) => `${userId}:${exam}`;
export const findLearnerStateMeta = (db, userId, exam) => db.collection('trainingLearnerStateMeta').findOne({ _id: metaId(userId, exam) });
export const findCompletedLearnerSessions = (db, userId, exam) => db.collection('trainingSessions').find({ userId, exam, status: 'completed' }).sort({ completedAt: 1, _id: 1 }).toArray();
export async function persistRebuiltLearnerState(db, { userId, exam, meta, completionEpoch, sessions, sourceAttemptCount, buildDocuments }) {
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

        const durable = buildDocuments(now);
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
        if (sessions.length) await db.collection('trainingSessions').bulkWrite(sessions.map(item => ({ updateOne: {
          filter: { _id: item._id }, update: { $set: { dashboardEvidence: dashboardEvidence(item) } },
        } })), { ordered: false, session: mongoSession });
        await advanceTrainingDashboardRevision(userId, exam, { db, session: mongoSession });
      });
}
export async function completedLearnerPairs(db) {
  return db.collection('trainingSessions').aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: { userId: '$userId', exam: '$exam' } } },
    { $sort: { '_id.userId': 1, '_id.exam': 1 } },
  ]).toArray().then(rows => rows.map(row => row._id));
}

export async function readLearnerStateEvidence(db, userId, exam) {
  const [meta, sessions] = await Promise.all([findLearnerStateMeta(db, userId, exam), db.collection('trainingSessions').find({ userId, exam, status: 'completed' }).project({ questions: 1, answers: 1 }).toArray()]);
  return { meta, sessions };
}
