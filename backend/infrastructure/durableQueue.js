import { randomUUID } from 'node:crypto';

export async function claimJob(collection, kind, now = new Date(), leaseMs = 60000) {
  await collection.updateMany({ kind, attempts: { $gte: 3 }, status: 'running', leaseUntil: { $lte: now } }, { $set: { status: 'failed', error: 'Processing attempts exhausted', finishedAt: now } });
  return collection.findOneAndUpdate({ kind, expiresAt: { $gt: now }, attempts: { $lt: 3 }, $or: [{ status: 'queued', availableAt: { $lte: now } }, { status: 'running', leaseUntil: { $lte: now } }] }, { $set: { status: 'running', owner: randomUUID(), leaseUntil: new Date(+now + leaseMs), startedAt: now }, $inc: { attempts: 1 } }, { sort: { availableAt: 1 }, returnDocument: 'after' });
}
const owned = (job, now) => ({ _id: job._id, owner: job.owner, status: 'running', leaseUntil: { $gt: now } });
export async function renewJob(collection, job, now = new Date(), leaseMs = 60000) {
  return (await collection.updateOne(owned(job, now), { $set: { leaseUntil: new Date(+now + leaseMs) } })).matchedCount === 1;
}
export async function completeJob(collection, job, result, now = new Date()) {
  return (await collection.updateOne(owned(job, now), { $set: { status: 'completed', result, finishedAt: now }, $unset: { owner: '', leaseUntil: '' } })).matchedCount === 1;
}
export async function failJob(collection, job, now = new Date()) {
  const retry = job.attempts < 3;
  return collection.updateOne(owned(job, now), { $set: { status: retry ? 'queued' : 'failed', error: 'Unable to process this attachment. Try a clearer image or smaller PDF.', availableAt: new Date(+now + job.attempts * 5000), ...(!retry ? { finishedAt: now } : {}) }, $unset: { owner: '', leaseUntil: '' } });
}
