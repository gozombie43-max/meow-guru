import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { quizCorrectIndex } from '@meow/contracts/questions';
import { normalizeCreateQuizSessionInput } from '../../../contracts/quiz-session.js';
import { getQuestionsCollection } from '../../config/mongodb.js';
import {
  cachedPracticeCount,
  cachedQuestionAnswerKey,
  cachedQuestionAnswerKeysBatch,
  cachedQuestionsByIds,
  cachedQuizSession,
  cachedTopicPool,
  getQuestionRevision,
  invalidateQuizSessionCache,
  isNormalizedKeysEnabled,
  peekFreshQuizSession,
} from './questionCache.js';
import {
  normalizeFilterKey,
  normalizeSearchKey,
} from './questionNormalizer.js';
import { questionExamModeCondition } from './questionExamMode.js';
import {
  buildGeneralAwarenessChapterCondition,
  buildGeneralAwarenessTopicCondition,
  resolveGeneralAwarenessTopicGroupSlug,
} from './generalAwarenessTopics.js';
import {
  buildExcludeStudyModeCondition,
  caseInsensitiveExact,
  combineMongoConditions,
} from './questionQueryBuilder.js';
import { canonicalQuestionUid, persistedQuestionUid } from './questionIdentity.js';
import { quizQuestionProjection, toQuizQuestionDTO } from './quizQuestionDTO.js';
import { observeQuestionDelivery } from '../../infrastructure/metrics.js';
import {
  commitQuizSessionAnswerAtomic,
  commitQuizSessionSubmitAtomic,
  findOwnedQuizSession,
  findQuizSessionById,
  insertQuizSession,
  updateQuizSessionDelivery,
} from '../../repositories/quizSessionRepository.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const TOPIC_POOL_MAX_SIZE = 2000;
const DEFAULT_SPEED_QUESTIONS = 30;
const DEFAULT_SPEED_TIME_LIMIT_SEC = 600;
const DEFAULT_MOCK_QUESTIONS = 50;
const DEFAULT_MOCK_TIME_LIMIT_SEC = 3600;
const DEFAULT_AI_QUESTIONS = 20;
const EXAM_STYLE_MODES = new Set(['mock', 'speed']);

const ANSWER_KEY_PROJECTION = Object.freeze({
  _id: 1,
  id: 1,
  questionUid: 1,
  topic: 1,
  subject: 1,
  chapter: 1,
  concept: 1,
  difficulty: 1,
  question: 1,
  options: 1,
  questionType: 1,
  optionRegions: 1,
  correctAnswer: 1,
  correctLetter: 1,
  solution: 1,
  solutionImage: 1,
  solutionImageWidth: 1,
  solutionImageHeight: 1,
  translations: 1,
});

function fail(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
}

const EPHEMERAL_DEV_CURSOR_SECRET = randomBytes(32).toString('hex');

export function getCursorSecret() {
  const configured = (process.env.QUIZ_CURSOR_SECRET || process.env.JWT_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw fail('QUIZ_CURSOR_SECRET or JWT_SECRET must be configured in production', 500, 'CURSOR_SECRET_MISSING');
  }
  return EPHEMERAL_DEV_CURSOR_SECRET;
}

function signSessionCursor(sessionId, payload) {
  const encoded = Buffer.from(JSON.stringify({ v: 1, ...payload })).toString('base64url');
  const sig = createHmac('sha256', getCursorSecret())
    .update(`${sessionId}:${encoded}`)
    .digest('hex')
    .slice(0, 24);
  return `${encoded}.${sig}`;
}

function verifySessionCursor(sessionId, token) {
  if (typeof token !== 'string' || token.length > 2048) {
    throw fail('Invalid session cursor', 400, 'INVALID_CURSOR');
  }
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === token.length - 1) {
    throw fail('Invalid session cursor', 400, 'INVALID_CURSOR');
  }
  const encoded = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const expectedSig = createHmac('sha256', getCursorSecret())
    .update(`${sessionId}:${encoded}`)
    .digest('hex')
    .slice(0, 24);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw fail('Invalid session cursor', 400, 'INVALID_CURSOR');
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed || parsed.v !== 1) throw new Error('Bad version');
    return parsed;
  } catch {
    throw fail('Invalid session cursor', 400, 'INVALID_CURSOR');
  }
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function hmacRank(seed, uid) {
  return createHmac('sha256', String(seed)).update(String(uid)).digest('hex').slice(0, 16);
}

function permuteUidsDeterministically(uids, seed, randomize = true) {
  const unique = [...new Set(uids.filter(Boolean))];
  if (!randomize) return unique;
  return unique
    .map((uid) => ({ uid, rank: hmacRank(seed, uid) }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.uid.localeCompare(b.uid)))
    .map((entry) => entry.uid);
}

function extractLegacyDocIds(docs) {
  const map = {};
  if (!Array.isArray(docs)) return map;
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object' || !doc._id) continue;
    if (persistedQuestionUid(doc)) continue;
    const uid = canonicalQuestionUid(doc);
    const docId = String(doc._id);
    if (/^[a-zA-Z0-9_-]+$/.test(uid) && /^[a-fA-F0-9]{24}$/.test(docId)) {
      map[uid] = docId;
    }
  }
  return map;
}

function pickLegacyDocIds(sourceMap, uids) {
  const picked = {};
  if (!sourceMap || typeof sourceMap !== 'object' || !uids) return picked;
  for (const uid of uids) {
    if (Object.hasOwn(sourceMap, uid)) {
      const docId = sourceMap[uid];
      if (typeof docId === 'string' && /^[a-fA-F0-9]{24}$/.test(docId)) {
        picked[uid] = docId;
      }
    }
  }
  return picked;
}

async function loadLegacyDocsByIdMap(collection, unresolvedUids, legacyDocIdMap, projection) {
  const resolved = new Map();
  if (!legacyDocIdMap || typeof legacyDocIdMap !== 'object' || !unresolvedUids.length) {
    return resolved;
  }

  const uidByDocId = new Map();
  const objectIds = [];
  for (const uid of unresolvedUids) {
    const docId = Object.hasOwn(legacyDocIdMap, uid) ? legacyDocIdMap[uid] : null;
    if (typeof docId !== 'string' || !/^[a-fA-F0-9]{24}$/.test(docId) || uidByDocId.has(docId)) {
      continue;
    }
    uidByDocId.set(docId, uid);
    objectIds.push(new ObjectId(docId));
  }

  if (objectIds.length === 0) return resolved;

  let query = collection.find({ _id: { $in: objectIds } }).project(projection);
  if (typeof query.maxTimeMS === 'function') query = query.maxTimeMS(5000);
  const docs = await query.toArray();

  for (const doc of docs) {
    const expectedUid = uidByDocId.get(String(doc._id));
    if (!expectedUid) continue;
    // Strict canonical identity check: only accept when the document's canonical UID matches exactly.
    if (canonicalQuestionUid(doc) !== expectedUid) continue;
    resolved.set(expectedUid, doc);
  }
  return resolved;
}

function toSafeV1QuestionDTO(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const dto = toQuizQuestionDTO(doc);
  dto.questionUid = canonicalQuestionUid(doc);
  dto.question = typeof dto.question === 'string' ? dto.question : '';
  dto.options = Array.isArray(dto.options) ? dto.options.map(String) : [];
  return dto;
}

