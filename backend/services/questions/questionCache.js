import { LRUCache } from "lru-cache";
import { getMongoDB } from "../../config/mongodb.js";

let cachedRevision = { value: 0, expires: 0 };
let pendingRevision;

export function isNormalizedQuestionKeysEnabled() {
  return process.env.QUESTIONS_NORMALIZED_KEYS === 'true';
}

export async function getQuestionRevision() {
  let db;
  try { db = getMongoDB(); } catch { return cachedRevision.value; }
  if (pendingRevision?.db === db) return pendingRevision.promise;
  const promise = (async () => {
    try {
      const doc = await db
        .collection('questionMetadata')
        .findOne({ _id: 'revision' }, { projection: { revision: 1 }, timeoutMS: 300 });
      const revision = doc?.revision ?? 0;
      cachedRevision = { value: revision, expires: Date.now() };
      return revision;
    } catch {
      return cachedRevision.value;
    }
  })();
  pendingRevision = { db, promise };
  try { return await promise; }
  finally { if (pendingRevision?.promise === promise) pendingRevision = undefined; }
}

export function invalidateQuestionCacheRevision() {
  pendingRevision = undefined;
  cachedRevision = { value: cachedRevision.value + 1, expires: Date.now() };
  questionsQueryCache.clear();
  questionCountsCache.clear();
}

// Read the shared revision on lookup. Other API instances and
// workers invalidate immediately; query TTLs bound out-of-band imports.
export async function revisionedQuestionCacheKey(key) {
  const normalized = isNormalizedQuestionKeysEnabled();
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
