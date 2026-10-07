import { randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';

// Durable generations prevent missed Pub/Sub events from returning stale lists.
export async function getCacheRevision(scope) {
  const row = await getMongoDB().collection('runtimeCacheRevisions').findOne({ _id: scope }, { timeoutMS: 5000 });
  return row?.revision || '0';
}
export async function advanceCacheRevision(scope, { db = getMongoDB(), session } = {}) {
  const revision = randomUUID();
  await db.collection('runtimeCacheRevisions').updateOne(
    { _id: scope }, { $set: { revision, updatedAt: new Date() } }, { upsert: true, ...(session ? { session } : {}) },
  );
  return revision;
}

// Correctness-sensitive generations are committed with their source mutation.
// They are never cached in Redis or expired, so outages/restores cannot rewind them.
export async function getCacheCounter(scope) {
  const row = await getMongoDB().collection('runtimeCacheRevisions').findOne(
    { _id: scope }, { projection: { counter: 1 }, timeoutMS: 5000 },
  );
  return row?.counter ?? 0;
}
export async function advanceCacheCounter(scope, { db = getMongoDB(), session } = {}) {
  await db.collection('runtimeCacheRevisions').updateOne(
    { _id: scope }, { $inc: { counter: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true, ...(session ? { session } : {}) },
  );
}