function isUnnormalizedFallbackAllowed() {
  return process.env.QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK === 'true';
}

export function buildFilterConditions(
  filters = {},
  {
    useNormalizedKeys = isNormalizedKeysEnabled(),
    allowUnnormalizedFallback = isUnnormalizedFallbackAllowed(),
    mode = 'practice',
  } = {},
) {
  const conditions = [];
  const exactNormalized = useNormalizedKeys && !allowUnnormalizedFallback;

  if (filters.examMode) {
    conditions.push(questionExamModeCondition(filters.examMode, { useNormalizedKeys: exactNormalized }));
  }

  const gaGroupSlug = filters.topic ? resolveGeneralAwarenessTopicGroupSlug(filters.topic) : null;
  const isGaQuery = Boolean(gaGroupSlug) || normalizeSearchKey(filters.subject) === 'generalawareness';

  if (filters.topic) {
    const gaTopicCondition = gaGroupSlug
      ? buildGeneralAwarenessTopicCondition(gaGroupSlug, useNormalizedKeys, exactNormalized ? { exactKeys: true } : {})
      : null;
    if (gaTopicCondition) {
      conditions.push(gaTopicCondition);
    } else {
      const normalizedTopic = normalizeSearchKey(filters.topic);
      const isSynAnt = normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq';
      if (exactNormalized) {
        conditions.push({
          topicKey: isSynAnt ? { $in: ['synonymsantonyms', 'antosynopyq'] } : normalizedTopic,
        });
      } else if (useNormalizedKeys) {
        conditions.push({
          $or: [
            { topicKey: isSynAnt ? { $in: ['synonymsantonyms', 'antosynopyq'] } : normalizedTopic },
            {
              topicKey: { $exists: false },
              topic: isSynAnt ? { $in: [filters.topic, 'synonyms-antonyms', 'antosynopyq'] } : caseInsensitiveExact(filters.topic),
            },
          ],
        });
      } else {
        conditions.push({
          topic: isSynAnt ? { $in: [filters.topic, 'synonyms-antonyms', 'antosynopyq'] } : caseInsensitiveExact(filters.topic),
        });
      }
    }
  }

  if (filters.subject && (!filters.topic || normalizeSearchKey(filters.subject) === 'iitjamphysics')) {
    const subKey = normalizeSearchKey(filters.subject);
    conditions.push(
      exactNormalized
        ? { subjectKey: subKey }
        : useNormalizedKeys
          ? {
              $or: [
                { subjectKey: subKey },
                { subjectKey: { $exists: false }, subject: caseInsensitiveExact(filters.subject) },
              ],
            }
          : { subject: caseInsensitiveExact(filters.subject) },
    );
  }

  if (filters.chapter) {
    const gaChapter = isGaQuery
      ? buildGeneralAwarenessChapterCondition(filters.chapter, useNormalizedKeys, exactNormalized ? { exactKeys: true } : {})
      : null;
    if (gaChapter) {
      conditions.push(gaChapter);
    } else {
      const chapterKey = normalizeFilterKey(filters.chapter);
      conditions.push(
        exactNormalized
          ? { chapterKey }
          : useNormalizedKeys
            ? {
                $or: [
                  { chapterKey },
                  { chapterKey: { $exists: false }, chapter: caseInsensitiveExact(filters.chapter) },
                ],
              }
            : { chapter: caseInsensitiveExact(filters.chapter) },
      );
    }
  }

  if (filters.exam) {
    const examKey = normalizeFilterKey(filters.exam);
    conditions.push(
      exactNormalized
        ? { examKey }
        : useNormalizedKeys
          ? {
              $or: [
                { examKey },
                { examKey: { $exists: false }, exam: caseInsensitiveExact(filters.exam) },
              ],
            }
          : { exam: caseInsensitiveExact(filters.exam) },
    );
  }

  if (filters.tier) {
    conditions.push({ tier: caseInsensitiveExact(filters.tier) });
  }

  if (filters.concept) {
    const conceptKey = normalizeFilterKey(filters.concept);
    conditions.push(
      exactNormalized
        ? { conceptKey }
        : useNormalizedKeys
          ? {
              $or: [
                { conceptKey },
                { conceptKey: { $exists: false }, concept: caseInsensitiveExact(filters.concept) },
              ],
            }
          : { concept: caseInsensitiveExact(filters.concept) },
    );
  }

  if (filters.letter) {
    const letters = String(filters.letter)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (letters.length > 0) {
      conditions.push(
        useNormalizedKeys
          ? { letter: { $in: letters.map((l) => l.toUpperCase()) } }
          : { letter: { $in: letters.map((l) => caseInsensitiveExact(l)) } },
      );
    }
  }

  if (filters.difficulty && filters.difficulty !== 'mixed' && filters.difficulty !== 'all') {
    const diffLower = String(filters.difficulty).trim().toLowerCase();
    conditions.push(
      exactNormalized
        ? { difficulty: diffLower }
        : useNormalizedKeys
          ? {
              $or: [
                { difficulty: diffLower },
                { difficulty: caseInsensitiveExact(filters.difficulty) },
              ],
            }
          : { difficulty: caseInsensitiveExact(filters.difficulty) },
    );
  }

  // Always exclude study-mode flashcard docs from quiz sessions.
  conditions.push(
    exactNormalized
      ? { modeKey: { $ne: 'studyMode' } }
      : useNormalizedKeys
        ? {
            $or: [
              { modeKey: { $exists: true, $ne: 'studyMode' } },
              { modeKey: { $exists: false }, ...buildExcludeStudyModeCondition() },
            ],
          }
        : buildExcludeStudyModeCondition(),
  );

  // Keep `mode` referenced for callers passing mode-specific filtering extensions.
  void mode;

  return combineMongoConditions(conditions);
}

/**
 * Hydrate a batch of questionUids using L1/Redis per-question MGET cache (`cachedQuestionsByIds`),
 * fetching all cold misses in ONE single MongoDB `$in` query with strict `quizQuestionProjection`
 * (zero N+1 queries, zero answer-key over-fetching).
 */
