import { getMockAttemptsCollection, getMockSlotsCollection, getQuestionsCollection } from '../config/mongodb.js';

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
  return getMockAttemptsCollection().updateOne(filter, update);
};

export const getTestHistory = async (userId, examSlug, testId) => {
  return getMockAttemptsCollection()
    .find(
      { userId: String(userId), examSlug, testId },
      { projection: { _id: 0, _cosmosRid: 0, id: 1, testId: 1, examSlug: 1, status: 1, startedAt: 1, submittedAt: 1, result: 1 } }
    )
    .sort({ startedAt: -1 })
    .limit(100)
    .toArray();
};

export const getExamHistory = async (userId, examSlug) => {
  return getMockAttemptsCollection()
    .find(
      { userId: String(userId), examSlug },
      { projection: { _id: 0, _cosmosRid: 0, id: 1, testId: 1, examSlug: 1, configKey: 1, status: 1, startedAt: 1, submittedAt: 1, result: 1 } }
    )
    .sort({ startedAt: -1 })
    .limit(100)
    .toArray();
};

export const getAttemptsCollection = () => getMockAttemptsCollection();
export const getSlotsCollection = () => getMockSlotsCollection();
export const getQuestionsCol = () => getQuestionsCollection();
