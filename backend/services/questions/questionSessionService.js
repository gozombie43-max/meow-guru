import { createHash } from 'node:crypto';
import { cachedQuestionPage, isNormalizedQuestionKeysEnabled, registerQuestionCacheClearer } from './questionCache.js';
import { canonicalQuestionQuery, parseSessionSelection } from './questionQueryIdentity.js';
import { getQuestionsCollection } from '../../config/mongodb.js';
import {
  normalizeFilterKey,
  normalizeSearchKey,
  parseShiftInt,
  parseYearInt,
} from './questionNormalizer.js';
import { quizQuestionProjection, toQuizQuestionDTO } from './quizQuestionDTO.js';
import { questionExamModeCondition } from './questionExamMode.js';
import {
  buildGeneralAwarenessChapterCondition,
  buildGeneralAwarenessTopicCondition,
  resolveGeneralAwarenessTopicGroupSlug,
} from './generalAwarenessTopics.js';
import { quizCorrectIndex } from '@meow/contracts/questions';
import { observeQuestionDelivery } from '../../infrastructure/metrics.js';
import {
  buildExcludeStudyModeCondition,
  buildModeFilter,
  caseInsensitiveExact,
  combineMongoConditions,
} from './questionQueryBuilder.js';

// Used strictly inside opt-in fetchQuestionsRevealWindow — NEVER in question delivery reads.
const revealInternalProjection = {
  ...quizQuestionProjection,
  correctAnswer: 1,
  correctLetter: 1,
  solution: 1,
  solutionImage: 1,
  solutionImageWidth: 1,
  solutionImageHeight: 1,
};

const MAX_SERVER_REVEAL_CACHE = 2000;
const serverRevealCache = new Map();
registerQuestionCacheClearer(() => serverRevealCache.clear());

const SESSION_FINGERPRINT_FIELDS = [
  'topic',
  'subject',
  'chapter',
  'mode',
  'letter',
  'exam',
  'concept',
  'year',
  'shift',
  'examDate',
  'date',
  'examMode',
];

function sessionQueryFingerprint(params) {
  return createHash('sha256')
    .update(JSON.stringify(SESSION_FINGERPRINT_FIELDS.map((key) => params[key] ?? '')))
    .digest('hex')
    .slice(0, 24);
}

function encodeSessionCursor(fingerprint, objectId) {
  return Buffer.from(
    JSON.stringify({ v: 1, f: fingerprint, _id: String(objectId) }),
  ).toString('base64url');
}

function decodeSessionCursor(cursor, expectedFingerprint) {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > 2048) {
    throw Object.assign(new Error('Invalid question cursor'), { statusCode: 400 });
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      !parsed ||
      parsed.v !== 1 ||
      parsed.f !== expectedFingerprint ||
      typeof parsed._id !== 'string' ||
      !/^[a-fA-F0-9]{24}$/.test(parsed._id)
    ) {
      throw new Error('Malformed cursor');
    }
    return parsed._id;
  } catch {
    throw Object.assign(new Error('Invalid question cursor'), { statusCode: 400 });
  }
}

function buildQuestionReveal(question) {
  if (!question || typeof question !== 'object') return null;
  const imageKeys = Object.keys(question.optionRegions || {});
  const options =
    Array.isArray(question.options) && question.options.length
      ? question.options.map(String)
      : question.questionType === 'image_mcq'
        ? (imageKeys.length ? imageKeys : ['a', 'b', 'c', 'd']).sort().map((key) => key.toUpperCase())
        : [];
  const correct = quizCorrectIndex(question, options);
  if (correct === null) return null;
  return {
    correct,
    ...(question.solution !== undefined ? { solution: question.solution } : {}),
    ...(question.solutionImage !== undefined ? { solutionImage: question.solutionImage } : {}),
    ...(question.solutionImageWidth !== undefined ? { solutionImageWidth: question.solutionImageWidth } : {}),
    ...(question.solutionImageHeight !== undefined ? { solutionImageHeight: question.solutionImageHeight } : {}),
    ...(question.translations !== undefined ? { translations: question.translations } : {}),
  };
}