async function hydrateQuestionBatch(uids, legacyDocIdMap = null) {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const collection = getQuestionsCollection();

  const cacheKeys = uids.map((uid) => `quiz-dto:${uid}`);
  const cachedMap = await cachedQuestionsByIds(cacheKeys, async (missingKeys) => {
    const toFetch = missingKeys.map((key) => key.slice('quiz-dto:'.length));
    const stringUids = toFetch.filter((uid) => typeof uid === 'string' && uid.length > 0);
    const map = new Map();
    if (stringUids.length === 0) return map;

    const query = collection
      .find({ questionUid: { $in: stringUids, $type: 'string' } })
      .project(quizQuestionProjection);
    if (typeof query.maxTimeMS === 'function') query.maxTimeMS(5000);
    const docs = await query.toArray();
    const fetchedByUid = new Map();
    for (const doc of docs) {
      const dto = toSafeV1QuestionDTO(doc);
      if (dto?.questionUid) fetchedByUid.set(dto.questionUid, dto);
    }

    if (legacyDocIdMap) {
      const unresolved = toFetch.filter((uid) => !fetchedByUid.has(uid) && Object.hasOwn(legacyDocIdMap, uid));
      if (unresolved.length > 0) {
        const legacyDocs = await loadLegacyDocsByIdMap(
          collection,
          unresolved,
          legacyDocIdMap,
          quizQuestionProjection,
        );
        for (const [uid, doc] of legacyDocs) {
          const dto = toSafeV1QuestionDTO(doc);
          if (dto?.questionUid === uid) fetchedByUid.set(uid, dto);
        }
      }
    }

    for (const uid of toFetch) {
      if (fetchedByUid.has(uid)) {
        map.set(`quiz-dto:${uid}`, fetchedByUid.get(uid));
      }
    }
    return map;
  });

  const missingLegacyUids = [];
  if (legacyDocIdMap) {
    for (const uid of uids) {
      if (!cachedMap.get(`quiz-dto:${uid}`) && Object.hasOwn(legacyDocIdMap, uid)) {
        missingLegacyUids.push(uid);
      }
    }
  }

  const legacyDtoByUid = new Map();
  if (missingLegacyUids.length > 0) {
    const legacyDocs = await loadLegacyDocsByIdMap(
      collection,
      missingLegacyUids,
      legacyDocIdMap,
      quizQuestionProjection,
    );
    for (const [uid, doc] of legacyDocs) {
      const dto = toSafeV1QuestionDTO(doc);
      if (dto?.questionUid === uid) legacyDtoByUid.set(uid, dto);
    }
  }

  return uids
    .map((uid) => cachedMap.get(`quiz-dto:${uid}`) || legacyDtoByUid.get(uid) || null)
    .filter(Boolean);
}

const RING_SCAN_PROJECTION = Object.freeze({
  ...quizQuestionProjection,
  selectionKey: 1,
});

async function fetchOrderedRingSlice(baseFilter, { pivot, count, cursorState = null }) {
  const collection = getQuestionsCollection();
  const limit = Math.max(1, count);
  const rows = [];
  let phase = cursorState?.phase || 'upper';
  const sortSpec = { selectionKey: 1, _id: 1 };

  const runRead = async (filter, maxRows, sort = sortSpec) => {
    let cursor = collection.find(filter).project(RING_SCAN_PROJECTION).sort(sort);
    if (typeof cursor.maxTimeMS === 'function') cursor = cursor.maxTimeMS(5000);
    return cursor.limit(maxRows).toArray();
  };

  let wrappedWithoutLowerInPage = false;

  if (phase === 'upper') {
    const upperCond = cursorState?.k && cursorState?.id
      ? {
          $or: [
            { selectionKey: { $gt: cursorState.k } },
            { selectionKey: cursorState.k, _id: { $gt: new ObjectId(cursorState.id) } },
          ],
        }
      : { selectionKey: { $gte: pivot } };
    const upperRows = await runRead(combineMongoConditions([baseFilter, upperCond]), limit + 1);
    const upperCount = upperRows.length;
    rows.push(...upperRows);
    if (rows.length <= limit) {
      // Upper arc exhausted — seamlessly wrap around into the lower arc (< pivot).
      phase = 'lower';
      const remaining = limit + 1 - rows.length;
      if (remaining > 0) {
        const lowerRows = await runRead(
          combineMongoConditions([baseFilter, { selectionKey: { $lt: pivot } }]),
          remaining,
        );
        rows.push(...lowerRows);
        if (upperCount === limit && lowerRows.length > 0) {
          // pageDocs contains only upperRows; next batch starts from the beginning of the lower arc.
          wrappedWithoutLowerInPage = true;
        }
      }
    }
  } else if (phase === 'lower') {
    const lowerCond = cursorState?.k && cursorState?.id
      ? {
          selectionKey: { $lt: pivot },
          $or: [
            { selectionKey: { $gt: cursorState.k } },
            { selectionKey: cursorState.k, _id: { $gt: new ObjectId(cursorState.id) } },
          ],
        }
      : { selectionKey: { $lt: pivot } };
    const lowerRows = await runRead(combineMongoConditions([baseFilter, lowerCond]), limit + 1);
    rows.push(...lowerRows);
  } else if (phase === 'id') {
    const idCond = cursorState?.id ? { _id: { $gt: new ObjectId(cursorState.id) } } : {};
    const idRows = await runRead(combineMongoConditions([baseFilter, idCond]), limit + 1, { _id: 1 });
    rows.push(...idRows);
  }

  // Fallback for legacy un-backfilled fixtures lacking `selectionKey` on initial call.
  if (!cursorState && rows.length === 0) {
    phase = 'id';
    const fallbackRows = await runRead(baseFilter, limit + 1, { _id: 1 });
    rows.push(...fallbackRows);
  }

  const hasMore = rows.length > limit;
  const pageDocs = rows.slice(0, limit);
  const lastDoc = pageDocs.at(-1) || null;
  const nextCursorState = hasMore && lastDoc
    ? wrappedWithoutLowerInPage
      ? { phase: 'lower' }
      : {
          phase,
          ...(phase !== 'id' && lastDoc.selectionKey ? { k: String(lastDoc.selectionKey) } : {}),
          id: String(lastDoc._id),
        }
    : null;

  return { pageDocs, hasMore, nextCursorState, phase };
}

async function sampleSelectionUids(baseFilter, { seed, maxCount, randomize = true }) {
  const collection = getQuestionsCollection();
  const pivot = createHmac('sha256', seed).update('sample-pivot:v1').digest('hex').slice(0, 16);
  const poolLimit = Math.min(TOPIC_POOL_MAX_SIZE, Math.max(maxCount * 2, maxCount));
  const projection = { _id: 1, questionUid: 1, id: 1, selectionKey: 1 };

  const readArc = async (extraFilter, limit, sort = { selectionKey: 1, _id: 1 }) => {
    let cursor = collection.find(combineMongoConditions([baseFilter, extraFilter])).project(projection).sort(sort);
    if (typeof cursor.maxTimeMS === 'function') cursor = cursor.maxTimeMS(5000);
    return cursor.limit(limit).toArray();
  };

  let docs = await readArc({ selectionKey: { $gte: pivot } }, poolLimit);
  if (docs.length < poolLimit) {
    const wrapDocs = await readArc({ selectionKey: { $lt: pivot } }, poolLimit - docs.length);
    docs = [...docs, ...wrapDocs];
  }
  if (docs.length === 0) {
    // Fallback for un-backfilled fixtures lacking `selectionKey`.
    docs = await readArc({}, poolLimit, { _id: 1 });
  }

  const uids = docs.map((doc) => canonicalQuestionUid(doc));
  const selectedUids = permuteUidsDeterministically(uids, seed, randomize).slice(0, maxCount);
  const legacyDocIds = pickLegacyDocIds(extractLegacyDocIds(docs), selectedUids);
  return { uids: selectedUids, legacyDocIds };
}

