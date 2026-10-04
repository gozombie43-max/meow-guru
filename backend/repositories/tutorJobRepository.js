import { getMongoDB } from '../config/mongodb.js';
const jobs = () => getMongoDB().collection('runtimeJobs');
export const insertTutorJob = doc => jobs().insertOne(doc);
export const findStagedTutorJob = (userId, id) => jobs().findOne({ _id: id, userId });
export const queueStagedTutorJob = id => jobs().updateOne({ _id: id, status: 'staging' }, { $set: { status: 'queued', availableAt: new Date() } });
export const findTutorJob = (userId, id) => jobs().findOne({ _id: id, userId, kind: 'tutor', expiresAt: { $gt: new Date() } });
export async function cancelOwnedTutorJob(userId, id) {
  const result = await jobs().updateOne({ _id: id, userId, kind: 'tutor', status: { $in: ['staging', 'queued', 'running'] } }, { $set: { status: 'cancelled', finishedAt: new Date() }, $unset: { owner: '', leaseUntil: '' } });
  return result.modifiedCount === 1;
}
