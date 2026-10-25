import { getMongoDB } from '../config/mongodb.js';

// Bulk topic import jobs. One job = one batch of up to 10 staged files, each
// mapped to a single subject/topic/quiz. Workers claim jobs through a lease so
// validation and import survive restarts and resume from per-file checkpoints.
export const jobsCollection = () => getMongoDB().collection('questionImportJobs');
export const issuesCollection = () => getMongoDB().collection('questionImportIssues');

const SUMMARY_PROJECTION = { _id: 1, status: 1, examMode: 1, createdAt: 1, updatedAt: 1, 'files.id': 1, 'files.name': 1, 'files.status': 1, 'files.counts': 1 };

export const insertJob = job => jobsCollection().insertOne(job);
export const findJob = (id, createdBy) => jobsCollection().findOne({ _id: String(id), createdBy });
export const findJobById = id => jobsCollection().findOne({ _id: String(id) });
export const listJobs = createdBy => jobsCollection().find({ createdBy }).project(SUMMARY_PROJECTION).sort({ updatedAt: -1 }).limit(20).toArray();

// Conditional update scoped to the owning admin; returns the updated job or null.
export function updateJob(id, createdBy, extraFilter, update) {
  return jobsCollection().findOneAndUpdate({ _id: String(id), createdBy, ...extraFilter }, update, { returnDocument: 'after' });
}

export const deleteJob = (id, createdBy) => jobsCollection().deleteOne({ _id: String(id), createdBy });

export async function claimJob(owner, leaseMs) {
  const now = new Date();
  return jobsCollection().findOneAndUpdate(
    { phase: { $in: ['validate', 'import'] }, $or: [{ lease: null }, { 'lease.until': { $lt: now } }] },
    { $set: { lease: { owner, until: new Date(now.getTime() + leaseMs) } }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { updatedAt: 1 } },
  );
}

export async function renewLease(id, owner, leaseMs) {
  const result = await jobsCollection().updateOne({ _id: id, 'lease.owner': owner }, { $set: { 'lease.until': new Date(Date.now() + leaseMs) } });
  return result.matchedCount === 1;
}

// Worker-side write guarded by the lease owner.
export async function updateOwned(id, owner, update, arrayFilters) {
  const result = await jobsCollection().updateOne({ _id: id, 'lease.owner': owner }, update, arrayFilters ? { arrayFilters } : undefined);
  return result.matchedCount === 1;
}

export async function insertIssues(docs) {
  if (docs.length) await issuesCollection().insertMany(docs, { ordered: false });
}
export const clearIssues = (jobId, fileId, phase) => issuesCollection().deleteMany({ jobId, ...(fileId ? { fileId } : {}), ...(phase ? { phase } : {}) });
export const skippedRows = (jobId, fileId) => issuesCollection().distinct('line', { jobId, fileId, skip: true });
export const issuesCursor = (jobId, fileId) => issuesCollection().find({ jobId, fileId }, { projection: { _id: 0, line: 1, phase: 1, severity: 1, code: 1, message: 1 } }).sort({ line: 1 });

export const findExpiredJobs = (limit = 5) => jobsCollection().find({ expiresAt: { $lt: new Date() }, phase: null }).limit(limit).toArray();