async function loadTopicPoolUids(filters, baseFilter) {
  const poolKey = {
    scope: 'topic-pool',
    subject: filters.subject || '',
    topic: filters.topic || '',
    chapter: filters.chapter || '',
    exam: filters.exam || '',
    concept: filters.concept || '',
    difficulty: filters.difficulty || '',
    examMode: filters.examMode || '',
    letter: filters.letter || '',
    tier: filters.tier || '',
  };

  return cachedTopicPool(poolKey, async () => {
    const collection = getQuestionsCollection();
    let cursor = collection
      .find(baseFilter)
      .project({ _id: 1, questionUid: 1, id: 1 })
      .sort({ _id: 1 });
    if (typeof cursor.maxTimeMS === 'function') cursor = cursor.maxTimeMS(5000);
    const docs = await cursor.limit(TOPIC_POOL_MAX_SIZE).toArray();
    const uids = [...new Set(docs.map((doc) => canonicalQuestionUid(doc)))];
    const legacyDocIds = extractLegacyDocIds(docs);
    const revision = await getQuestionRevision();
    return { revision, uids, legacyDocIds };
  });
}

function deduplicateBatch(dtos, alreadyDeliveredSet) {
  const unique = [];
  let duplicatesPrevented = 0;
  for (const dto of dtos) {
    if (!dto?.questionUid) continue;
    if (alreadyDeliveredSet.has(dto.questionUid)) {
      duplicatesPrevented++;
      continue;
    }
    alreadyDeliveredSet.add(dto.questionUid);
    unique.push(dto);
  }
  return { unique, duplicatesPrevented };
}

const MODE_TELEMETRY_SURFACE = Object.freeze({
  practice: 'session-batch',
  topic: 'topic-pool',
  speed: 'speed-preload',
  mock: 'mock-paper',
  ai: 'ai-batch',
});

function recordDeliveryTelemetry({ endpoint, mode, payload, batchSize, duplicatesPrevented }) {
  try {
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
    observeQuestionDelivery({
      endpoint,
      mode,
      payloadBytes,
      batchSize,
      duplicatesPrevented,
      surface: MODE_TELEMETRY_SURFACE[mode] || 'session-batch',
    });
  } catch {
    // Telemetry is best-effort and must never fail a delivery response.
  }
}

