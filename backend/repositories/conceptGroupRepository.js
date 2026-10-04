import { getMongoDB } from '../config/mongodb.js';
import { claimJob, renewJob, completeJob } from '../infrastructure/durableQueue.js';
const groups = () => getMongoDB().collection('conceptGroupMetadata');
export async function enqueueConceptGrouping(fingerprint, doc) {
  await groups().updateOne({ _id: fingerprint }, { $setOnInsert: doc }, { upsert: true });
  return groups().findOne({ _id: fingerprint });
}
export const claimConceptGrouping = leaseMs => claimJob(groups(), 'concept-grouping', new Date(), leaseMs);
export const renewConceptGrouping = (job, leaseMs) => renewJob(groups(), job, new Date(), leaseMs);
export const completeConceptGrouping = (job, result) => completeJob(groups(), job, result);
export const retryConceptGrouping = (job, retry, error) => groups().updateOne({ _id: job._id, owner: job.owner, status: 'running', leaseUntil: { $gt: new Date() } }, {
  $set: { status: retry ? 'queued' : 'failed', error: String(error.message).slice(0, 300), availableAt: new Date(Date.now() + Math.round(15000 * 2 ** (job.attempts - 1) * (0.8 + Math.random() * 0.6))) },
  $unset: { owner: '', leaseUntil: '' },
});
