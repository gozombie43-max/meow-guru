import { cachedQuestionPage } from './questionCache.js';
import { getQuestionsCollection } from "../../config/mongodb.js";
import { isNormalizedQuestionKeysEnabled, questionsQueryCache, revisionedQuestionCacheKey } from "./questionCache.js";
import { normalizeSearchKey } from "./questionNormalizer.js";
import { quizQuestionProjection, toQuizQuestionDTO } from './quizQuestionDTO.js';
import {
  buildExcludeStudyModeCondition,
  buildModeFilter,
  caseInsensitiveExact,
  combineMongoConditions,
} from "./questionQueryBuilder.js";

async function buildfetchQuestionsSession(params) {
  const collection = getQuestionsCollection();
  const { topic, subject, mode, limit = 50, cursor: cursorId, letter, exam, concept } = params;
  const useNormalizedKeys = isNormalizedQuestionKeysEnabled();
  const shouldCache = !cursorId && params.includeTotal !== 'true' && params.includeTotal !== true;
  const cacheKey = shouldCache
    ? await revisionedQuestionCacheKey('session:' + JSON.stringify(params))
    : null;
  if (cacheKey) {
    const cached = questionsQueryCache.get(cacheKey);
    if (cached) return cached;
  }

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
  } else if (subject) {
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
    const examsArray = exam.split(',').map(e => e.trim()).filter(Boolean);
    if (examsArray.length > 0) {
      conditions.push(useNormalizedKeys ? { exam: { $in: examsArray } } : { exam: { $in: examsArray.map(e => caseInsensitiveExact(e)) } });
    }
  }

  if (concept && concept !== "all") {
    const conceptsArray = concept.split(',').map(c => c.trim()).filter(Boolean);
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

  // Fetch limit + 1 to know if there are more
  const query = collection.find(mongoFilter).project(quizQuestionProjection).sort({ _id: 1 });
  if (startIndex) query.skip(startIndex);
  const resources = await query.limit(parsedLimit + 1).toArray();

  const countFilter = combineMongoConditions(
    conditions.filter((c) => !c._id || !c._id.$gt)
  );
  
  const totalCount = params.includeTotal === 'true' || params.includeTotal === true
    ? await collection.countDocuments(countFilter)
    : undefined;

  const hasMore = resources.length > parsedLimit;
  const pageItems = resources.slice(0, parsedLimit);

  const nextCursor =
    hasMore && pageItems.length > 0
      ? pageItems[pageItems.length - 1]._id.toString()
      : null;

  const questions = pageItems.map(toQuizQuestionDTO);

  const result = {
    questions,
    nextCursor,
    hasMore,
    totalCount,
    startIndex,
  };

  if (cacheKey) questionsQueryCache.set(cacheKey, result);
  return result;
}

export function fetchQuestionsSession(params) {
  return cachedQuestionPage("fetchQuestionsSession", params, () => buildfetchQuestionsSession(params));
}