export async function createQuizSession(userId, rawBody) {
  const input = normalizeCreateQuizSessionInput(rawBody);
  const { mode, filters, batchSize, lang, randomize } = input;
  const sessionId = `qs_${randomUUID().replace(/-/g, '')}`;
  const seed = randomBytes(16).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  let effectiveTimeLimitSec = input.timeLimitSec;
  if (effectiveTimeLimitSec === undefined) {
    if (mode === 'speed') effectiveTimeLimitSec = DEFAULT_SPEED_TIME_LIMIT_SEC;
    else if (mode === 'mock') effectiveTimeLimitSec = DEFAULT_MOCK_TIME_LIMIT_SEC;
  }
  const deadlineAt =
    effectiveTimeLimitSec && effectiveTimeLimitSec > 0
      ? new Date(now.getTime() + effectiveTimeLimitSec * 1000)
      : null;

  const baseFilter = buildFilterConditions(filters, { mode });
  const collection = getQuestionsCollection();

  let orderedQuestionUids = null;
  let poolRevision = null;
  let selectionCursor = null;
  let totalCount = 0;
  let questions = [];
  let nextCursor = null;
  let hasMore = false;
  let cursorOffset = 0;
  let duplicatesPrevented = 0;
  let sessionLegacyDocIds = {};
  const deliveredSet = new Set();

  if (mode === 'practice') {
    const pivot = createHmac('sha256', seed).update('practice-pivot:v1').digest('hex').slice(0, 16);
    const maxQuestions = input.totalQuestions ?? null;
    const requestedBatch = maxQuestions !== null ? Math.min(batchSize, maxQuestions) : batchSize;

    const [slice, counted] = await Promise.all([
      fetchOrderedRingSlice(baseFilter, { pivot, count: requestedBatch, cursorState: null }),
      cachedPracticeCount(filters, () => collection.countDocuments(baseFilter, { maxTimeMS: 5000 })),
    ]);

    totalCount = maxQuestions !== null ? Math.min(counted, maxQuestions) : counted;
    const rawDtos = slice.pageDocs.map(toSafeV1QuestionDTO).filter(Boolean);
    const deduped = deduplicateBatch(rawDtos, deliveredSet);
    questions = deduped.unique;
    duplicatesPrevented = deduped.duplicatesPrevented;
    sessionLegacyDocIds = pickLegacyDocIds(extractLegacyDocIds(slice.pageDocs), deliveredSet);
    cursorOffset = questions.length;

    const underCap = maxQuestions === null || cursorOffset < maxQuestions;
    hasMore = slice.hasMore && underCap && Boolean(slice.nextCursorState);
    selectionCursor = hasMore ? { pivot, ...slice.nextCursorState } : null;
    nextCursor = hasMore
      ? signSessionCursor(sessionId, {
          mode: 'practice',
          b: 1,
          delivered: cursorOffset,
          ...slice.nextCursorState,
        })
      : null;
  } else if (mode === 'topic') {
    const pool = await loadTopicPoolUids(filters, baseFilter);
    poolRevision = pool.revision ?? 0;
    const permuted = permuteUidsDeterministically(pool.uids || [], seed, randomize);
    orderedQuestionUids = input.totalQuestions ? permuted.slice(0, input.totalQuestions) : permuted;
    sessionLegacyDocIds = pickLegacyDocIds(pool.legacyDocIds, orderedQuestionUids);
    totalCount = orderedQuestionUids.length;

    const firstSlice = orderedQuestionUids.slice(0, batchSize);
    const hydrated = await hydrateQuestionBatch(firstSlice, sessionLegacyDocIds);
    const deduped = deduplicateBatch(hydrated, deliveredSet);
    questions = deduped.unique;
    duplicatesPrevented = deduped.duplicatesPrevented;
    cursorOffset = firstSlice.length;
    hasMore = cursorOffset < orderedQuestionUids.length;
    nextCursor = hasMore
      ? signSessionCursor(sessionId, { mode: 'topic', offset: cursorOffset, b: 1 })
      : null;
  } else if (mode === 'speed' || mode === 'mock') {
    const targetCount =
      input.totalQuestions ?? (mode === 'speed' ? DEFAULT_SPEED_QUESTIONS : DEFAULT_MOCK_QUESTIONS);
    const sampled = await sampleSelectionUids(baseFilter, {
      seed,
      maxCount: targetCount,
      randomize,
    });
    orderedQuestionUids = sampled.uids;
    sessionLegacyDocIds = sampled.legacyDocIds;
    totalCount = orderedQuestionUids.length;

    const firstSlice = orderedQuestionUids.slice(0, batchSize);
    const hydrated = await hydrateQuestionBatch(firstSlice, sessionLegacyDocIds);
    const deduped = deduplicateBatch(hydrated, deliveredSet);
    questions = deduped.unique;
    duplicatesPrevented = deduped.duplicatesPrevented;
    cursorOffset = firstSlice.length;
    hasMore = cursorOffset < orderedQuestionUids.length;
    nextCursor = hasMore
      ? signSessionCursor(sessionId, { mode, offset: cursorOffset, b: 1 })
      : null;
  } else if (mode === 'ai') {
    const targetCount = input.totalQuestions ?? DEFAULT_AI_QUESTIONS;
    const aiFilter = combineMongoConditions([
      baseFilter,
      isNormalizedKeysEnabled()
        ? { modeKey: 'aiChallenge' }
        : { quizName: { $in: [/^ai\s*challenge$/i, /^selectionway$/i] } },
    ]);
    const aiSampled = await sampleSelectionUids(aiFilter, {
      seed,
      maxCount: targetCount,
      randomize,
    });
    const sampled = [...aiSampled.uids];
    const combinedLegacy = { ...aiSampled.legacyDocIds };
    if (sampled.length < targetCount) {
      const fallbackSampled = await sampleSelectionUids(baseFilter, {
        seed,
        maxCount: targetCount,
        randomize,
      });
      Object.assign(combinedLegacy, fallbackSampled.legacyDocIds);
      const existing = new Set(sampled);
      for (const uid of fallbackSampled.uids) {
        if (!existing.has(uid)) {
          sampled.push(uid);
          existing.add(uid);
        }
        if (sampled.length >= targetCount) break;
      }
    }
    orderedQuestionUids = sampled;
    sessionLegacyDocIds = pickLegacyDocIds(combinedLegacy, orderedQuestionUids);
    totalCount = orderedQuestionUids.length;

    const firstSlice = orderedQuestionUids.slice(0, batchSize);
    const hydrated = await hydrateQuestionBatch(firstSlice, sessionLegacyDocIds);
    const deduped = deduplicateBatch(hydrated, deliveredSet);
    questions = deduped.unique;
    duplicatesPrevented = deduped.duplicatesPrevented;
    cursorOffset = firstSlice.length;
    hasMore = cursorOffset < orderedQuestionUids.length;
    nextCursor = hasMore
      ? signSessionCursor(sessionId, { mode: 'ai', offset: cursorOffset, b: 1 })
      : null;
  }

  const sessionDoc = {
    sessionId,
    userId: String(userId),
    mode,
    status: 'in_progress',
    filters,
    lang,
    randomize,
    seed,
    batchSize,
    totalCount,
    ...(input.totalQuestions !== undefined ? { totalQuestionsCap: input.totalQuestions } : {}),
    ...(orderedQuestionUids !== null ? { orderedQuestionUids } : {}),
    ...(poolRevision !== null ? { poolRevision } : {}),
    ...(selectionCursor !== null ? { selectionCursor } : {}),
    ...(Object.keys(sessionLegacyDocIds).length > 0 ? { legacyQuestionDocIds: sessionLegacyDocIds } : {}),
    deliveredUids: [...deliveredSet],
    cursorOffset,
    lastCursor: nextCursor,
    hasMore,
    batchNumber: 1,
    answers: {},
    answeredCount: 0,
    revision: 0,
    deadlineAt,
    submittedAt: null,
    result: null,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  await insertQuizSession(sessionDoc);

  const response = {
    sessionId,
    mode,
    status: 'in_progress',
    batchSize,
    totalCount,
    answeredCount: 0,
    questions,
    nextCursor,
    hasMore,
    deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
    revision: 0,
  };

  recordDeliveryTelemetry({
    endpoint: '/api/v1/quiz/sessions',
    mode,
    payload: response,
    batchSize: questions.length,
    duplicatesPrevented,
  });

  return response;
}

export async function getQuizSessionState(sessionId, userId) {
  const doc = await cachedQuizSession(sessionId, () => findQuizSessionById(sessionId));
  if (!doc) throw fail('Quiz session not found', 404, 'SESSION_NOT_FOUND');
  if (String(doc.userId) !== String(userId)) {
    throw fail('You do not have access to this quiz session', 403, 'FORBIDDEN_SESSION');
  }
  const answers = doc.answers && typeof doc.answers === 'object' ? doc.answers : {};
  const answeredQuestionUids = Object.keys(answers);
  return {
    sessionId: doc.sessionId,
    mode: doc.mode,
    status: doc.status,
    batchSize: doc.batchSize,
    totalCount: doc.totalCount ?? 0,
    answeredCount: answeredQuestionUids.length,
    answeredQuestionUids,
    lastCursor: doc.lastCursor ?? null,
    deadlineAt: doc.deadlineAt ? new Date(doc.deadlineAt).toISOString() : null,
    revision: Number(doc.revision) || 0,
    hasMore: Boolean(doc.hasMore && doc.status === 'in_progress'),
  };
}

export async function getQuizSessionQuestionsBatch(sessionId, userId, query) {
  const sessionDoc = await findOwnedQuizSession(sessionId, userId);
  if (!sessionDoc) throw fail('Quiz session not found', 404, 'SESSION_NOT_FOUND');
  if (sessionDoc.status !== 'in_progress') {
    throw fail('Quiz session is already completed', 409, 'SESSION_NOT_ACTIVE');
  }
  if (sessionDoc.deadlineAt) {
    const deadlineMs = new Date(sessionDoc.deadlineAt).getTime();
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
      throw fail('Quiz session time has expired', 409, 'SESSION_EXPIRED');
    }
  }

  const requestedBatchSize = Math.max(
    1,
    Math.min(50, Number(query.batchSize ?? query.limit ?? sessionDoc.batchSize) || 20),
  );
  // Deduplicate strictly intra-batch so HTTP retries of the same cursor are idempotent and
  // never return empty arrays or prematurely terminate the session.
  const batchSeenSet = new Set();
  const hasQueryCursor = typeof query.cursor === 'string' && query.cursor.length > 0;
  if (!hasQueryCursor && (!sessionDoc.hasMore || !sessionDoc.lastCursor)) {
    return {
      sessionId,
      questions: [],
      nextCursor: null,
      hasMore: false,
      batchNumber: Number(sessionDoc.batchNumber) || 1,
      returnedCount: 0,
    };
  }
  const effectiveCursor = hasQueryCursor ? query.cursor : sessionDoc.lastCursor;
  const cursorPayload = verifySessionCursor(sessionId, effectiveCursor);

  if (cursorPayload.mode !== sessionDoc.mode) {
    throw fail('Invalid session cursor', 400, 'INVALID_CURSOR');
  }

  let questions = [];
  let nextCursor;
  let hasMore;
  const batchNumber = (Number(cursorPayload.b) || 1) + 1;
  let nextCursorOffset = Number(sessionDoc.cursorOffset) || 0;
  let nextSelectionCursor = sessionDoc.selectionCursor || null;
  let duplicatesPrevented = 0;
  let batchLegacyDocIds = null;

  if (sessionDoc.mode === 'practice') {
    const baseFilter = buildFilterConditions(sessionDoc.filters || {}, { mode: 'practice' });
    const pivot = createHmac('sha256', sessionDoc.seed).update('practice-pivot:v1').digest('hex').slice(0, 16);
    const cap = sessionDoc.totalQuestionsCap ?? null;
    const priorDeliveredCount = cursorPayload.delivered ?? (Number(sessionDoc.cursorOffset) || 0);
    const remainingBudget = cap !== null ? Math.max(0, cap - priorDeliveredCount) : requestedBatchSize;
    const effectiveBatchSize = cap !== null ? Math.min(requestedBatchSize, remainingBudget) : requestedBatchSize;

    if (effectiveBatchSize > 0) {
      const ringCursor = { phase: cursorPayload.phase, k: cursorPayload.k, id: cursorPayload.id };
      const slice = await fetchOrderedRingSlice(baseFilter, {
        pivot,
        count: effectiveBatchSize,
        cursorState: ringCursor,
      });
      const rawDtos = slice.pageDocs.map(toSafeV1QuestionDTO).filter(Boolean);
      const deduped = deduplicateBatch(rawDtos, batchSeenSet);
      questions = deduped.unique;
      duplicatesPrevented = deduped.duplicatesPrevented;
      batchLegacyDocIds = pickLegacyDocIds(
        extractLegacyDocIds(slice.pageDocs),
        questions.map((q) => q.questionUid),
      );
      nextCursorOffset = priorDeliveredCount + questions.length;

      const underCap = cap === null || nextCursorOffset < cap;
      hasMore = questions.length > 0 && slice.hasMore && underCap && Boolean(slice.nextCursorState);
      nextSelectionCursor = hasMore ? { pivot, ...slice.nextCursorState } : null;
      nextCursor = hasMore
        ? signSessionCursor(sessionId, {
            mode: 'practice',
            b: batchNumber,
            delivered: nextCursorOffset,
            ...slice.nextCursorState,
          })
        : null;
    } else {
      hasMore = false;
      nextCursor = null;
      nextSelectionCursor = null;
    }
  } else {
    // topic | speed | mock | ai -> immutable orderedQuestionUids[]
    const orderedUids = Array.isArray(sessionDoc.orderedQuestionUids) ? sessionDoc.orderedQuestionUids : [];
    const offset = Number(cursorPayload.offset);
    if (!Number.isInteger(offset) || offset < 0 || offset > orderedUids.length) {
      throw fail('Invalid session cursor', 400, 'INVALID_CURSOR');
    }
    const sliceUids = orderedUids.slice(offset, offset + requestedBatchSize);
    const hydrated = await hydrateQuestionBatch(sliceUids, sessionDoc.legacyQuestionDocIds || null);
    const deduped = deduplicateBatch(hydrated, batchSeenSet);
    questions = deduped.unique;
    duplicatesPrevented = deduped.duplicatesPrevented;
    nextCursorOffset = offset + sliceUids.length;
    hasMore = nextCursorOffset < orderedUids.length;
    nextCursor = hasMore
      ? signSessionCursor(sessionId, { mode: sessionDoc.mode, offset: nextCursorOffset, b: batchNumber })
      : null;
  }

  await updateQuizSessionDelivery(sessionId, userId, {
    newDeliveredUids: questions.map((q) => q.questionUid),
    newLegacyDocIds: batchLegacyDocIds,
    cursorOffset: nextCursorOffset,
    lastCursor: nextCursor,
    selectionCursor: nextSelectionCursor,
    batchNumber,
    hasMore,
  });
  await invalidateQuizSessionCache(sessionId);

  const response = {
    sessionId,
    questions,
    nextCursor,
    hasMore,
    batchNumber,
    returnedCount: questions.length,
  };

  recordDeliveryTelemetry({
    endpoint: '/api/v1/quiz/sessions/:id/questions',
    mode: sessionDoc.mode,
    payload: response,
    batchSize: questions.length,
    duplicatesPrevented,
  });

  return response;
}

