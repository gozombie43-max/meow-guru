import { createHash } from 'node:crypto';
import { createDurableProgressCache } from '../../infrastructure/durableProgressCache.js';

const cache = createDurableProgressCache('training-dashboard', (userId, exam) => createHash('sha256').update(JSON.stringify([String(userId), exam])).digest('hex'), 5);
export const readTrainingDashboardCache = cache.read;
export const writeTrainingDashboardCache = cache.write;
export const cachedTrainingDashboard = (userId, exam, build) => cache.load([userId, exam], build);
// Durable generation advancement belongs inside the Mongo source transaction.
export const advanceTrainingDashboardRevision = (userId, exam, options) => cache.advance([userId, exam], options);
export const invalidateTrainingDashboard = cache.invalidate;
