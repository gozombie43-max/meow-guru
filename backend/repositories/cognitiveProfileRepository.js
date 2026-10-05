import { getUser } from './userRepository.js';
import { getMongoDB, getUsersCollection } from '../config/mongodb.js';

export async function getCognitiveProfile(id) {
  return getUser(id, { id: 1, recentQuizzes: 1, failureMap: 1, masteryMap: 1, timePerQuestion: 1 });
}
export async function appendCognitiveFailures(profile, tags, fields) {
  const increments = {}, updates = { ...fields };
  for (const tag of tags) {
    const key = `${tag.topic}::${tag.concept}`;
    for (const suffix of [tag.dimension, 'totalWrong']) {
      const path = `failureMap.${key}.${suffix}`;
      increments[path] = (increments[path] || 0) + 1;
    }
    updates[`failureMap.${key}.lastSeen`] = tag.taggedAt;
  }
  const target = profile.historyStorageVersion === 1 ? getMongoDB().collection('userAnalytics') : getUsersCollection();
  const result = await target.updateOne(profile.historyStorageVersion === 1 ? { userId: String(profile.id) } : { _id: profile._id }, { $inc: increments, $set: updates }, { upsert: profile.historyStorageVersion === 1 });
  if (result.matchedCount !== 1 && !result.upsertedCount) throw new Error('Cognitive profile no longer exists');
  return result;
}
