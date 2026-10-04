import { getUsersCollection } from '../config/mongodb.js';

export async function getCognitiveProfile(id) {
  return getUsersCollection().findOne({ id: String(id), type: { $ne: 'email_lock' } });
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
  const result = await getUsersCollection().updateOne({ _id: profile._id }, { $inc: increments, $set: updates });
  if (result.matchedCount !== 1) throw new Error('Cognitive profile no longer exists');
  return result;
}
