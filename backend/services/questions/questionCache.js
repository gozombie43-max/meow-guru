import { LRUCache } from "lru-cache";
import { readQuestionRevision } from '../../repositories/questionMetadataRepository.js';
import { createTieredCache, evictSharedLocalCaches, registerSharedLocalCache } from '../../infrastructure/tieredCache.js';
import {
  getActiveScopedInvalidation,
  onCacheInvalidation,
  onScopedCacheInvalidation,
  publishCacheInvalidation,
  normalizeInvalidationScope,
} from '../../infrastructure/cacheInvalidation.js';
import { observeCacheOperation } from '../../infrastructure/metrics.js';
import { redisDelete } from '../../config/redis.js';
import { createHash } from 'node:crypto';

export const CACHE_TTLS = Object.freeze({
  QUESTION_MS: 30 * 60 * 1000,
  TOPIC_METADATA_MS: 6 * 60 * 60 * 1000,
  EXAM_CONFIG_MS: 6 * 60 * 60 * 1000,
  PUBLIC_STATS_MS: 5 * 60 * 1000,
  SESSION_META_MS: 30 * 60 * 1000,
});

const MAX_CARDINALITY_LIST_ITEMS = 3;
const MAX_CACHEABLE_FILTER_LENGTH = 512;

let cachedRevision = { value: 0, expires: 0 };
let pendingRevision;
let revisionGeneration = 0;
export const QUESTION_REVISION_TTL_MS = 10_000;

function normalizeScopeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function scopeTagFor(input) {
  if (typeof input === 'string') {
    const cleaned = input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9:_-]+/g, '_')
      .slice(0, 64);
    return cleaned || 'all';
  }
  if (input && typeof input === 'object') {
    const parts = [
      input.subject ? `s_${normalizeScopeToken(input.subject)}` : '',
      input.topic ? `t_${normalizeScopeToken(input.topic)}` : '',
      input.exam && typeof input.exam === 'string' && !input.exam.includes(',') ? `e_${normalizeScopeToken(input.exam)}` : '',
    ].filter(Boolean);
    return parts.join(':') || 'all';
  }
  return 'all';
}

function digestKey(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function selectionCount(value) {
  if (Array.isArray(value)) return value.filter(item => String(item ?? '').trim()).length;
  if (typeof value !== 'string') return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(item => String(item ?? '').trim()).length;
    } catch {
      return MAX_CARDINALITY_LIST_ITEMS + 1;
    }
  }
  return trimmed.split(',').map(part => part.trim()).filter(Boolean).length;
}

/**
 * Guard shared Redis against cache flooding / poisoning from high-cardinality
 * multi-filter combinations, arbitrary search regexes, or oversized filter strings.
 */
export function isHighCardinalityFilter(query) {
  if (!query || typeof query !== 'object') return false;
  if (typeof query.search === 'string' && query.search.trim().length > 0) return true;
  for (const field of ['exam', 'concept', 'letter']) {
    if (query[field] !== undefined && selectionCount(query[field]) > MAX_CARDINALITY_LIST_ITEMS) {
      return true;
    }
  }
  try {
    if (JSON.stringify(query).length > MAX_CACHEABLE_FILTER_LENGTH) return true;
  } catch {
    return true;
  }
  return false;
}

const pageCache = createTieredCache({
  name: 'question-page',
  freshMs: 300_000,
  staleMs: 600_000,
  localMs: 10_000,
});

const questionItemCache = createTieredCache({
  name: 'question-item',
  freshMs: CACHE_TTLS.QUESTION_MS,
  staleMs: CACHE_TTLS.QUESTION_MS * 2,
  localMs: 10_000,
  localCache: new LRUCache({
    max: 2000,
    maxSize: 20 * 1024 * 1024,
    maxEntrySize: 512 * 1024,
    sizeCalculation: entry => entry.cacheBytes,
  }),
});

// Server-only namespace for grading answer keys; never serves stale entries.
const questionAnswerKeyCache = createTieredCache({
  name: 'question-key',
  freshMs: CACHE_TTLS.QUESTION_MS,
  staleMs: CACHE_TTLS.QUESTION_MS,
  localMs: 10_000,
  localCache: new LRUCache({
    max: 4000,
    maxSize: 10 * 1024 * 1024,
    maxEntrySize: 256 * 1024,
    sizeCalculation: entry => entry.cacheBytes,
  }),
});

