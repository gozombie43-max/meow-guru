import { getMongoDB } from '../config/mongodb.js';
import { LRUCache } from 'lru-cache';
import { registerSharedLocalCache } from '../infrastructure/tieredCache.js';
import { claimJob, renewJob, completeJob } from '../infrastructure/durableQueue.js';
const groups = () => getMongoDB().collection('conceptGroupMetadata');
const databaseCaches = new WeakMap();
function cacheState(db) {
  let state = databaseCaches.get(db);
  if (!state) {
    const completed = new LRUCache({ max: 200, maxSize: 10 * 1024 * 1024,
      maxEntrySize: 1024 * 1024, ttl: 300000,
      sizeCalculation: value => Buffer.byteLength(JSON.stringify(value)) });
    state = { completed, pending: new Map(), statusPending: new Map() };
    databaseCaches.set(db, state);
    registerSharedLocalCache(completed);
  }
  return state;
}
export async function readConceptGrouping(fingerprint) {
  const db = getMongoDB(), state = cacheState(db);
  const cached = state.completed.get(fingerprint);
  if (cached) return cached;
  if (state.statusPending.has(fingerprint)) return state.statusPending.get(fingerprint);
  if (state.statusPending.size >= 256) throw Object.assign(new Error('Grouping read capacity exceeded'), { statusCode: 503 });
  const work = db.collection('conceptGroupMetadata').findOne({ _id: fingerprint }, {
    projection: { status: 1, 'result.groups': 1 }, timeoutMS: 5000,
  }).then(doc => {
    if (doc?.status === 'completed') state.completed.set(fingerprint, doc);
    return doc;
  });
  state.statusPending.set(fingerprint, work);
  try { return await work; }
  finally { state.statusPending.delete(fingerprint); }
}
export async function enqueueConceptGrouping(fingerprint, doc) {
  const db = getMongoDB(), state = cacheState(db);
  // Completed results are immutable for this version/scope/concepts fingerprint.
  const cached = state.completed.get(fingerprint);
  if (cached) return cached;
  if (state.pending.has(fingerprint)) return state.pending.get(fingerprint);
  if (state.pending.size >= 256) throw Object.assign(new Error('Grouping read capacity exceeded'), { statusCode: 503 });
  const work = (async () => {
    const collection = db.collection('conceptGroupMetadata');
    let existing = await collection.findOne({ _id: fingerprint });
    if (!existing) {
      await collection.updateOne({ _id: fingerprint }, { $setOnInsert: doc }, { upsert: true });
      existing = await collection.findOne({ _id: fingerprint });
    }
    if (existing?.status === 'completed') state.completed.set(fingerprint, existing);
    return existing;
  })();
  state.pending.set(fingerprint, work);
  try { return await work; }
  finally { state.pending.delete(fingerprint); }
}
export const claimConceptGrouping = leaseMs => claimJob(groups(), 'concept-grouping', new Date(), leaseMs);
export const renewConceptGrouping = (job, leaseMs) => renewJob(groups(), job, new Date(), leaseMs);
export const completeConceptGrouping = (job, result) => completeJob(groups(), job, result);
export const retryConceptGrouping = (job, retry, error) => groups().updateOne({ _id: job._id, owner: job.owner, status: 'running', leaseUntil: { $gt: new Date() } }, {
  $set: { status: retry ? 'queued' : 'failed', error: String(error.message).slice(0, 300), availableAt: new Date(Date.now() + Math.round(15000 * 2 ** (job.attempts - 1) * (0.8 + Math.random() * 0.6))) },
  $unset: { owner: '', leaseUntil: '' },
});
