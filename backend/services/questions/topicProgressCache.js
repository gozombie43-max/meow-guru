import { createHash } from 'node:crypto';
import { createDurableProgressCache } from '../../infrastructure/durableProgressCache.js';

export const TOPIC_PROGRESS_CACHE_TTL_SECONDS = 300;
const cache = createDurableProgressCache('topic-progress', userId => createHash('sha256').update(String(userId)).digest('hex'), TOPIC_PROGRESS_CACHE_TTL_SECONDS);
export const readTopicProgressCache = cache.read;
export const writeTopicProgressCache = cache.write;
export const cachedTopicProgress = (userId, build) => cache.load([userId], build);
// Durable generation advancement belongs inside the Mongo source transaction.
export const advanceTopicProgressRevision = (userId, options) => cache.advance([userId], options);
export const invalidateTopicProgress = cache.invalidate;