const topicPoolCache = createTieredCache({
  name: 'topic-pool',
  freshMs: CACHE_TTLS.QUESTION_MS,
  staleMs: CACHE_TTLS.QUESTION_MS * 2,
  localMs: 10_000,
});

const topicMetadataCache = createTieredCache({
  name: 'topic-metadata',
  freshMs: CACHE_TTLS.TOPIC_METADATA_MS,
  staleMs: CACHE_TTLS.TOPIC_METADATA_MS * 2,
  localMs: 30_000,
});

const examConfigCache = createTieredCache({
  name: 'exam-config',
  freshMs: CACHE_TTLS.EXAM_CONFIG_MS,
  staleMs: CACHE_TTLS.EXAM_CONFIG_MS * 2,
  localMs: 60_000,
});

const publicStatsCache = createTieredCache({
  name: 'public-stats',
  freshMs: CACHE_TTLS.PUBLIC_STATS_MS,
  staleMs: CACHE_TTLS.PUBLIC_STATS_MS * 2,
  localMs: 10_000,
});

const quizSessionCache = createTieredCache({
  name: 'quiz-session',
  freshMs: CACHE_TTLS.SESSION_META_MS,
  staleMs: CACHE_TTLS.SESSION_META_MS,
  localMs: 5_000,
  distributedLock: false,
  isEmpty: value => value == null,
  localCache: new LRUCache({
    max: 2000,
    maxSize: 20 * 1024 * 1024,
    maxEntrySize: 512 * 1024,
    sizeCalculation: entry => entry.cacheBytes,
  }),
});

export async function cachedQuestionPage(scope, params, build) {
  const highCardinality = isHighCardinalityFilter(params);
  if (highCardinality) {
    observeCacheOperation({ cache: 'question-page', layer: 'redis', outcome: 'bypass' });
  }
  const key = await revisionedQuestionCacheKey(`${scope}:${JSON.stringify(params)}`);
  const tag = scopeTagFor(params);
  return pageCache.read(`meow:v1:question-page:${tag}:${digestKey(key)}`, build, {
    allowStale: false,
    cacheShared: !highCardinality,
  });
}

export async function cachedQuestionById(identityKey, loader) {
  const cleanId = String(identityKey ?? '').trim();
  if (!cleanId) return loader();
  const revision = await getQuestionRevision();
  return questionItemCache.read(`meow:v1:question:r${revision}:${cleanId}`, loader, { allowStale: true });
}

export async function cachedQuestionAnswerKey(questionUid, loader) {
  const cleanUid = String(questionUid ?? '').trim();
  if (!cleanUid) return loader();
  const revision = await getQuestionRevision();
  return questionAnswerKeyCache.read(`meow:v1:question-key:r${revision}:${cleanUid}`, loader, { allowStale: false });
}

export async function cachedTopicPool(poolKey, loader) {
  const rawKey = typeof poolKey === 'string' ? poolKey : JSON.stringify(poolKey);
  const revision = await getQuestionRevision();
  const tag = scopeTagFor(poolKey);
  return topicPoolCache.read(`meow:v1:topic-pool:r${revision}:${tag}:${digestKey(rawKey)}`, loader, { allowStale: true });
}

export async function cachedTopicMetadata(topicKey, loader) {
  const rawKey = typeof topicKey === 'string' ? topicKey : JSON.stringify(topicKey);
  const revision = await getQuestionRevision();
  const tag = scopeTagFor(topicKey);
  return topicMetadataCache.read(`meow:v1:topic-meta:r${revision}:${tag}:${digestKey(rawKey)}`, loader, { allowStale: true });
}

export async function cachedExamConfig(examKey, loader) {
  const rawKey = typeof examKey === 'string' ? examKey : JSON.stringify(examKey);
  const revision = await getQuestionRevision();
  const tag = scopeTagFor(examKey);
  return examConfigCache.read(`meow:v1:exam-config:r${revision}:${tag}:${digestKey(rawKey)}`, loader, { allowStale: true });
}

export async function cachedPublicStats(statsKey, loader) {
  const rawKey = typeof statsKey === 'string' ? statsKey : JSON.stringify(statsKey);
  const revision = await getQuestionRevision();
  const tag = scopeTagFor(statsKey);
  return publicStatsCache.read(`meow:v1:public-stats:r${revision}:${tag}:${digestKey(rawKey)}`, loader, { allowStale: true });
}