function setBoundedReveal(key, reveal) {
  if (!key) return;
  if (serverRevealCache.has(key)) serverRevealCache.delete(key);
  serverRevealCache.set(key, reveal);
  if (serverRevealCache.size > MAX_SERVER_REVEAL_CACHE) {
    const oldest = serverRevealCache.keys().next().value;
    if (oldest !== undefined) serverRevealCache.delete(oldest);
  }
}

// Key strictly by canonical unique identities (_id / sessionAnchor / questionUid) — never ambiguous legacy `id`.
function cacheServerReveal(question) {
  const reveal = buildQuestionReveal(question);
  if (!reveal) return null;
  if (question._id) setBoundedReveal(`anchor:${String(question._id)}`, reveal);
  if (question.sessionAnchor) setBoundedReveal(`anchor:${String(question.sessionAnchor)}`, reveal);
  if (question.questionUid) setBoundedReveal(`uid:${String(question.questionUid)}`, reveal);
  return reveal;
}

function lookupCachedReveal(item) {
  if (!item || typeof item !== 'object') return undefined;
  return (
    (typeof item.sessionAnchor === 'string' && serverRevealCache.get(`anchor:${item.sessionAnchor}`)) ||
    (typeof item.questionUid === 'string' && serverRevealCache.get(`uid:${item.questionUid}`))
  );
}

function applyMaxTime(cursor, ms = 5000) {
  return typeof cursor?.maxTimeMS === 'function' ? cursor.maxTimeMS(ms) : cursor;
}

