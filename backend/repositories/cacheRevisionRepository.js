import { randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';

// Durable generations prevent missed Pub/Sub events from returning stale lists.
export async function getCacheRevision(scope) {
  const row = await getMongoDB().collection('runtimeCacheRevisions').findOne({ _id: scope });
  return row?.revision || '0';
}
export async function advanceCacheRevision(scope) {
  const revision = randomUUID();
  await getMongoDB().collection('runtimeCacheRevisions').updateOne(
    { _id: scope }, { $set: { revision, updatedAt: new Date() } }, { upsert: true },
  );
  return revision;
}