function formatAnswerKeyDoc(doc) {
  if (!doc) return null;
  const imageKeys = Object.keys(doc.optionRegions || {});
  const options =
    Array.isArray(doc.options) && doc.options.length > 0
      ? doc.options.map(String)
      : doc.questionType === 'image_mcq'
        ? (imageKeys.length ? imageKeys : ['a', 'b', 'c', 'd']).sort().map((key) => key.toUpperCase())
        : [];
  const correctIndex = quizCorrectIndex(doc, options);
  return {
    questionUid: canonicalQuestionUid(doc),
    questionType: String(doc.questionType || 'MCQ').toUpperCase(),
    topic: doc.topic || doc.chapter || doc.subject || 'general',
    subject: doc.subject || 'general',
    concept: doc.concept || '',
    difficulty: doc.difficulty || 'medium',
    question: doc.question || '',
    options,
    correctIndex,
    correctIndices: Array.isArray(doc.correctAnswer)
      ? [...new Set(doc.correctAnswer.map((item) => resolveSingleAnswerIndex(item, options)).filter((idx) => idx !== null))].sort((a, b) => a - b)
      : null,
    correctAnswer: correctIndex !== null ? options[correctIndex] : (doc.correctAnswer ?? null),
    solution: doc.solution ?? '',
    solutionImage: doc.solutionImage ?? null,
    ...(doc.solutionImageWidth !== undefined ? { solutionImageWidth: doc.solutionImageWidth } : {}),
    ...(doc.solutionImageHeight !== undefined ? { solutionImageHeight: doc.solutionImageHeight } : {}),
    ...(doc.translations !== undefined ? { translations: doc.translations } : {}),
  };
}

async function loadServerAnswerKey(questionUid, { legacyDocId = null } = {}) {
  const uid = String(questionUid);
  const cached = await cachedQuestionAnswerKey(uid, async () => {
    const collection = getQuestionsCollection();
    const doc = await collection.findOne(
      { questionUid: { $eq: uid, $type: 'string' } },
      { projection: ANSWER_KEY_PROJECTION },
    );
    return formatAnswerKeyDoc(doc);
  });
  if (cached) return cached;

  // Session-verified legacy document lookup: only when the owned session recorded the
  // document's ObjectId at delivery time, AND strict canonical identity verification passes.
  if (typeof legacyDocId === 'string' && /^[a-fA-F0-9]{24}$/.test(legacyDocId)) {
    const collection = getQuestionsCollection();
    const doc = await collection.findOne(
      { _id: new ObjectId(legacyDocId) },
      { projection: ANSWER_KEY_PROJECTION },
    );
    if (doc && canonicalQuestionUid(doc) === uid) {
      return formatAnswerKeyDoc(doc);
    }
  }
  return null;
}

/**
 * Batch-load server-only answer keys for post-submit review: hits L1/Redis MGET via
 * `cachedQuestionAnswerKeysBatch` and loads all cold misses in ONE single MongoDB `$in` query.
 */
async function loadServerAnswerKeysBatch(uids, legacyDocIdMap = null) {
  if (!Array.isArray(uids) || uids.length === 0) return [];
  const collection = getQuestionsCollection();

  const cachedMap = await cachedQuestionAnswerKeysBatch(uids, async (toFetch) => {
    const map = new Map();
    if (toFetch.length === 0) return map;

    let query = collection
      .find({
        questionUid: {
          $in: toFetch,
          $type: 'string',
        },
      })
      .project(ANSWER_KEY_PROJECTION);
    if (typeof query.maxTimeMS === 'function') query = query.maxTimeMS(5000);
    const docs = await query.toArray();
    for (const doc of docs) {
      const formatted = formatAnswerKeyDoc(doc);
      if (formatted?.questionUid) map.set(formatted.questionUid, formatted);
    }
    return map;
  });

  const results = uids.map((uid) => cachedMap.get(uid) || null);

  if (legacyDocIdMap && typeof legacyDocIdMap === 'object') {
    const missingEntries = [];
    for (let i = 0; i < uids.length; i++) {
      if (!results[i] && Object.hasOwn(legacyDocIdMap, uids[i])) {
        missingEntries.push({ index: i, uid: uids[i] });
      }
    }
    if (missingEntries.length > 0) {
      const legacyDocs = await loadLegacyDocsByIdMap(
        collection,
        missingEntries.map((entry) => entry.uid),
        legacyDocIdMap,
        ANSWER_KEY_PROJECTION,
      );
      for (const { index, uid } of missingEntries) {
        const doc = legacyDocs.get(uid);
        if (doc) {
          results[index] = formatAnswerKeyDoc(doc);
        }
      }
    }
  }

  return results;
}