async function buildfetchQuestionsSession(params) {
  const collection = getQuestionsCollection();
  const {
    topic,
    subject,
    chapter,
    mode,
    limit = 50,
    cursor: cursorId,
    letter,
    exam,
    concept,
    year,
    shift,
    examDate,
    date,
    examMode,
  } = params;
  const useNormalizedKeys = isNormalizedQuestionKeysEnabled();
  const parsedLimit = Math.max(1, Math.min(200, Math.floor(Number(limit)) || 50));
  const fingerprint = sessionQueryFingerprint(params);

  const conditions = [];
  if (examMode) {
    conditions.push(questionExamModeCondition(examMode));
  }

  const gaGroupSlug = topic ? resolveGeneralAwarenessTopicGroupSlug(topic) : null;
  const isGaQuery = Boolean(gaGroupSlug) || normalizeSearchKey(subject) === 'generalawareness';

  if (topic) {
    const gaTopicCondition = gaGroupSlug ? buildGeneralAwarenessTopicCondition(gaGroupSlug, useNormalizedKeys) : null;
    if (gaTopicCondition) {
      conditions.push(gaTopicCondition);
    } else {
      const normalizedTopic = normalizeSearchKey(topic);
      const isSynonymAntonymTopic =
        normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq';
      if (isSynonymAntonymTopic) {
        conditions.push(
          useNormalizedKeys
            ? { topicKey: { $in: ['antosynopyq', 'synonymsantonyms'] } }
            : { topic: { $in: [topic, 'antosynopyq', 'synonyms-antonyms'] } },
        );
      } else {
        conditions.push(useNormalizedKeys ? { topicKey: normalizeSearchKey(topic) } : { topic });
      }
    }
  }

  if (subject && (!topic || normalizeSearchKey(subject) === 'iitjamphysics')) {
    conditions.push(
      useNormalizedKeys
        ? { subjectKey: normalizeSearchKey(subject) }
        : { subject: caseInsensitiveExact(subject) },
    );
  }

  if (chapter) {
    const gaChapterCondition = isGaQuery ? buildGeneralAwarenessChapterCondition(chapter, useNormalizedKeys) : null;
    if (gaChapterCondition) {
      conditions.push(gaChapterCondition);
    } else if (useNormalizedKeys) {
      conditions.push({
        $or: [
          { chapterKey: normalizeFilterKey(chapter) },
          { chapterKey: { $exists: false }, chapter: caseInsensitiveExact(chapter) },
        ],
      });
    } else {
      conditions.push({ chapter: caseInsensitiveExact(chapter) });
    }
  }

  if (letter) {
    const lettersArray = letter.split(',').map((l) => l.trim()).filter(Boolean);
    if (lettersArray.length > 0) {
      conditions.push(
        useNormalizedKeys
          ? { letter: { $in: lettersArray.map((l) => l.toUpperCase()) } }
          : { letter: { $in: lettersArray.map((l) => caseInsensitiveExact(l)) } },
      );
    }
  }

  // Use indexed exact-match examKey / conceptKey when normalized keys are enabled,
  // with an `$exists: false` fallback for un-backfilled fixtures.
  if (exam && exam !== 'all') {
    const examsArray = parseSessionSelection(exam);
    if (examsArray.length > 0) {
      conditions.push(
        useNormalizedKeys
          ? {
              $or: [
                { examKey: { $in: examsArray.map(normalizeFilterKey) } },
                { examKey: { $exists: false }, exam: { $in: examsArray.map((e) => caseInsensitiveExact(e)) } },
              ],
            }
          : { exam: { $in: examsArray.map((e) => caseInsensitiveExact(e)) } },
      );
    }
  }

  if (concept && concept !== 'all') {
    const conceptsArray = parseSessionSelection(concept);
    if (conceptsArray.length > 0) {
      conditions.push(
        useNormalizedKeys
          ? {
              $or: [
                { conceptKey: { $in: conceptsArray.map(normalizeFilterKey) } },
                { conceptKey: { $exists: false }, concept: { $in: conceptsArray.map((c) => caseInsensitiveExact(c)) } },
              ],
            }
          : { concept: { $in: conceptsArray.map((c) => caseInsensitiveExact(c)) } },
      );
    }
  }

  if (year !== undefined && year !== '') {
    const parsedYear = parseYearInt(year);
    if (parsedYear !== null) {
      conditions.push(
        useNormalizedKeys
          ? {
              $or: [
                { yearInt: parsedYear },
                { yearInt: { $exists: false }, year: { $in: [parsedYear, String(parsedYear)] } },
              ],
            }
          : { year: { $in: [parsedYear, String(parsedYear)] } },
      );
    }
  }

  if (shift !== undefined && shift !== '') {
    const rawShift = String(shift).trim();
    const parsedShift = parseShiftInt(rawShift);
    if (parsedShift !== null) {
      conditions.push(
        useNormalizedKeys
          ? {
              $or: [
                { shiftInt: parsedShift },
                { shiftInt: { $exists: false }, shift: { $in: [parsedShift, rawShift] } },
              ],
            }
          : { shift: { $in: [parsedShift, rawShift] } },
      );
    } else {
      conditions.push({ shift: caseInsensitiveExact(rawShift) });
    }
  }

  const effectiveDate = examDate || date;
  if (effectiveDate) {
    conditions.push({ examDate: caseInsensitiveExact(String(effectiveDate).trim()) });
  }

  // Apply mode filter
  if (mode) {
    if (useNormalizedKeys) {
      conditions.push({ modeKey: mode === 'ai-challenge' ? 'aiChallenge' : mode });
    } else {
      conditions.push(buildModeFilter(mode));
    }
  } else {
    conditions.push(useNormalizedKeys ? { modeKey: { $ne: 'studyMode' } } : buildExcludeStudyModeCondition());
  }

  const baseFilter = combineMongoConditions(conditions);
  const countTotalPromise =
    params.includeTotal === 'true' || params.includeTotal === true
      ? collection.countDocuments(baseFilter, { maxTimeMS: 5000 })
      : Promise.resolve(undefined);

  let startIndex = 0;
  let resources;

  if (cursorId) {
    const decodedObjectId = decodeSessionCursor(cursorId, fingerprint);
    const { ObjectId } = await import('mongodb');
    const mongoFilter = combineMongoConditions([...conditions, { _id: { $gt: new ObjectId(decodedObjectId) } }]);
    let query = collection.find(mongoFilter).project(quizQuestionProjection).sort({ _id: 1 });
    query = applyMaxTime(query, 5000);
    resources = await query.limit(parsedLimit + 1).toArray();
  } else if (params.anchor) {
    const { ObjectId } = await import('mongodb');
    if (!ObjectId.isValid(String(params.anchor))) {
      throw Object.assign(new Error('Invalid question anchor'), { statusCode: 400 });
    }
    const anchorObjectId = new ObjectId(String(params.anchor));
    const anchor = await collection.findOne(
      combineMongoConditions([baseFilter, { _id: anchorObjectId }]),
      { projection: { _id: 1 } },
    );

    if (anchor) {
      const wantsWindowAlignment = params.resumeIndex !== undefined || params.windowOffset !== undefined;
      if (wantsWindowAlignment) {
        const anchorIndex = await collection.countDocuments(
          combineMongoConditions([baseFilter, { _id: { $lt: anchor._id } }]),
          { maxTimeMS: 5000 },
        );
        startIndex = Math.floor(anchorIndex / parsedLimit) * parsedLimit;
        if (startIndex > 10000) {
          throw Object.assign(new Error('Resume window is too large'), { statusCode: 400 });
        }
        const offsetInWindow = anchorIndex - startIndex;
        // Direct _id keyset seek around anchor — zero $skip!
        const [beforeDocs, afterDocs] = await Promise.all([
          offsetInWindow > 0
            ? applyMaxTime(
                collection
                  .find(combineMongoConditions([baseFilter, { _id: { $lt: anchor._id } }]))
                  .project(quizQuestionProjection)
                  .sort({ _id: -1 }),
                5000,
              )
                .limit(offsetInWindow)
                .toArray()
            : Promise.resolve([]),
          applyMaxTime(
            collection
              .find(combineMongoConditions([baseFilter, { _id: { $gte: anchor._id } }]))
              .project(quizQuestionProjection)
              .sort({ _id: 1 }),
            5000,
          )
            .limit(parsedLimit - offsetInWindow + 1)
            .toArray(),
        ]);
        beforeDocs.reverse();
        resources = [...beforeDocs, ...afterDocs];
      } else {
        // Pure direct _id keyset seek from anchor (zero countDocuments, zero $skip).
        let query = collection
          .find(combineMongoConditions([baseFilter, { _id: { $gte: anchor._id } }]))
          .project(quizQuestionProjection)
          .sort({ _id: 1 });
        query = applyMaxTime(query, 5000);
        resources = await query.limit(parsedLimit + 1).toArray();
      }
    } else {
      const requested = Number(params.windowOffset ?? params.resumeIndex ?? 0);
      if (!Number.isSafeInteger(requested) || requested < 0 || requested > 10000) {
        throw Object.assign(new Error('Invalid resume window'), { statusCode: 400 });
      }
      startIndex = Math.floor(requested / parsedLimit) * parsedLimit;
      let query = collection.find(baseFilter).project(quizQuestionProjection).sort({ _id: 1 });
      query = applyMaxTime(query, 5000);
      if (startIndex) query = query.skip(startIndex);
      resources = await query.limit(parsedLimit + 1).toArray();
    }
  } else {
    if (params.resumeIndex !== undefined || params.windowOffset !== undefined) {
      const requested = Number(params.windowOffset ?? params.resumeIndex ?? 0);
      if (!Number.isSafeInteger(requested) || requested < 0 || requested > 10000) {
        throw Object.assign(new Error('Invalid resume window'), { statusCode: 400 });
      }
      startIndex = Math.floor(requested / parsedLimit) * parsedLimit;
      if (startIndex > 10000) {
        throw Object.assign(new Error('Resume window is too large'), { statusCode: 400 });
      }
    }
    let query = collection.find(baseFilter).project(quizQuestionProjection).sort({ _id: 1 });
    query = applyMaxTime(query, 5000);
    if (startIndex) query = query.skip(startIndex);
    resources = await query.limit(parsedLimit + 1).toArray();
  }

  const totalCount = await countTotalPromise;
  const hasMore = resources.length > parsedLimit;
  const pageItems = resources.slice(0, parsedLimit);

  const seenIds = new Set();
  let duplicatesPrevented = 0;
  const uniqueItems = [];
  for (const item of pageItems) {
    const key = String(item.questionUid || item._id || item.id || '');
    if (key && seenIds.has(key)) {
      duplicatesPrevented++;
      continue;
    }
    if (key) seenIds.add(key);
    uniqueItems.push(item);
  }

  const nextCursor =
    hasMore && pageItems.length > 0 && pageItems[pageItems.length - 1]._id
      ? encodeSessionCursor(fingerprint, pageItems[pageItems.length - 1]._id)
      : null;

  const questions = uniqueItems.map(toQuizQuestionDTO);

  const result = {
    questions,
    nextCursor,
    hasMore,
    totalCount,
    startIndex,
  };

  try {
    observeQuestionDelivery({
      endpoint: '/api/questions/session',
      mode: mode || 'session',
      payloadBytes: Buffer.byteLength(JSON.stringify(result)),
      batchSize: questions.length,
      duplicatesPrevented,
      surface: 'session-batch',
    });
  } catch {
    // Telemetry is best-effort.
  }

  return result;
}