export async function cachedQuizSession(sessionId, loader) {
  const cleanId = String(sessionId ?? '').trim();
  if (!cleanId) return loader();
  return quizSessionCache.read(`meow:v1:quiz-session:${cleanId}`, loader, { allowStale: false });
}

export async function invalidateQuizSessionCache(sessionId) {
  const cleanId = String(sessionId ?? '').trim();
  if (!cleanId) return;
  const logicalKey = `meow:v1:quiz-session:${cleanId}`;
  quizSessionCache.delete(logicalKey);
  await redisDelete(`tiered:v2:${logicalKey}`);
  await publishCacheInvalidation('quiz-session.changed', { sessionId: cleanId });
}

onScopedCacheInvalidation('quiz-session.changed', scope => {
  if (scope?.sessionId) {
    quizSessionCache.delete(`meow:v1:quiz-session:${scope.sessionId}`);
  }
});

onCacheInvalidation((type, scope) => {
  if (type === 'quiz-session.changed' && !scope) {
    quizSessionCache.clear();
  }
});

export function isNormalizedQuestionKeysEnabled() {
  return process.env.QUESTIONS_NORMALIZED_KEYS === 'true';
}

// Opt-in normalized-by-default check for modernized delivery paths (Phase 3/4+).
export function isNormalizedKeysEnabled() {
  return process.env.QUESTIONS_NORMALIZED_KEYS !== 'false';
}

export function clearQuestionRevisionCache() {
  cachedRevision = { value: 0, expires: 0 };
  pendingRevision = undefined;
  revisionGeneration++;
}
// Exported module ownership keeps this registration alive; the registry uses
// WeakRef so an otherwise unreferenced wrapper could disappear after GC.
export const questionRevisionCache = { clear: clearQuestionRevisionCache };
registerSharedLocalCache(questionRevisionCache);

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

const revisionListeners = new Set();
export function registerQuestionCacheClearer(fn) {
  if (typeof fn === 'function') revisionListeners.add(fn);
}

function matchesScopedCacheKey(logicalKey, scope) {
  const lower = String(logicalKey || '').toLowerCase();
  const sMatch = /(?:^|:)s_([a-z0-9]+)(?::|$)/.exec(lower);
  const tMatch = /(?:^|:)t_([a-z0-9]+)(?::|$)/.exec(lower);
  const eMatch = /(?:^|:)e_([a-z0-9]+)(?::|$)/.exec(lower);
  const hasAllTag = /(?:^|:)all(?::|$)/.test(lower);
  const scopeSubject = scope.subject ? normalizeScopeToken(scope.subject) : null;
  const scopeTopic = scope.topic ? normalizeScopeToken(scope.topic) : null;
  const scopeExam = scope.exam ? normalizeScopeToken(scope.exam) : null;

  if (hasAllTag) return true;

  if (sMatch || tMatch || eMatch) {
    // Set-intersection model: keep an entry warm only when a shared dimension provably disagrees.
    if (scopeSubject && sMatch && sMatch[1] !== scopeSubject) return false;
    if (scopeTopic && tMatch && tMatch[1] !== scopeTopic) return false;
    if (scopeExam && eMatch && eMatch[1] !== scopeExam) return false;
    return true;
  }

  // Fallback for unstructured string keys (e.g. cachedExamConfig('ssc-cgl'), cachedTopicMetadata('algebra')).
  const compact = normalizeScopeToken(logicalKey);
  const tokens = [scope.subject, scope.topic, scope.exam]
    .filter(Boolean)
    .map(value => ({ raw: value.toLowerCase(), compact: normalizeScopeToken(value) }));
  return tokens.some(token => lower.includes(token.raw) || (token.compact && compact.includes(token.compact)));
}

function matchesLegacyQueryKey(key, scope) {
  const str = String(key || '');
  const lower = str.toLowerCase();
  const hasTopic = lower.includes('"topic"');
  const hasSubject = lower.includes('"subject"');
  const hasExam = lower.includes('"exam"');
  if (!hasTopic && !hasSubject && !hasExam) return true;
  if (scope.topic && !hasTopic && (!scope.subject || !hasSubject)) return true;
  if (scope.subject && !hasSubject && !hasTopic) return true;
  return matchesScopedCacheKey(str, scope);
}

