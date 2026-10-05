import { LRUCache } from "lru-cache";
import { readQuestionRevision } from '../../repositories/questionMetadataRepository.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { createHash } from 'node:crypto';

let cachedRevision = { value: 0, expires: 0 };
let pendingRevision;
let revisionGeneration = 0;
export const QUESTION_REVISION_TTL_MS = 10_000;
const pageCache = createTieredCache({ freshMs: 300000, staleMs: 300000, localMs: 10000 });
export async function cachedQuestionPage(scope, params, build) {
  const key = await revisionedQuestionCacheKey(`${scope}:${JSON.stringify(params)}`);
  return pageCache.read(`question-page:${createHash('sha256').update(key).digest('hex')}`, build, { allowStale: false });
}

export function isNormalizedQuestionKeysEnabled() {
  return process.env.QUESTIONS_NORMALIZED_KEYS === 'true';
}

export function clearQuestionRevisionCache() {
  cachedRevision = { value: 0, expires: 0 };
  revisionGeneration++;
}

export async function getQuestionRevision() {
  if (cachedRevision.expires > Date.now()) return cachedRevision.value;
  if (pendingRevision) return pendingRevision;
  const generation = revisionGeneration;
  const promise = (async () => {
    try {
      const doc = await readQuestionRevision();
      const revision = doc?.revision ?? 0;
      if (generation !== revisionGeneration) return getQuestionRevision();
      cachedRevision = { value: revision, expires: Date.now() + QUESTION_REVISION_TTL_MS };
      return revision;
    } catch {
      if (generation !== revisionGeneration) return getQuestionRevision();
      // A short retry window also bounds Mongo traffic during an outage.
      cachedRevision.expires = Date.now() + 1000;
      return cachedRevision.value;
    }
  })();
  pendingRevision = promise;
  try { return await promise; }
  finally { if (pendingRevision === promise) pendingRevision = undefined; }
}

export function invalidateQuestionCacheRevision() {
  revisionGeneration++;
  pendingRevision = undefined;
  cachedRevision = { value: cachedRevision.value, expires: 0 };
  questionsQueryCache.clear();
  questionCountsCache.clear();
  pageCache.clear();
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
