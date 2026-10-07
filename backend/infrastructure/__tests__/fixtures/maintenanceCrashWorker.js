// Disposable test worker: commit an idempotent effect, then crash before BullMQ acknowledges it.
import { MongoClient } from 'mongodb';
import { Worker } from 'bullmq';
import { queueConnection } from '../../maintenanceQueue.js';
const mongo = new MongoClient(process.env.FAULT_MONGO_URI);
await mongo.connect();
const db = mongo.db('worker_crash');
const worker = new Worker('maintenance', async job => {
  await db.collection('attempts').insertOne({ jobId: job.id });
  await db.collection('effects').updateOne({ _id: job.id }, { $setOnInsert: { effect: 1 } }, { upsert: true });
  process.send?.({ type: 'committed', jobId: job.id });
  if (process.env.FAULT_HOLD === 'true') await new Promise(() => {});
  return { effect: 1 };
}, { connection: { ...queueConnection(process.env.FAULT_QUEUE_URL), maxRetriesPerRequest: null, enableOfflineQueue: true }, prefix: process.env.FAULT_QUEUE_PREFIX, lockDuration: 1000, stalledInterval: 500, maxStalledCount: 2 });
worker.on('error', () => {});
await worker.waitUntilReady();
process.send?.({ type: 'ready' });
