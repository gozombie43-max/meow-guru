import { getMongoDB } from '../config/mongodb.js';
import { randomUUID } from 'node:crypto';
const jobs = () => getMongoDB().collection('runtimeJobs');
export const insertTutorJob = doc => jobs().insertOne(doc);
export const findStagedTutorJob = (userId, id) => jobs().findOne({ _id: id, userId });
export const trackTutorObject = (jobId, key, cleanupAfter) => getMongoDB().collection('tutorObjects').updateOne({ _id: key }, { $set: { jobId, key, cleanupAfter } }, { upsert: true });
export const listExpiredTutorObjects = (now = new Date()) => getMongoDB().collection('tutorObjects').find({ cleanupAfter: { $lte: now } }).limit(20).toArray();
export const forgetTutorObject = key => getMongoDB().collection('tutorObjects').deleteOne({ _id: key });
export const beginTutorUpload = (id, owner, now = new Date()) => jobs().findOneAndUpdate({
  _id: id, status: 'staging', expiresAt: { $gt: new Date(+now + 120000) },
  $or: [{ uploadUntil: { $exists: false } }, { uploadUntil: { $lte: now } }],
}, { $set: { uploadOwner: owner, uploadUntil: new Date(+now + 60000) } }, { returnDocument: 'after' });
export const releaseTutorUpload = (id, owner) => jobs().updateOne({ _id: id, uploadOwner: owner }, { $unset: { uploadOwner: '', uploadUntil: '' } });
export const queueStagedTutorJob = (id, owner) => jobs().updateOne({ _id: id, status: 'staging', uploadOwner: owner }, { $set: { status: 'queued', availableAt: new Date() }, $unset: { uploadOwner: '', uploadUntil: '' } });

export function claimTutorInputCleanup(now = new Date()) {
  const owner = randomUUID();
  return jobs().findOneAndUpdate({ kind: 'tutor', inputDeleted: { $ne: true }, $and: [
    { $or: [{ uploadUntil: { $exists: false } }, { uploadUntil: { $lte: now } }] },
    { $or: [{ inputCleanupUntil: { $exists: false } }, { inputCleanupUntil: { $lte: now } }] },
    { $or: [
      { status: { $in: ['completed', 'failed', 'cancelled'] } },
      { expiresAt: { $lte: now } },
      { status: 'staging', createdAt: { $lte: new Date(+now - 30 * 60000) } },
    ] },
  ] }, [{ $set: {
    inputCleanupOwner: owner, inputCleanupUntil: new Date(+now + 60000),
    status: { $cond: [{ $in: ['$status', ['staging', 'queued', 'running']] }, 'failed', '$status'] },
  } }], { returnDocument: 'after' });
}
export const finishTutorInputCleanup = row => jobs().updateOne({ _id: row._id, inputCleanupOwner: row.inputCleanupOwner }, { $set: { inputDeleted: true }, $unset: { inputCleanupOwner: '', inputCleanupUntil: '' } });
export const findTutorJob = (userId, id) => jobs().findOne({ _id: id, userId, kind: 'tutor', expiresAt: { $gt: new Date() } });
export async function cancelOwnedTutorJob(userId, id) {
  const result = await jobs().updateOne({ _id: id, userId, kind: 'tutor', status: { $in: ['staging', 'queued', 'running'] } }, { $set: { status: 'cancelled', finishedAt: new Date() }, $unset: { owner: '', leaseUntil: '' } });
  return result.modifiedCount === 1;
}
