import { LRUCache } from "lru-cache";
import { getMongoDB } from "../../config/mongodb.js";

let cachedRevision = { value: 0, expires: 0 };

export async function getQuestionRevision() {
  const now = Date.now();
  if (cachedRevision.expires > now) {
    return cachedRevision.value;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 0;
  }
  try {
    const doc = await getMongoDB()
      .collection('questionMetadata')
      .findOne({ _id: 'revision' }, { projection: { revision: 1 } });
    const revision = doc?.revision ?? 0;
    cachedRevision = { value: revision, expires: now + 15_000 };
    return revision;
  } catch {
    return cachedRevision.value;
  }
}

export function invalidateQuestionCacheRevision() {
  cachedRevision = { value: cachedRevision.value + 1, expires: Date.now() + 15_000 };
  questionsQueryCache.clear();
  questionCountsCache.clear();
}

// Read the shared revision on lookup. Other API instances and
// workers invalidate immediately; the short TTL bounds out-of-band imports.
export async function revisionedQuestionCacheKey(key) {
  const normalized = process.env.QUESTIONS_NORMALIZED_KEYS !== 'false';
  const revision = await getQuestionRevision();
  return JSON.stringify([revision, normalized, key]);
}

export const QUESTIONS_QUERY_CACHE_TTL_MS = 30 * 1000;
export const QUESTION_METADATA_CACHE_TTL_MS = 120 * 1000;

export const questionsQueryCache = new LRUCache({
  max: 300,
  maxSize: 20 * 1024 * 1024,
  maxEntrySize: 1024 * 1024,
  sizeCalculation: value => Buffer.byteLength(JSON.stringify(value)),
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});

export const questionCountsCache = new LRUCache({
  max: 500,
  maxSize: 4 * 1024 * 1024,
  sizeCalculation: value => Buffer.byteLength(JSON.stringify(value)),
  ttl: QUESTION_METADATA_CACHE_TTL_MS,
});

export function buildQuestionsCacheKey(parameters, offset, limit) {
  return JSON.stringify({
    params: parameters.map((entry) => [entry.name, entry.value]),
    offset,
    limit,
  });
}
