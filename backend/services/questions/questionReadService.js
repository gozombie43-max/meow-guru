import { randomBytes, randomInt } from 'node:crypto';
import { toPublicQuestionDTO } from './quizQuestionDTO.js';
import { resolveQuestion } from './questionIdentity.js';
import { parseQuestionExamMode, questionExamModeCondition } from './questionExamMode.js';
import { canonicalQuestionQuery } from './questionQueryIdentity.js';
import { createSingleFlight } from '../../infrastructure/singleFlight.js';
import { fetchQuestionCursorPage } from "./questionCursorService.js";
import { readQuestionFacets } from "./questionFacets.js";
import { logger } from '../../infrastructure/logger.js';
import { getQuestionsCollection } from "../../config/mongodb.js";
import * as questionCache from "./questionCache.js";
import { questionsQueryCache, revisionedQuestionCacheKey, isNormalizedQuestionKeysEnabled } from "./questionCache.js";
import {
  isStudyModeRecord,
  matchesNormalizedTopic,
  normalizeFilterKey,
  normalizeQuizKey,
  normalizeSearchKey,
} from "./questionNormalizer.js";
import {
  buildGeneralAwarenessChapterCondition,
  buildGeneralAwarenessTopicCondition,
  resolveGeneralAwarenessTopicGroupSlug,
} from "./generalAwarenessTopics.js";
import {
  buildExcludeStudyModeCondition,
  buildStudyModeMatchCondition,
  caseInsensitiveExact,
  combineMongoConditions,
  matchesQuizNameFilter,
} from "./questionQueryBuilder.js";

// Strict safe inclusion projection for public question reads: never pulls
// answer keys, solutions, ingestion hashes, training internals, or battle keys.
export const PUBLIC_QUESTION_PROJECTION = Object.freeze(
  Object.fromEntries([
    ['_id', 0],
    ...[
      'id', 'questionUid', 'topic', 'subject', 'chapter', 'chapterSlug', 'topicGroup',
      'concept', 'concepts', 'subtopic', 'category', 'difficulty', 'exam', 'examName',
      'examYear', 'tier', 'year', 'examDate', 'shift', 'language',
      'formula', 'trapType', 'hint', 'question', 'questionText', 'text', 'options',
      'quizName', 'quizTopic', 'quizSubject', 'questionType',
      'questionImage', 'questionImageWidth', 'questionImageHeight',
      'optionRegions', 'optionImages', 'optionAImage', 'optionBImage', 'optionCImage', 'optionDImage',
      'image', 'diagram', 'needs_diagram',
      'word', 'letter', 'source', 'quizId', 'meanings', 'synonyms', 'antonyms',
      'homophones', 'homonyms', 'prompt', 'phrase', 'definition', 'meaning', 'clue',
      'answerTranslation', 'wordTranslation', 'translation',
      'tags', 'translations', 'createdAt', 'updatedAt',
    ].map(field => [field, 1]),
  ]),
);

export const ANALYZE_ANSWERS_PROJECTION = Object.freeze({
  _id: 0,
  id: 1,
  questionUid: 1,
  topic: 1,
  subject: 1,
  correctAnswer: 1,
  options: 1,
});

function fisherYatesShuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function fetchAllQueryResults(
  container,
  query,
  parameters,
  options = {},
) {
  const iterator = container.items.query(
    { query, parameters },
    {
      maxItemCount: 1000,
      enableCrossPartition: options.partitionKey ? undefined : true,
      ...(options.partitionKey ? { partitionKey: options.partitionKey } : {}),
    },
  );
  const { resources } = await iterator.fetchAll({
    maxItemCount: 1000,
    enableCrossPartition: options.partitionKey ? undefined : true,
    ...(options.partitionKey ? { partitionKey: options.partitionKey } : {}),
  });
  return resources;
}

export async function fetchImageQuestions(
  topic = "visual_reasoning",
  limit = 20,
) {
  const collection = getQuestionsCollection();
  const safeTopic = typeof topic === "string" && topic.trim() ? topic.trim() : "visual_reasoning";

  const parsedLimit = Number.isFinite(Number(limit))
    ? Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20))
    : 20;

  const resources = await collection
    .find({
      questionType: "image_mcq",
      topic: safeTopic,
    })
    .project(PUBLIC_QUESTION_PROJECTION)
    .limit(parsedLimit)
    .toArray();

  return { count: resources.length, questions: resources.map(toPublicQuestionDTO) };
}

