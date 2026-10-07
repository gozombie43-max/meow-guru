import { getMockAttemptsCollection, getMockSlotsCollection, getQuestionsCollection, withMongoTransaction } from '../config/mongodb.js';
import { advanceTrainingDashboardRevision } from '../services/training/dashboardCache.js';

export const getOwnedAttempt = async (attemptId, userId) => {
  return getMockAttemptsCollection().findOne({ id: String(attemptId), userId: String(userId) });
};

export const getAttemptByStartKey = async (userId, startKey) => {
  return getMockAttemptsCollection().findOne({ userId: String(userId), startKey });
};

export const getConfidentialAttempt = async (userId, examSlug, testId) => {
  return getMockAttemptsCollection().findOne({ userId: String(userId), examSlug, testId, assessmentMode: 'confidential' });
};

export const insertAttempt = async (doc) => {
  return getMockAttemptsCollection().insertOne(doc);
};

export const updateAttemptProgress = async (filter, update) => {
  return getMockAttemptsCollection().updateOne(filter, update);
};

export const submitAttemptUpdate = async (filter, update) => {
  return withMongoTransaction(async ({ db, session }) => {
    const collection = db.collection('mockAttempts');
    const attempt = await collection.findOne(filter, { projection: { userId: 1, examSlug: 1 }, session });
    if (!attempt) return { modifiedCount: 0 };
    const result = await collection.updateOne(filter, update, { session });
    if (result.modifiedCount) await advanceTrainingDashboardRevision(attempt.userId, attempt.examSlug, { db, session });
    return result;
  });
};

export const getTestHistory = async (userId, examSlug, testId) => {
  return getMockAttemptsCollection()
    .find(
      { userId: String(userId), examSlug, testId },
      { projection: { _id: 0, id: 1, testId: 1, examSlug: 1, status: 1, startedAt: 1, submittedAt: 1, result: 1 } }
    )
    .sort({ startedAt: -1 })
    .limit(100)
    .toArray();
};

export const getExamHistory = async (userId, examSlug) => {
  return getMockAttemptsCollection()
    .find(
      { userId: String(userId), examSlug },
      { projection: { _id: 0, id: 1, testId: 1, examSlug: 1, configKey: 1, status: 1, startedAt: 1, submittedAt: 1, result: 1 } }
    )
    .sort({ startedAt: -1 })
    .limit(100)
    .toArray();
};

export const getAttemptsCollection = () => getMockAttemptsCollection();
export const getSlotsCollection = () => getMockSlotsCollection();
export const getQuestionsCol = () => getQuestionsCollection();
