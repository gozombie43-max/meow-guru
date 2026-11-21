import * as removeDemoMockSlots from './023-remove-demo-mock-slots.js';
import * as mockCatalogMetadata from './024-mock-catalog-metadata.js';
import * as questionImportJobs from './025-question-import-jobs.js';
import * as mockPyqOptimization from './026-mock-pyq-optimization.js';
import * as questionDeliveryOptimization from './027-question-delivery-optimization.js';
import * as backfillQuestionUids from './028-backfill-question-uids.js';
import * as userHistory from './017-user-history.js';
import * as defaultMockSlots from './018-default-mock-slots.js';
import * as battleCompetitivePolicy from './019-battle-competitive-policy.js';
import * as battleCoordinator from './020-battle-coordinator.js';
import * as authEmailSecurity from './021-auth-email-security.js';
import * as emailLoginOtp from './022-email-login-otp.js';
import * as databaseRemediation from './016-database-remediation.js';
import { randomUUID } from 'node:crypto';
import * as existingIndexes from './001-existing-indexes.js';
import * as runtime from './002-runtime.js';
import * as productionHardening from './003-production-hardening.js';
import * as readiness from './004-readiness.js';
import * as training from './005-training.js';

import * as oauthState from './006-oauth-state.js';
import * as trainingHardening from './007-training-hardening.js';
import * as trainingPerformance from './008-training-performance.js';
import * as trainingExamWideCandidates from './009-training-exam-wide-candidates.js';
import * as trainingLearnerStateMeta from './010-training-learner-state-meta.js';
import * as questionBrowserSort from './011-question-browser-sort.js';
import * as normalizedQuestionIndexes from './012-normalized-question-query-indexes.js';
import * as idempotency from './013-idempotency.js';
import * as feedKeysets from './014-feed-keysets.js';
import * as auditSecurity from './015-audit-security.js';

export const migrations = [existingIndexes, runtime, productionHardening, readiness, training, oauthState, trainingHardening, trainingPerformance, trainingExamWideCandidates, trainingLearnerStateMeta, questionBrowserSort, normalizedQuestionIndexes, idempotency, feedKeysets, auditSecurity, databaseRemediation, userHistory, defaultMockSlots, battleCompetitivePolicy, battleCoordinator, authEmailSecurity, emailLoginOtp, removeDemoMockSlots, mockCatalogMetadata, questionImportJobs, mockPyqOptimization, questionDeliveryOptimization, backfillQuestionUids];
export async function assertMigrations(db) {
  const applied = await db.collection('schemaMigrations').find({ _id: { $in: migrations.map(m => m.id) }, completedAt: { $exists: true } }, { timeoutMS: 2000 }).toArray();
  if (applied.length !== migrations.length) throw new Error('Database migrations required: run npm run db:migrate before starting this release');
}

function wrapDbSkippingRetiredIndexes(db) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'collection') {
        return (name, ...rest) => {
          const collection = target.collection(name, ...rest);
          return new Proxy(collection, {
            get(colTarget, colProp, colReceiver) {
              if (colProp === 'createIndex') {
                return (key, options, ...extra) => {
                  if (questionDeliveryOptimization.isRetiredIndexCreate(name, key, options)) {
                    return Promise.resolve(options?.name || 'skipped_retired_index');
                  }
                  return colTarget.createIndex(key, options, ...extra);
                };
              }
              const value = Reflect.get(colTarget, colProp, colReceiver);
              return typeof value === 'function' ? value.bind(colTarget) : value;
            },
          });
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
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
    const has027InRun = steps.some(step => step.id === questionDeliveryOptimization.id);
    const has027Applied = has027InRun || Boolean(
      await db.collection('schemaMigrations').findOne(
        { _id: questionDeliveryOptimization.id, completedAt: { $exists: true } },
        { projection: { _id: 1 } },
      ),
    );
    const wrappedDb = has027Applied ? wrapDbSkippingRetiredIndexes(db) : db;
    for (const step of steps) {
      // Reconcile idempotent index definitions even when the version is recorded,
      // skipping indexes retired by 027 so deploys never rebuild-and-drop them.
      const stepDb = has027Applied && step.id !== questionDeliveryOptimization.id ? wrappedDb : db;
      await step.up(stepDb);
      await db.collection('schemaMigrations').updateOne({ _id: step.id }, { $set: { completedAt: new Date() } }, { upsert: true });
    }
  } finally { await locks.deleteOne({ _id: 'migrations', owner }); }
}