export async function fetchQuestionsSession(params) {
  const query = canonicalQuestionQuery('session', params);
  return cachedQuestionPage('fetchQuestionsSession', query, () => buildfetchQuestionsSession(query));
}

export async function fetchQuestionsRevealWindow(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { reveals: {} };
  }
  const bounded = rawItems.slice(0, 8);
  const revealsMap = new Map();
  const missing = [];

  for (const item of bounded) {
    if (!item || typeof item !== 'object') continue;
    const clientKey = String(item.clientKey ?? item.questionUid ?? item.sessionAnchor ?? item.id ?? '').trim();
    if (!clientKey || clientKey.length > 128 || clientKey === '__proto__' || clientKey === 'constructor' || clientKey === 'prototype') continue;
    const cached = lookupCachedReveal(item);
    if (cached) {
      revealsMap.set(clientKey, cached);
    } else {
      missing.push({ clientKey, item });
    }
  }

  if (missing.length > 0) {
    const collection = getQuestionsCollection();
    const { ObjectId } = await import('mongodb');
    const orFilters = [];
    for (const { item } of missing) {
      if (typeof item.sessionAnchor === 'string' && /^[a-fA-F0-9]{24}$/.test(item.sessionAnchor)) {
        orFilters.push({ _id: new ObjectId(item.sessionAnchor) });
      }
      if (typeof item.questionUid === 'string' && /^q_[a-f0-9]{32}$/.test(item.questionUid)) {
        orFilters.push({ questionUid: item.questionUid });
      }
      // Strictly accept primitive string or finite integer IDs — prevents NoSQL operator injection.
      if (typeof item.id === 'string' && item.id.trim().length > 0 && item.id.length <= 200) {
        orFilters.push({ id: item.id });
      } else if (typeof item.id === 'number' && Number.isSafeInteger(item.id)) {
        orFilters.push({ id: item.id });
        orFilters.push({ id: String(item.id) });
      }
    }
    if (orFilters.length > 0) {
      let query = collection
        .find({ $or: orFilters })
        .project(revealInternalProjection)
        .limit(bounded.length * 3);
      query = applyMaxTime(query, 5000);
      const docs = await query.toArray();
      for (const doc of docs) {
        cacheServerReveal(doc);
      }
      const docByLegacyId = new Map();
      for (const doc of docs) {
        if (doc.id !== undefined) {
          const k = String(doc.id);
          if (!docByLegacyId.has(k)) docByLegacyId.set(k, doc);
        }
      }
      for (const { clientKey, item } of missing) {
        const resolved =
          lookupCachedReveal(item) ||
          (typeof item.id === 'string' || typeof item.id === 'number'
            ? buildQuestionReveal(docByLegacyId.get(String(item.id)))
            : undefined);
        if (resolved) {
          revealsMap.set(clientKey, resolved);
        }
      }
    }
  }

  return { reveals: Object.fromEntries(revealsMap) };
}
