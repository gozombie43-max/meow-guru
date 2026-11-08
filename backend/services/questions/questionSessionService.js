import { cachedQuestionPage } from './questionCache.js';
import { canonicalQuestionQuery, parseSessionSelection } from './questionQueryIdentity.js';
import { getQuestionsCollection } from "../../config/mongodb.js";
import { isNormalizedQuestionKeysEnabled } from "./questionCache.js";
import { normalizeSearchKey } from "./questionNormalizer.js";
import { quizQuestionProjection, toQuizQuestionDTO } from './quizQuestionDTO.js';
import { quizCorrectIndex } from '@meow/contracts/questions';
import {
  buildExcludeStudyModeCondition,
  buildModeFilter,
  caseInsensitiveExact,
  combineMongoConditions,
} from "./questionQueryBuilder.js";

const sessionInternalProjection = {
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

function cacheServerReveal(question) {
  const reveal = buildQuestionReveal(question);
  if (!reveal) return null;
  if (question._id) setBoundedReveal(`anchor:${String(question._id)}`, reveal);
  if (question.sessionAnchor) setBoundedReveal(`anchor:${String(question.sessionAnchor)}`, reveal);
  if (question.questionUid) setBoundedReveal(`uid:${String(question.questionUid)}`, reveal);
  if (question.id !== undefined) setBoundedReveal(`id:${String(question.id)}`, reveal);
  return reveal;
}

function lookupCachedReveal(item) {
  if (!item || typeof item !== 'object') return undefined;
  return (
    (item.sessionAnchor && serverRevealCache.get(`anchor:${String(item.sessionAnchor)}`)) ||
    (item.questionUid && serverRevealCache.get(`uid:${String(item.questionUid)}`)) ||
    (item.id !== undefined && serverRevealCache.get(`id:${String(item.id)}`)) ||
    (item.clientKey !== undefined && serverRevealCache.get(`id:${String(item.clientKey)}`))
  );
}

async function buildfetchQuestionsSession(params) {
  const collection = getQuestionsCollection();
  const { topic, subject, mode, limit = 50, cursor: cursorId, letter, exam, concept } = params;
  const useNormalizedKeys = isNormalizedQuestionKeysEnabled();
  const parsedLimit = Math.max(
    1,
    Math.min(200, Math.floor(Number(limit)) || 50),
  );
  const conditions = [];

  if (topic) {
    const normalizedTopic = normalizeSearchKey(topic);
    const isSynonymAntonymTopic =
      normalizedTopic === "synonymsantonyms" ||
      normalizedTopic === "antosynopyq";
    if (isSynonymAntonymTopic) {
      conditions.push(useNormalizedKeys ? {
        topicKey: { $in: ['antosynopyq', 'synonymsantonyms'] },
      } : {
        topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] },
      });
    } else {
      conditions.push(
        useNormalizedKeys
          ? { topicKey: normalizeSearchKey(topic) }
          : { topic },
      );
    }
  }
  if (subject && (!topic || normalizeSearchKey(subject) === 'iitjamphysics')) {
    conditions.push(
      useNormalizedKeys
        ? { subjectKey: normalizeSearchKey(subject) }
        : { subject: caseInsensitiveExact(subject) },
    );
  }

  if (letter) {
    const lettersArray = letter.split(',').map(l => l.trim()).filter(Boolean);
    if (lettersArray.length > 0) {
      conditions.push(useNormalizedKeys ? { letter: { $in: lettersArray.map(l => l.toUpperCase()) } } : { letter: { $in: lettersArray.map(l => caseInsensitiveExact(l)) } });
    }
  }

  if (exam && exam !== "all") {
    const examsArray = parseSessionSelection(exam);
    if (examsArray.length > 0) {
      conditions.push(useNormalizedKeys ? { exam: { $in: examsArray } } : { exam: { $in: examsArray.map(e => caseInsensitiveExact(e)) } });
    }
  }

  if (concept && concept !== "all") {
    const conceptsArray = parseSessionSelection(concept);
    if (conceptsArray.length > 0) {
      conditions.push(useNormalizedKeys ? { concept: { $in: conceptsArray } } : { concept: { $in: conceptsArray.map(c => caseInsensitiveExact(c)) } });
    }
  }

  // Apply mode filter
  if (mode) {
    if (useNormalizedKeys) {
      conditions.push({ modeKey: mode === "ai-challenge" ? "aiChallenge" : mode });
    } else {
      const modeFilter = buildModeFilter(mode);
      conditions.push(modeFilter);
    }
  } else {
    // Default: exclude study-mode
    conditions.push(useNormalizedKeys ? { modeKey: { $ne: 'studyMode' } } : buildExcludeStudyModeCondition());
  }

  const baseFilter = combineMongoConditions(conditions);
  let startIndex = 0;
  if (!cursorId && (params.anchor || params.resumeIndex !== undefined || params.windowOffset !== undefined)) {
    const requested = Number(params.windowOffset ?? params.resumeIndex ?? 0);
    if (!Number.isSafeInteger(requested) || requested < 0 || requested > 10000)
      throw Object.assign(new Error('Invalid resume window'), { statusCode: 400 });
    let anchorIndex = requested;
    if (params.anchor) {
      const { ObjectId } = await import('mongodb');
      if (!ObjectId.isValid(String(params.anchor))) throw Object.assign(new Error('Invalid question anchor'), { statusCode: 400 });
      const anchor = await collection.findOne(combineMongoConditions([baseFilter, { _id: new ObjectId(String(params.anchor)) }]), { projection: { _id: 1 } });
      if (anchor) anchorIndex = await collection.countDocuments(combineMongoConditions([baseFilter, { _id: { $lt: anchor._id } }]));
    }
    startIndex = Math.floor(anchorIndex / parsedLimit) * parsedLimit;
    if (startIndex > 10000) throw Object.assign(new Error('Resume window is too large'), { statusCode: 400 });
  }
  // Cursor-based pagination using _id
  if (cursorId) {
    try {
      const { ObjectId } = await import("mongodb");
      conditions.push({ _id: { $gt: new ObjectId(cursorId) } });
    } catch {
      throw Object.assign(new Error("Invalid question cursor"), { statusCode: 400 });
    }
  }

  const mongoFilter = combineMongoConditions(conditions);

  // Fetch limit + 1 to know if there are more. Populate serverRevealCache in memory before DTO redaction.
  const query = collection.find(mongoFilter).project(sessionInternalProjection).sort({ _id: 1 });
  if (startIndex) query.skip(startIndex);
  const countFilter = combineMongoConditions(
    conditions.filter((c) => !c._id || !c._id.$gt)
  );
  
  const [resources, totalCount] = await Promise.all([
    query.limit(parsedLimit + 1).toArray(),
    params.includeTotal === 'true' || params.includeTotal === true
      ? collection.countDocuments(countFilter) : undefined,
  ]);

  const hasMore = resources.length > parsedLimit;
  const pageItems = resources.slice(0, parsedLimit);

  const nextCursor =
    hasMore && pageItems.length > 0
      ? pageItems[pageItems.length - 1]._id.toString()
      : null;

  for (const item of pageItems) {
    cacheServerReveal(item);
  }

  const questions = pageItems.map(toQuizQuestionDTO);

  const result = {
    questions,
    nextCursor,
    hasMore,
    totalCount,
    startIndex,
  };

  return result;
}

