import { createHash } from 'node:crypto';
import { createDurableProgressCache } from '../../infrastructure/durableProgressCache.js';

export const TRAINING_DASHBOARD_CACHE_TTL_SECONDS = 120;
const cache = createDurableProgressCache('training-dashboard', (userId, exam) => createHash('sha256').update(JSON.stringify([String(userId), exam])).digest('hex'), TRAINING_DASHBOARD_CACHE_TTL_SECONDS, {
  validUntil: value => Math.min(Infinity, ...(value?.active ?? []).map(session => Date.parse(session.deadline))),
});
export const readTrainingDashboardCache = cache.read;
export const writeTrainingDashboardCache = cache.write;
export const cachedTrainingDashboard = (userId, exam, build) => cache.load([userId, exam], build);
// Durable generation advancement belongs inside the Mongo source transaction.
export const advanceTrainingDashboardRevision = (userId, exam, options) => cache.advance([userId, exam], options);
export const invalidateTrainingDashboard = cache.invalidate;