function evictExternalQuestionCaches(scope) {
  const scopeSubjectCompact = scope.subject ? normalizeScopeToken(scope.subject) : null;
  evictSharedLocalCaches(logicalKey => {
    const key = String(logicalKey || '');
    if (
      key.startsWith('question-meta:') ||
      key.startsWith('question-counts:') ||
      key.startsWith('training-catalog:') ||
      key.startsWith('training-pool:')
    ) {
      return true;
    }
    if (key.startsWith('topic-counts:') || key.startsWith('public-catalog:')) {
      if (!scopeSubjectCompact) return true;
      return normalizeScopeToken(key).includes(scopeSubjectCompact);
    }
    return false;
  });
}

function evictLocalQuestionCaches(rawScope) {
  const scope = normalizeInvalidationScope(rawScope);
  revisionGeneration++;
  pendingRevision = undefined;
  cachedRevision = { value: cachedRevision.value, expires: 0 };

  if (!scope) {
    questionsQueryCache.clear();
    questionCountsCache.clear();
    pageCache.clear();
    questionItemCache.clear();
    questionAnswerKeyCache.clear();
    topicPoolCache.clear();
    topicMetadataCache.clear();
    examConfigCache.clear();
    publicStatsCache.clear();
    for (const clear of revisionListeners) {
      try { clear(); } catch { /* noop */ }
    }
    return;
  }

  const uidSet = new Set(scope.questionUids || []);
  if (uidSet.size > 0) {
    const uidMatchers = [...uidSet].map(uid => ({
      suffix: `:${uid}`,
      quoted: JSON.stringify(uid),
    }));
    const matchUid = logicalKey => {
      const str = String(logicalKey || '');
      return uidMatchers.some(({ suffix, quoted }) => str.endsWith(suffix) || str.includes(quoted));
    };
    questionItemCache.deleteWhere(matchUid);
    questionAnswerKeyCache.deleteWhere(matchUid);
  }

  // Global/aggregate counts and public stats can depend on any mutated question.
  publicStatsCache.clear();
  questionCountsCache.clear();

  const hasDimensionScope = Boolean(scope.subject || scope.topic || scope.exam);
  if (hasDimensionScope) {
    const matchScope = logicalKey => matchesScopedCacheKey(logicalKey, scope);
    pageCache.deleteWhere(matchScope);
    topicPoolCache.deleteWhere(matchScope);
    topicMetadataCache.deleteWhere(matchScope);
    examConfigCache.deleteWhere(matchScope);
    for (const key of [...questionsQueryCache.keys()]) {
      if (matchesLegacyQueryKey(key, scope)) questionsQueryCache.delete(key);
    }
  } else if (uidSet.size > 0) {
    // Question body/answer edited without topic/subject context: evict page/pool/metadata caches safely.
    pageCache.clear();
    topicPoolCache.clear();
    topicMetadataCache.clear();
    questionsQueryCache.clear();
  }

  // Also evict external opaque/subject-scoped tiered caches (metadata, counts, training pools, snapshots)
  // without wiping unrelated meow:v1:* L1 entries.
  evictExternalQuestionCaches(scope);

  for (const clear of revisionListeners) {
    try { clear(scope); } catch { /* noop */ }
  }
}

onScopedCacheInvalidation('question.changed', evictLocalQuestionCaches);

export function invalidateQuestionCacheRevision() {
  // When triggered re-entrantly by unscoped onCacheInvalidation listeners (e.g.
  // questionMetadataCache.js) during a scoped question.changed event, scoped
  // eviction has already run; avoid wiping unrelated warm L1 caches.
  if (getActiveScopedInvalidation()?.type === 'question.changed') return;
  evictLocalQuestionCaches(null);
}

export async function invalidateQuestionCaches(scope = {}) {
  const { bumpRevision = true, ...rawScope } = scope || {};
  const normalizedScope = normalizeInvalidationScope(rawScope);
  if (bumpRevision) {
    try {
      const repo = await import('../../repositories/questionMetadataRepository.js');
      if (typeof repo.advanceQuestionRevision === 'function') {
        await repo.advanceQuestionRevision();
      }
    } catch (error) {
      // Allow pure unit tests without an initialized Mongo connection to continue.
      if (!/MongoDB has not been initialized/i.test(error?.message || '')) throw error;
    }
  }
  await publishCacheInvalidation('question.changed', normalizedScope || undefined);
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