export async function fetchQuestionsSession(params) {
  const query = canonicalQuestionQuery('session', params);
  return cachedQuestionPage("fetchQuestionsSession", query, () => buildfetchQuestionsSession(query));
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
      if (item.sessionAnchor) {
        if (ObjectId.isValid(String(item.sessionAnchor))) {
          orFilters.push({ _id: new ObjectId(String(item.sessionAnchor)) });
        }
        orFilters.push({ _id: String(item.sessionAnchor) });
      }
      if (item.questionUid) {
        orFilters.push({ questionUid: String(item.questionUid) });
      }
      if (item.id !== undefined) {
        orFilters.push({ id: item.id });
        orFilters.push({ id: String(item.id) });
      }
    }
    if (orFilters.length > 0) {
      const docs = await collection
        .find({ $or: orFilters })
        .project(sessionInternalProjection)
        .limit(bounded.length * 3)
        .toArray();
      for (const doc of docs) {
        cacheServerReveal(doc);
      }
      for (const { clientKey, item } of missing) {
        const resolved = lookupCachedReveal(item);
        if (resolved) {
          revealsMap.set(clientKey, resolved);
        }
      }
      // Warm ahead the next 60 questions from the earliest anchor in the background
      // so subsequent prefetches hit serverRevealCache in <5ms even after a cold restart.
      if (process.env.NODE_ENV !== 'test') {
        const firstAnchor = missing.map(m => m.item?.sessionAnchor).find(a => a && ObjectId.isValid(String(a)));
        if (firstAnchor) {
          void collection
            .find({ _id: { $gte: new ObjectId(String(firstAnchor)) } })
            .project(sessionInternalProjection)
            .sort({ _id: 1 })
            .limit(60)
            .toArray()
            .then(aheadDocs => {
              for (const doc of aheadDocs) cacheServerReveal(doc);
            })
            .catch(() => {});
        }
      }
    }
  }

  return { reveals: Object.fromEntries(revealsMap) };
}
