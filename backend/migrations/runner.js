import { randomUUID } from 'node:crypto';
import * as existingIndexes from './001-existing-indexes.js';
import * as runtime from './002-runtime.js';
import * as productionHardening from './003-production-hardening.js';
import * as readiness from './004-readiness.js';

export const migrations = [existingIndexes, runtime, productionHardening, readiness];
export async function assertMigrations(db) {
  const applied = await db.collection('schemaMigrations').find({ _id: { $in: migrations.map(m => m.id) }, completedAt: { $exists: true } }, { timeoutMS: 2000 }).toArray();
  if (applied.length !== migrations.length) throw new Error('Database migrations required: run npm run db:migrate before starting this release');
}

export async function migrate(db, steps = migrations) {
  const locks = db.collection('schemaMigrationLocks');
  const owner = randomUUID();
  // No automatic lock stealing while an index build may still be running.
  // A crashed runner requires explicit operator recovery after checking server operations.
  try { await locks.insertOne({ _id: 'migrations', owner, startedAt: new Date() }); }
  catch (error) {
    if (error.code === 11000) throw new Error('Migration runner already active, or a previous runner needs lock recovery');
    throw error;
  }
  try {
    for (const step of steps) {
      // Reconcile idempotent index definitions even when the version is recorded.
      await step.up(db);
      await db.collection('schemaMigrations').updateOne({ _id: step.id }, { $set: { completedAt: new Date() } }, { upsert: true });
    }
  } finally { await locks.deleteOne({ _id: 'migrations', owner }); }
}
