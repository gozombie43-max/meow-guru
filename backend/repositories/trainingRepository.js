import { getMongoDB, getQuestionsCollection } from '../config/mongodb.js';

const sessions = () => getMongoDB().collection('trainingSessions');
const examFilter = exam => {
  const pattern = new RegExp(`^${exam.split('-').join('[ -]?')}$`, 'i');
  return { $or: [{ exam: pattern }, { examName: pattern }, { exams: pattern }] };
};
export const trainingHistory = (userId, exam) => sessions().find({ userId, exam, status: 'completed' }).sort({ completedAt: -1 }).limit(200).toArray();
export const findMission = (userId, exam, missionDate) => sessions().findOne({ userId, exam, missionDate });
export const findOwnedSession = (id, userId, completed = false) => sessions().findOne({ id, userId, ...(completed ? { status: 'completed' } : {}) });
export const createTrainingSession = session => sessions().insertOne(session);
export const reloadTrainingSession = id => sessions().findOne({ _id: id });
export async function trainingDashboardData(userId, exam) {
  return Promise.all([
    sessions().find({ userId, exam, status: 'active' }).sort({ startedAt: -1 }).limit(5).project({ id: 1, mode: 1, deadline: 1 }).toArray(),
    getQuestionsCollection().distinct('subject', examFilter(exam)),
    getQuestionsCollection().distinct('topic', examFilter(exam)),
    getMongoDB().collection('mockAttempts').find({ userId, examSlug: exam, status: 'completed' }).sort({ submittedAt: -1 }).limit(20).project({ result: 1 }).toArray(),
  ]);
}
export const saveSkillProfile = (userId, exam, intelligence) => getMongoDB().collection('userSkillProfile').updateOne(
  { _id: `${userId}:${exam}` }, { $set: { userId, exam, ...intelligence, updatedAt: new Date() } }, { upsert: true },
);
export function trainingQuestionPool(config, dueIds, recentIds) {
  const filter = { $and: [examFilter(config.exam)] };
  if (config.subject) filter.$and.push({ subject: config.subject });
  if (config.topic) filter.$and.push({ $or: [{ topic: config.topic }, { questionTopic: config.topic }] });
  if (config.mode === 'review') filter.$and.push({ id: { $in: dueIds } });
  else if (recentIds.length) filter.$and.push({ id: { $nin: recentIds } });
  return getQuestionsCollection().find(filter).sort({ updatedAt: -1, _id: 1 }).limit(2000).toArray();
}
export const dueTrainingQuestions = (exam, ids) => getQuestionsCollection().find({ $and: [examFilter(exam), { id: { $in: ids } }] }).limit(100).toArray();
// Every session mutation retains the optimistic revision guard.
export function commitTrainingTransition(session, updated) {
  const { _id, ...fields } = updated;
  return sessions().updateOne({ _id: session._id, revision: session.revision }, { $set: fields });
}
export const saveTrainingDiagnosis = (session, diagnosis) => sessions().updateOne(
  { _id: session._id, revision: session.revision }, { $set: { 'result.diagnosis': diagnosis }, $inc: { revision: 1 } },
);
export const saveTrainingMistakes = session => sessions().updateOne(
  { _id: session._id, revision: session.revision }, { $set: { answers: session.answers, result: session.result }, $inc: { revision: 1 } },
);