const legacyReads = createSingleFlight();
export async function fetchQuestions(params) {
  if (params.pagination === "cursor") return fetchQuestionCursorPage(params);
  params = canonicalQuestionQuery('legacy', params);
  const collection = getQuestionsCollection();
  const {
    topic,
    subject,
    chapter,
    concept,
    difficulty,
    quizName,
    questionType,
    offset = 0,
    limit,
  } = params;
  const useNormalizedKeys = isNormalizedQuestionKeysEnabled();

  const normalizedTopic = topic ? normalizeSearchKey(topic) : null;
  const normalizedQuizName = quizName ? normalizeQuizKey(quizName) : null;
  const normalizedQuestionType = questionType
    ? String(questionType).trim().toLowerCase()
    : null;
  const isStudyModeRequested =
    normalizedQuestionType === "study-mode" ||
    normalizedQuestionType === "studymode";
  const isAllRequested = normalizedQuestionType === "all";
  const queryMode = topic ? "topic" : subject ? "subject" : "global";

  const parsedOffset = Number.isFinite(Number(offset))
    ? Math.max(0, parseInt(offset, 10))
    : 0;
  if (parsedOffset > 1000) throw Object.assign(new Error('Offsets above 1000 are retired. Use pagination=cursor and nextCursor.'), { statusCode: 400 });
  logger.info({ event: 'questions.pagination.legacy', offset: parsedOffset, queryMode });
  const parsedLimit = Number.isFinite(Number(limit))
    ? Math.min(200, Math.max(1, Math.floor(Number(limit)) || 50))
    : 50;

  const cacheable =
    parsedOffset === 0 &&
    (parsedLimit === null || parsedLimit > 0) &&
    (queryMode === "topic" || queryMode === "subject") && !params.search && !params.includeFacets;
  const cacheKey = cacheable
    ? await revisionedQuestionCacheKey(`${queryMode}:${JSON.stringify({
        topic,
        subject,
        chapter,
        concept,
        difficulty,
        quizName,
        questionType,
        exam: params.exam,
        examMode: params.examMode,
        sort: params.sort,
        includeTotal: params.includeTotal === 'true' || params.includeTotal === true,
        offset: parsedOffset,
        limit: parsedLimit,
      })}`)
    : null;

  const cached = cacheKey ? questionsQueryCache.get(cacheKey) : null;
  if (cached) return cached;
  const build = async () => {
    let resources;

    // ── Build MongoDB filter ─────────────────────────────
    const conditions = [questionExamModeCondition(params.examMode)];
    const gaGroupSlug = resolveGeneralAwarenessTopicGroupSlug(topic);
    const isGaQuery = Boolean(gaGroupSlug) || normalizeSearchKey(subject) === 'generalawareness';

    if (subject && (!topic || normalizeSearchKey(subject) === 'iitjamphysics')) {
      const subKey = normalizeSearchKey(subject);
      conditions.push(useNormalizedKeys ? { subjectKey: subKey } : (
        subKey === 'reasoning'
          ? { subject: { $in: [/^reasoning$/i, /^logical reasoning$/i] } }
          : subKey === 'generalawareness'
            ? { subject: { $in: [/^general awareness$/i, /^general-awareness$/i] } }
            : { subject: caseInsensitiveExact(subject) }
      ));
    }
    if (chapter) {
      const gaChapterCondition = isGaQuery ? buildGeneralAwarenessChapterCondition(chapter, useNormalizedKeys) : null;
      conditions.push(gaChapterCondition || (useNormalizedKeys ? { chapter } : { chapter: caseInsensitiveExact(chapter) }));
    }
    if (concept) {
      conditions.push(
        useNormalizedKeys
          ? { $or: [{ conceptKey: normalizeFilterKey(concept) }, { conceptKey: { $exists: false }, concept }] }
          : { concept: caseInsensitiveExact(concept) },
      );
    }
    if (difficulty) {
      conditions.push(useNormalizedKeys ? { difficulty: String(difficulty).toLowerCase() } : { difficulty: caseInsensitiveExact(difficulty) });
    }
    if (params.exam) {
      conditions.push(
        useNormalizedKeys
          ? { $or: [{ examKey: normalizeFilterKey(params.exam) }, { examKey: { $exists: false }, exam: params.exam }] }
          : { exam: caseInsensitiveExact(params.exam) },
      );
    }
    if (params.search) {
      const escaped = String(params.search).slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({ $or: ['question', 'id', 'chapter'].map(field => ({ [field]: new RegExp(escaped, 'i') })) });
    }

    const isSynonymAntonymTopic =
      normalizedTopic === "synonymsantonyms" || normalizedTopic === "antosynopyq";

    if (topic) {
      const gaTopicCondition = gaGroupSlug ? buildGeneralAwarenessTopicCondition(gaGroupSlug, useNormalizedKeys) : null;
      if (gaTopicCondition) {
        conditions.push(gaTopicCondition);
      } else if (useNormalizedKeys) {
        conditions.push({ topicKey: isSynonymAntonymTopic ? { $in: ['synonymsantonyms', 'antosynopyq'] } : normalizedTopic });
      } else if (isSynonymAntonymTopic) {
        conditions.push({
          topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] },
        });
      } else {
        conditions.push({ topic });
      }
    }

    // Push quizName filter into MongoDB (was in-memory before)
    if (normalizedQuizName) {
      const quizNameRegex = caseInsensitiveExact(quizName);
      if (normalizedQuizName === "pyq") {
        // PYQ matches quizName/quizId/source OR where quizName is absent
        conditions.push({
          $or: [
            { quizName: quizNameRegex },
            { quizId: quizNameRegex },
            { source: quizNameRegex },
            { quizName: { $in: [null, ""] } },
            { quizName: { $exists: false } },
          ],
        });
      } else {
        conditions.push({
          $or: [
            { quizName: quizNameRegex },
            { quizId: quizNameRegex },
            { source: quizNameRegex },
          ],
        });
      }
    }

    // Push questionType / study-mode filter into MongoDB (was in-memory before)
    if (isStudyModeRequested) {
      conditions.push(useNormalizedKeys ? { modeKey: 'studyMode' } : buildStudyModeMatchCondition());
    } else if (!isAllRequested) {
      if (normalizedQuestionType) {
        conditions.push({ questionType: caseInsensitiveExact(questionType) });
      } else {
        // Default: exclude study-mode records
        conditions.push(useNormalizedKeys ? { modeKey: { $ne: 'studyMode' } } : buildExcludeStudyModeCondition());
      }
    }

    const mongoFilter = combineMongoConditions(conditions);
    let effectiveFilter = mongoFilter;

    // ── Execute query with DB-side pagination ─────────────
    let cursor = collection.find(mongoFilter).project(PUBLIC_QUESTION_PROJECTION);
    if (params.sort === 'asc' || params.sort === 'desc') {
      const direction = params.sort === 'desc' ? -1 : 1;
      cursor = cursor.collation({ locale: 'en', numericOrdering: true, strength: 2 }).sort({ id: direction, _id: direction });
    }

    if (parsedOffset > 0) cursor = cursor.skip(parsedOffset);
    if (parsedLimit !== null && parsedLimit > 0)
      cursor = cursor.limit(parsedLimit);

    resources = await cursor.toArray();

    // Fallback: try multi-field search if no results for topic query
    let usedFallback = false;
    if (topic && !useNormalizedKeys && !isSynonymAntonymTopic && resources.length === 0) {
      usedFallback = true;
      const topicRegex = caseInsensitiveExact(topic);
      const fallbackConditions = conditions.filter(
        (c) => !c.topic, // remove the direct topic condition
      );
      fallbackConditions.push({
        $or: [
          { topic: topicRegex },
          { chapter: topicRegex },
          { subject: topicRegex },
          { quizTopic: topicRegex },
          { quizName: topicRegex },
          { source: topicRegex },
        ],
      });

      effectiveFilter = combineMongoConditions(fallbackConditions);
      let fallbackCursor = collection
        .find(effectiveFilter)
        .project(PUBLIC_QUESTION_PROJECTION);
      if (params.sort === 'asc' || params.sort === 'desc') {
        const direction = params.sort === 'desc' ? -1 : 1;
        fallbackCursor = fallbackCursor.collation({ locale: 'en', numericOrdering: true, strength: 2 }).sort({ id: direction, _id: direction });
      }

      if (parsedOffset > 0) fallbackCursor = fallbackCursor.skip(parsedOffset);
      if (parsedLimit !== null && parsedLimit > 0)
        fallbackCursor = fallbackCursor.limit(parsedLimit);

      resources = await fallbackCursor.toArray();
    }

    if (normalizedTopic && queryMode === "topic") {
      resources = resources.filter((q) =>
        matchesNormalizedTopic(q, normalizedTopic),
      );
    }
    if (normalizedQuizName) {
      resources = resources.filter((q) =>
        matchesQuizNameFilter(q, normalizedQuizName),
      );
    }
    if (isStudyModeRequested) {
      resources = resources.filter((q) => isStudyModeRecord(q));
    } else if (!isAllRequested) {
      if (normalizedQuestionType) {
        resources = resources.filter(
          (q) =>
            String(q.questionType ?? "")
              .trim()
              .toLowerCase() === normalizedQuestionType,
        );
      } else {
        resources = resources.filter((q) => !isStudyModeRecord(q));
      }
    }

    // Get total count when pagination is active
    const shouldCount = params.includeTotal === 'true' || params.includeTotal === true || usedFallback || parsedOffset > 0;
    let total;
    if (shouldCount && typeof collection.countDocuments === 'function') {
      total = await collection.countDocuments(effectiveFilter);
    }

    const cleanedResources = resources.map(toPublicQuestionDTO);
    const result = { count: total !== undefined ? total : cleanedResources.length, ...(total !== undefined ? { total } : {}), questions: cleanedResources };
    if (params.includeFacets === 'true') {
      // Compact filter choices, never full question documents. Keep choices stable
      // across pages so values outside the current page remain selectable.
      result.facets = await readQuestionFacets(params.subject, params.examMode);
    }
    if (cacheKey) questionsQueryCache.set(cacheKey, result, resources.length ? undefined : { ttl: 5000 });
    return result;
  };
  return cacheKey ? legacyReads(cacheKey, build) : build();
}