function resolveSingleAnswerIndex(rawAnswer, options, { strictBounds = false } = {}) {
  if (typeof rawAnswer === 'number' && Number.isInteger(rawAnswer)) {
    if (rawAnswer < 0 || rawAnswer >= options.length) {
      if (strictBounds) throw fail('Answer index is outside the question options', 400, 'ANSWER_OUT_OF_RANGE');
      return null;
    }
    return rawAnswer;
  }
  if (typeof rawAnswer === 'string') {
    const trimmed = rawAnswer.trim();
    const exact = options.findIndex((opt) => String(opt).trim() === trimmed);
    if (exact >= 0) return exact;
    if (/^[a-z]$/i.test(trimmed)) {
      const idx = trimmed.toLowerCase().charCodeAt(0) - 97;
      if (idx >= 0 && idx < options.length) return idx;
    }
    const parsedNum = Number(trimmed);
    if (Number.isInteger(parsedNum) && parsedNum >= 0 && parsedNum < options.length) {
      return parsedNum;
    }
  }
  return null;
}

function evaluateSubmittedAnswer(rawAnswer, keyDoc) {
  const isMsq = String(keyDoc.questionType || 'MCQ').toUpperCase() === 'MSQ';
  if (Array.isArray(rawAnswer)) {
    if (!isMsq) {
      throw fail('Multiple answers are only allowed for MSQ questions', 400, 'INVALID_ANSWER_TYPE');
    }
    const submitted = [...new Set(
      rawAnswer.map((item) => {
        const idx = resolveSingleAnswerIndex(item, keyDoc.options, { strictBounds: true });
        if (idx === null) throw fail('Invalid MSQ answer option', 400, 'INVALID_ANSWER_OPTION');
        return idx;
      }),
    )].sort((a, b) => a - b);
    const expected = Array.isArray(keyDoc.correctIndices) && keyDoc.correctIndices.length > 0
      ? keyDoc.correctIndices
      : keyDoc.correctIndex !== null
        ? [keyDoc.correctIndex]
        : [];
    const isCorrect =
      expected.length > 0 &&
      submitted.length === expected.length &&
      submitted.every((val, i) => val === expected[i]);
    return { resolvedIndex: submitted, isCorrect };
  }

  if (keyDoc.correctIndex === null) {
    throw fail('Question has no valid answer key', 422, 'INVALID_ANSWER_KEY');
  }
  const resolvedIndex = resolveSingleAnswerIndex(rawAnswer, keyDoc.options, { strictBounds: true });
  return {
    resolvedIndex,
    isCorrect: resolvedIndex !== null && resolvedIndex === keyDoc.correctIndex,
  };
}

function buildEvaluationPayload(keyDoc, isCorrect) {
  return {
    isCorrect,
    correct: keyDoc.correctIndex,
    correctIndex: keyDoc.correctIndex,
    correctAnswer: keyDoc.correctAnswer,
    solution: keyDoc.solution ?? '',
    solutionImage: keyDoc.solutionImage ?? null,
    ...(keyDoc.solutionImageWidth !== undefined ? { solutionImageWidth: keyDoc.solutionImageWidth } : {}),
    ...(keyDoc.solutionImageHeight !== undefined ? { solutionImageHeight: keyDoc.solutionImageHeight } : {}),
    ...(keyDoc.translations !== undefined ? { translations: keyDoc.translations } : {}),
  };
}

export async function submitQuizSessionAnswer(sessionId, userId, body, idempotencyKey) {
  const submissionId = body.submissionId || idempotencyKey;
  if (body.submissionId && body.submissionId !== idempotencyKey) {
    throw fail('Idempotency-Key must match submissionId', 400, 'IDEMPOTENCY_KEY_MISMATCH');
  }

  const now = new Date();
  // Verify session existence, ownership, active status, deadline, and membership BEFORE
  // loading any question answer key (prevents cross-user / bogus-session existence oracles).
  const cachedPrecheck = peekFreshQuizSession(sessionId);
  let precheckSession;
  if (cachedPrecheck) {
    if (String(cachedPrecheck.userId) !== String(userId)) {
      throw fail('You do not have access to this quiz session', 403, 'FORBIDDEN_SESSION');
    }
    precheckSession = cachedPrecheck;
  } else {
    precheckSession = await findOwnedQuizSession(sessionId, userId, {
      projection: { _id: 0, userId: 1, status: 1, deadlineAt: 1, orderedQuestionUids: 1, legacyQuestionDocIds: 1 },
    });
  }
  if (!precheckSession) throw fail('Quiz session not found', 404, 'SESSION_NOT_FOUND');
  if (precheckSession.status !== 'in_progress') {
    throw fail('Quiz session is already completed', 409, 'SESSION_NOT_ACTIVE');
  }
  if (precheckSession.deadlineAt) {
    const deadlineMs = new Date(precheckSession.deadlineAt).getTime();
    if (Number.isFinite(deadlineMs) && now.getTime() > deadlineMs) {
      throw fail('Quiz session time has expired', 409, 'SESSION_EXPIRED');
    }
  }
  if (
    Array.isArray(precheckSession.orderedQuestionUids) &&
    precheckSession.orderedQuestionUids.length > 0 &&
    !precheckSession.orderedQuestionUids.includes(body.questionUid)
  ) {
    throw fail('Question does not belong to this quiz session', 400, 'QUESTION_NOT_IN_SESSION');
  }

  const timeTakenMs =
    body.timeTakenMs !== undefined
      ? Math.round(body.timeTakenMs)
      : body.timeTakenSeconds !== undefined
        ? Math.round(body.timeTakenSeconds * 1000)
        : 0;

  const idempotencyId = sha256(`${userId}:v1.quiz.session.answer:${sessionId}:${idempotencyKey}`);
  const fingerprint = sha256(
    JSON.stringify(
      canonicalJson({
        sessionId,
        questionUid: body.questionUid,
        answer: body.answer,
        submissionId,
      }),
    ),
  );

  // Pre-load grading key via server-only Redis/L1 cache outside the write transaction.
  const legacyDocId = precheckSession.legacyQuestionDocIds && Object.hasOwn(precheckSession.legacyQuestionDocIds, body.questionUid)
    ? precheckSession.legacyQuestionDocIds[body.questionUid]
    : null;
  const keyDoc = await loadServerAnswerKey(body.questionUid, { legacyDocId });
  if (!keyDoc) throw fail('Question not found', 404, 'QUESTION_NOT_FOUND');

  const { resolvedIndex, isCorrect } = evaluateSubmittedAnswer(body.answer, keyDoc);

  const committed = await commitQuizSessionAnswerAtomic({
    sessionId,
    userId,
    idempotencyId,
    fingerprint,
    questionUid: keyDoc.questionUid,
    now,
    buildAnswerOutcome: ({ sessionDoc, existingEntry }) => {
      const isExamStyle = EXAM_STYLE_MODES.has(sessionDoc.mode);
      // Verify the question belongs to orderedQuestionUids when session has a fixed set.
      if (
        Array.isArray(sessionDoc.orderedQuestionUids) &&
        sessionDoc.orderedQuestionUids.length > 0 &&
        !sessionDoc.orderedQuestionUids.includes(keyDoc.questionUid)
      ) {
        throw fail('Question does not belong to this quiz session', 400, 'QUESTION_NOT_IN_SESSION');
      }

      // In immediate-reveal modes (practice/topic/ai), once a questionUid has been answered,
      // reject duplicate score inflation from different Idempotency-Keys by returning the locked result.
      if (existingEntry && !isExamStyle) {
        return {
          skipMutation: true,
          response: {
            sessionId,
            questionUid: keyDoc.questionUid,
            accepted: true,
            idempotent: true,
            revision: Number(sessionDoc.revision) || 0,
            answeredCount: Number(sessionDoc.answeredCount) || 0,
            evaluation: buildEvaluationPayload(keyDoc, Boolean(existingEntry.isCorrect)),
          },
        };
      }

      const answerEntry = {
        questionUid: keyDoc.questionUid,
        answer: body.answer,
        selectedIndex: resolvedIndex,
        isCorrect,
        correctIndex: keyDoc.correctIndex,
        topic: keyDoc.topic,
        subject: keyDoc.subject,
        concept: keyDoc.concept,
        difficulty: keyDoc.difficulty,
        timeTakenMs,
        submissionId,
        answeredAt: now.toISOString(),
      };

      const response = {
        sessionId,
        questionUid: keyDoc.questionUid,
        accepted: true,
        revision: (Number(sessionDoc.revision) || 0) + 1,
        answeredCount: 0,
        ...(!isExamStyle ? { evaluation: buildEvaluationPayload(keyDoc, isCorrect) } : {}),
      };

      return { skipMutation: false, answerEntry, response };
    },
  });

  if (!committed.replayed) {
    await invalidateQuizSessionCache(sessionId);
  }

  return committed;
}