export async function fetchPracticeTest(params) {
  const safeParams = params && typeof params === 'object' ? params : {};
  const collection = getQuestionsCollection();
  const { subject, difficulty, count = 10, examMode } = safeParams;
  const requestedCount = Number.isFinite(Number(count))
    ? parseInt(count, 10)
    : 10;
  const limit = Math.min(100, Math.max(1, requestedCount || 10));
  const poolLimit = limit * 3;

  const useNormalizedKeys = safeParams.useNormalizedKeys ?? isNormalizedQuestionKeysEnabled();
  const conditions = [];

  if (subject) {
    conditions.push(useNormalizedKeys ? { subjectKey: normalizeSearchKey(subject) } : { subject: caseInsensitiveExact(subject) });
  }
  if (difficulty) {
    conditions.push(useNormalizedKeys ? { difficulty: String(difficulty).toLowerCase() } : { difficulty: caseInsensitiveExact(difficulty) });
  }
  if (examMode) {
    conditions.push(
      questionExamModeCondition(examMode, { useNormalizedKeys }),
    );
  }
  if (useNormalizedKeys) {
    conditions.push({ modeKey: { $ne: 'studyMode' } });
  }

  const practiceProjection = {
    _id: 0, id: 1, questionUid: 1, subject: 1, chapter: 1, concept: 1,
    question: 1, options: 1, difficulty: 1, questionType: 1, quizName: 1, word: 1, meanings: 1,
  };

  const runPoolQuery = async (filter, maxRows, sortSpec = null) => {
    let cursor = collection.find(filter).project(practiceProjection);
    if (sortSpec && typeof cursor.sort === 'function') {
      cursor = cursor.sort(sortSpec);
    }
    return cursor.limit(maxRows).toArray();
  };

  let resources;
  if (useNormalizedKeys) {
    const pivot = typeof safeParams.pivot === 'string' && /^[a-f0-9]{16}$/i.test(safeParams.pivot)
      ? safeParams.pivot.toLowerCase()
      : randomBytes(8).toString('hex');
    const sortSpec = { selectionKey: 1, _id: 1 };
    const head = await runPoolQuery(
      combineMongoConditions([...conditions, { selectionKey: { $gte: pivot } }]),
      poolLimit,
      sortSpec,
    );
    if (head.length < poolLimit) {
      const tail = await runPoolQuery(
        combineMongoConditions([...conditions, { selectionKey: { $lt: pivot } }]),
        poolLimit - head.length,
        sortSpec,
      );
      resources = [...head, ...tail];
    } else {
      resources = head;
    }
    if (resources.length === 0) {
      // Fallback for un-backfilled fixtures lacking selectionKey.
      const fallbackConditions = [
        ...(subject ? [{ subject: caseInsensitiveExact(subject) }] : []),
        ...(difficulty ? [{ difficulty: caseInsensitiveExact(difficulty) }] : []),
        ...(examMode ? [questionExamModeCondition(examMode, { useNormalizedKeys: false })] : []),
        buildExcludeStudyModeCondition(),
      ];
      resources = await runPoolQuery(combineMongoConditions(fallbackConditions), poolLimit);
    }
  } else {
    resources = await runPoolQuery(combineMongoConditions(conditions), poolLimit);
  }

  const filteredResources = useNormalizedKeys ? resources : resources.filter((q) => !isStudyModeRecord(q));
  const deduped = [];
  const seen = new Set();
  for (const q of filteredResources) {
    const key = String(q.questionUid || q.id || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    deduped.push(q);
  }
  if (deduped.length === 0) return null;

  return fisherYatesShuffle(deduped)
    .slice(0, Math.min(limit, deduped.length))
    .map((q) => ({
      id: q.id,
      subject: q.subject,
      chapter: q.chapter,
      concept: q.concept,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
    }));
}

export async function analyzeAnswers(answers) {
  const collection = getQuestionsCollection();
  const ids = Array.from(
    new Set(
      answers.map((a) => String(a.questionId ?? "").trim()).filter(Boolean),
    ),
  );

  let questionDocs = [];
  if (ids.length > 0) {
    questionDocs = await collection
      .find({ id: { $in: ids } })
      .project(ANALYZE_ANSWERS_PROJECTION)
      .toArray();
  }

  const byId = new Map();
  const byIdTopic = new Map();

  for (const q of questionDocs) {
    if (!byId.has(String(q.id))) {
      byId.set(String(q.id), q);
    }
    byIdTopic.set(`${String(q.id)}::${String(q.topic ?? "")}`, q);
  }

  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  const subjectBreakdown = {};
  const details = [];

  for (const ans of answers) {
    const questionId = String(ans.questionId ?? "");
    const q =
      ans.topic !== undefined
        ? byIdTopic.get(`${questionId}::${String(ans.topic ?? "")}`) ||
          byId.get(questionId)
        : byId.get(questionId);

    if (!q) continue;

    const subj = q.subject || "Unknown";
    if (!subjectBreakdown[subj]) {
      subjectBreakdown[subj] = {
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        total: 0,
      };
    }

    subjectBreakdown[subj].total++;

    if (ans.selectedAnswer === null || ans.selectedAnswer === undefined) {
      unattempted++;
      subjectBreakdown[subj].unattempted++;
      details.push({ questionId: q.id, status: "unattempted" });
    } else if (ans.selectedAnswer === q.correctAnswer) {
      correct++;
      subjectBreakdown[subj].correct++;
      details.push({ questionId: q.id, status: "correct" });
    } else {
      incorrect++;
      subjectBreakdown[subj].incorrect++;
      details.push({
        questionId: q.id,
        status: "incorrect",
        correctAnswer: q.correctAnswer,
      });
    }
  }

  const total = correct + incorrect + unattempted;
  const scorePercent = total > 0 ? ((correct / total) * 100).toFixed(2) : 0;

  return {
    summary: {
      totalQuestions: total,
      correct,
      incorrect,
      unattempted,
      scorePercent: parseFloat(scorePercent),
    },
    subjectBreakdown,
    details,
  };
}

export async function fetchQuestionById(id, topic = undefined, examMode = undefined) {
  const load = async () => {
    const collection = getQuestionsCollection();
    const row = await resolveQuestion(
      collection,
      id,
      { topic, examMode },
      { projection: PUBLIC_QUESTION_PROJECTION },
    );
    if (!row) return null;
    return toPublicQuestionDTO(row);
  };
  if (typeof questionCache.cachedQuestionById === 'function') {
    const key = JSON.stringify([String(id ?? ''), topic ?? '', examMode ?? '']);
    return questionCache.cachedQuestionById(key, load);
  }
  return load();
}


export async function exportQuestions(params = {}) {
  parseQuestionExamMode(params.examMode);
  const collection = getQuestionsCollection();
  const {
    topic,
    subject,
    chapter,
    concept,
    difficulty,
    quizName,
    questionType,
    exam,
    search,
    sort = "asc",
    ids,
  } = params;
  const useNormalizedKeys = isNormalizedQuestionKeysEnabled();
  const normalizedTopic = topic ? normalizeSearchKey(topic) : null;
  const normalizedQuizName = quizName ? normalizeQuizKey(quizName) : null;
  const normalizedQuestionType = questionType
    ? String(questionType).trim().toLowerCase()
    : null;
  const isStudyModeRequested =
    normalizedQuestionType === "study-mode" ||
    normalizedQuestionType === "studymode";
  const isAllRequested = normalizedQuestionType === "all";
  const queryMode = topic ? "topic" : subject ? "subject" : "global";

  const conditions = [questionExamModeCondition(params.examMode)];

  if (ids) {
    const idList = (Array.isArray(ids) ? ids : String(ids).split(","))
      .map((val) => String(val).trim())
      .filter(Boolean);
    if (idList.length > 0) {
      conditions.push({ id: { $in: idList } });
    }
  }

  const gaGroupSlug = resolveGeneralAwarenessTopicGroupSlug(topic);
  const isGaQuery = Boolean(gaGroupSlug) || normalizeSearchKey(subject) === "generalawareness";

  if (subject && (!topic || normalizeSearchKey(subject) === "iitjamphysics")) {
    const subKey = normalizeSearchKey(subject);
    conditions.push(
      useNormalizedKeys
        ? { subjectKey: subKey }
        : subKey === "reasoning"
          ? { subject: { $in: [/^reasoning$/i, /^logical reasoning$/i] } }
          : subKey === "generalawareness"
            ? { subject: { $in: [/^general awareness$/i, /^general-awareness$/i] } }
            : { subject: caseInsensitiveExact(subject) }
    );
  }
  if (chapter) {
    const gaChapterCondition = isGaQuery
      ? buildGeneralAwarenessChapterCondition(chapter, useNormalizedKeys)
      : null;
    conditions.push(
      gaChapterCondition || (useNormalizedKeys ? { chapter } : { chapter: caseInsensitiveExact(chapter) })
    );
  }
  if (concept) {
    conditions.push(
      useNormalizedKeys
        ? { $or: [{ conceptKey: normalizeFilterKey(concept) }, { conceptKey: { $exists: false }, concept }] }
        : { concept: caseInsensitiveExact(concept) },
    );
  }
  if (difficulty) {
    conditions.push(
      useNormalizedKeys
        ? { difficulty: String(difficulty).toLowerCase() }
        : { difficulty: caseInsensitiveExact(difficulty) }
    );
  }
  if (exam) {
    conditions.push(
      useNormalizedKeys
        ? { $or: [{ examKey: normalizeFilterKey(exam) }, { examKey: { $exists: false }, exam }] }
        : { exam: caseInsensitiveExact(exam) },
    );
  }
  if (search) {
    const escaped = String(search)
      .slice(0, 200)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    conditions.push({
      $or: ["question", "id", "chapter"].map((field) => ({
        [field]: new RegExp(escaped, "i"),
      })),
    });
  }

  const isSynonymAntonymTopic =
    normalizedTopic === "synonymsantonyms" || normalizedTopic === "antosynopyq";

  if (topic) {
    const gaTopicCondition = gaGroupSlug
      ? buildGeneralAwarenessTopicCondition(gaGroupSlug, useNormalizedKeys)
      : null;
    if (gaTopicCondition) {
      conditions.push(gaTopicCondition);
    } else if (useNormalizedKeys) {
      conditions.push({
        topicKey: isSynonymAntonymTopic
          ? { $in: ["synonymsantonyms", "antosynopyq"] }
          : normalizedTopic,
      });
    } else if (isSynonymAntonymTopic) {
      conditions.push({
        topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] },
      });
    } else {
      conditions.push({ topic });
    }
  }

  if (normalizedQuizName) {
    const quizNameRegex = caseInsensitiveExact(quizName);
    if (normalizedQuizName === "pyq") {
      conditions.push({
        $or: [
          { quizName: quizNameRegex },
          { quizId: quizNameRegex },
          { source: quizNameRegex },
          { quizName: { $in: [null, ""] } },
          { quizName: { $exists: false } },
        ],
      });
    } else {
      conditions.push({
        $or: [
          { quizName: quizNameRegex },
          { quizId: quizNameRegex },
          { source: quizNameRegex },
        ],
      });
    }
  }

  if (isStudyModeRequested) {
    conditions.push(
      useNormalizedKeys ? { modeKey: "studyMode" } : buildStudyModeMatchCondition()
    );
  } else if (!isAllRequested) {
    if (normalizedQuestionType) {
      conditions.push({ questionType: caseInsensitiveExact(questionType) });
    } else {
      conditions.push(
        useNormalizedKeys
          ? { modeKey: { $ne: "studyMode" } }
          : buildExcludeStudyModeCondition()
      );
    }
  }

  const direction = sort === "desc" ? -1 : 1;
  const collation = { locale: "en", numericOrdering: true, strength: 2 };

  const matchesPostFilter = (q) => {
    if (!q || typeof q !== "object") return false;
    if (normalizedTopic && queryMode === "topic" && !matchesNormalizedTopic(q, normalizedTopic)) {
      return false;
    }
    if (normalizedQuizName && !matchesQuizNameFilter(q, normalizedQuizName)) {
      return false;
    }
    if (isStudyModeRequested) {
      return isStudyModeRecord(q);
    }
    if (!isAllRequested) {
      if (normalizedQuestionType) {
        return (
          String(q.questionType ?? "")
            .trim()
            .toLowerCase() === normalizedQuestionType
        );
      }
      return !isStudyModeRecord(q);
    }
    return true;
  };

  const openCursor = (filter) => {
    let cursor = collection.find(filter).project({ _id: 0 });
    if (typeof cursor.collation === "function") {
      cursor = cursor.collation(collation);
    }
    if (typeof cursor.sort === "function") {
      cursor = cursor.sort({ id: direction, _id: direction });
    }
    if (typeof cursor.batchSize === "function") {
      cursor = cursor.batchSize(250);
    }
    if (typeof cursor.maxTimeMS === "function") {
      cursor = cursor.maxTimeMS(30_000);
    }
    return cursor;
  };

  async function* iterateExportCursor(cursor) {
    if (cursor && typeof cursor[Symbol.asyncIterator] === "function") {
      try {
        for await (const raw of cursor) {
          if (!matchesPostFilter(raw)) continue;
          const { _id, ...rest } = raw;
          yield rest;
        }
      } finally {
        await cursor.close?.().catch(() => {});
      }
      return;
    }
    const rows = cursor && typeof cursor.toArray === "function" ? await cursor.toArray() : [];
    for (const raw of rows) {
      if (!matchesPostFilter(raw)) continue;
      const { _id, ...rest } = raw;
      yield rest;
    }
  }

  const primaryFilter = combineMongoConditions(conditions);
  const buildFallbackFilter = () => {
    const topicRegex = caseInsensitiveExact(topic);
    const fallbackConditions = conditions.filter((c) => !c.topic);
    fallbackConditions.push({
      $or: [
        { topic: topicRegex },
        { chapter: topicRegex },
        { subject: topicRegex },
        { quizTopic: topicRegex },
        { quizName: topicRegex },
        { source: topicRegex },
      ],
    });
    return combineMongoConditions(fallbackConditions);
  };

  const isJsonFormat = String(params.format || "").toLowerCase() === "json";
  if (!isJsonFormat) {
    let effectiveFilter = primaryFilter;
    let count = 0;
    if (typeof collection.countDocuments === "function") {
      count = await collection.countDocuments(primaryFilter, { maxTimeMS: 10_000 });
      if (count === 0 && topic && !useNormalizedKeys && !isSynonymAntonymTopic) {
        effectiveFilter = buildFallbackFilter();
        count = await collection.countDocuments(effectiveFilter, { maxTimeMS: 10_000 });
      }
    }
    return {
      count,
      stream: iterateExportCursor(openCursor(effectiveFilter)),
    };
  }

  const collectFromFilter = async (filter) => {
    const collected = [];
    for await (const item of iterateExportCursor(openCursor(filter))) {
      collected.push(item);
    }
    return collected;
  };

  let cleaned = await collectFromFilter(primaryFilter);
  if (topic && !useNormalizedKeys && !isSynonymAntonymTopic && cleaned.length === 0) {
    cleaned = await collectFromFilter(buildFallbackFilter());
  }

  return { count: cleaned.length, questions: cleaned };
}