function computeSessionSummary(sessionDoc) {
  const answersMap = sessionDoc.answers && typeof sessionDoc.answers === 'object' ? sessionDoc.answers : {};
  const entries = Object.values(answersMap);

  const orderedCount = Array.isArray(sessionDoc.orderedQuestionUids)
    ? sessionDoc.orderedQuestionUids.length
    : 0;
  const deliveredCount = Array.isArray(sessionDoc.deliveredUids) ? sessionDoc.deliveredUids.length : 0;
  const totalQuestions = Math.max(orderedCount || deliveredCount, entries.length);

  let correct = 0;
  let incorrect = 0;
  let totalTimeMs = 0;
  const topicBreakdown = {};

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const isCorrect = Boolean(entry.isCorrect);
    if (isCorrect) correct++;
    else incorrect++;
    totalTimeMs += Number(entry.timeTakenMs) || 0;

    const topic = String(entry.topic || 'general');
    if (!topicBreakdown[topic]) {
      topicBreakdown[topic] = { attempted: 0, correct: 0, incorrect: 0, accuracy: 0 };
    }
    topicBreakdown[topic].attempted++;
    if (isCorrect) topicBreakdown[topic].correct++;
    else topicBreakdown[topic].incorrect++;
  }

  for (const stats of Object.values(topicBreakdown)) {
    stats.accuracy =
      stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 10000) / 100 : 0;
  }

  const attempted = correct + incorrect;
  const skipped = Math.max(0, totalQuestions - attempted);
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 10000) / 100 : 0;
  const score =
    sessionDoc.mode === 'mock'
      ? Math.round((correct * 2 - incorrect * 0.5) * 100) / 100
      : correct;

  return {
    totalQuestions,
    attempted,
    correct,
    incorrect,
    skipped,
    accuracy,
    score,
    totalTimeMs,
    topicBreakdown,
  };
}

export async function submitQuizSession(sessionId, userId, { reason = 'manual' } = {}) {
  const { session, idempotent } = await commitQuizSessionSubmitAtomic({
    sessionId,
    userId,
    reason,
    computeResult: computeSessionSummary,
  });

  if (!idempotent) {
    await invalidateQuizSessionCache(sessionId);
  }

  return {
    sessionId: session.sessionId,
    status: 'completed',
    ...(idempotent ? { idempotent: true } : {}),
    result: session.result,
  };
}

export async function getQuizSessionResult(sessionId, userId) {
  const session = await findOwnedQuizSession(sessionId, userId);
  if (!session) throw fail('Quiz session not found', 404, 'SESSION_NOT_FOUND');
  if (session.status !== 'completed') {
    throw fail('Submit the quiz session before viewing results', 409, 'SESSION_NOT_COMPLETED');
  }

  const answersMap = session.answers && typeof session.answers === 'object' ? session.answers : {};
  const orderedUids = Array.isArray(session.orderedQuestionUids) && session.orderedQuestionUids.length > 0
    ? session.orderedQuestionUids
    : [
        ...(Array.isArray(session.deliveredUids) ? session.deliveredUids : []),
        ...Object.keys(answersMap),
      ];
  const uniqueUids = [...new Set(orderedUids.filter(Boolean))];

  // Hydrate server answer keys in one coalesced batch for post-completion review only.
  const keys = await loadServerAnswerKeysBatch(uniqueUids, session.legacyQuestionDocIds || null);
  const review = keys
    .filter(Boolean)
    .map((keyDoc) => {
      const answered = answersMap[keyDoc.questionUid] || null;
      return {
        questionUid: keyDoc.questionUid,
        question: keyDoc.question,
        options: keyDoc.options,
        topic: keyDoc.topic,
        subject: keyDoc.subject,
        concept: keyDoc.concept,
        difficulty: keyDoc.difficulty,
        selectedAnswer: answered ? answered.answer : null,
        selectedIndex: answered ? answered.selectedIndex : null,
        isCorrect: answered ? Boolean(answered.isCorrect) : false,
        attempted: Boolean(answered),
        correct: keyDoc.correctIndex,
        correctIndex: keyDoc.correctIndex,
        correctAnswer: keyDoc.correctAnswer,
        solution: keyDoc.solution ?? '',
        solutionImage: keyDoc.solutionImage ?? null,
        ...(keyDoc.solutionImageWidth !== undefined ? { solutionImageWidth: keyDoc.solutionImageWidth } : {}),
        ...(keyDoc.solutionImageHeight !== undefined ? { solutionImageHeight: keyDoc.solutionImageHeight } : {}),
        ...(keyDoc.translations !== undefined ? { translations: keyDoc.translations } : {}),
        timeTakenMs: answered ? Number(answered.timeTakenMs) || 0 : 0,
      };
    });

  return {
    sessionId: session.sessionId,
    mode: session.mode,
    status: 'completed',
    submittedAt: session.submittedAt ? new Date(session.submittedAt).toISOString() : null,
    result: session.result,
    review,
  };
}
