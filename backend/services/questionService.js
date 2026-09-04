// backend/services/questionService.js
import { getQuestionsCollection } from '../config/mongodb.js';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

const QUESTIONS_QUERY_CACHE_TTL_MS = 60 * 1000;
export const questionsQueryCache = new LRUCache({
  max: 500,
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});
export const questionCountsCache = new LRUCache({
  max: 500,
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});

// ── Helpers ───────────────────────────────────────────
export function normalizeSearchKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeQuizKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function matchesNormalizedTopic(question, normalizedTopic) {
  const candidates = [
    question.topic,
    question.chapter,
    question.subject,
    question.quizTopic,
    question.quizName,
    question.source,
  ];
  if (normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq') {
    if (candidates.some((field) => {
      const k = normalizeSearchKey(field);
      return k === 'synonymsantonyms' || k === 'antosynopyq' || k === 'synonyms' || k === 'antonyms';
    })) {
      return true;
    }
  }
  return candidates.some((field) => normalizeSearchKey(field) === normalizedTopic);
}

export function isStudyModeRecord(q) {
  if (!q || typeof q !== 'object') return false;
  const qType = String(q.questionType || '').trim().toLowerCase();
  if (qType === 'study-mode' || qType === 'studymode') return true;
  if (String(q.quizName || '').trim().toLowerCase() === 'study mode') return true;
  if (typeof q.word === 'string' && q.word.trim() && Array.isArray(q.meanings)) return true;
  return false;
}

function escapeRegex(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function caseInsensitiveExact(value) {
  return new RegExp(`^${escapeRegex(String(value ?? '').trim())}$`, 'i');
}

function combineMongoConditions(conditions) {
  if (!conditions.length) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

function mongoString(field) {
  return {
    $trim: {
      input: {
        $convert: {
          input: field,
          to: 'string',
          onError: '',
          onNull: '',
        },
      },
    },
  };
}

function questionModeAggregation(match) {
  return [
    { $match: match },
    {
      $project: {
        quizName: { $toLower: mongoString('$quizName') },
        quizId: { $toLower: mongoString('$quizId') },
        source: { $toLower: mongoString('$source') },
        questionType: { $toLower: mongoString('$questionType') },
        topic: { $toLower: mongoString('$topic') },
        hasLetter: { $ne: [mongoString('$letter'), ''] },
        hasWord: { $ne: [mongoString('$word'), ''] },
        hasMeanings: { $isArray: '$meanings' },
      },
    },
    {
      $group: {
        _id: {
          quizName: '$quizName',
          quizId: '$quizId',
          source: '$source',
          questionType: '$questionType',
          topic: '$topic',
          hasLetter: '$hasLetter',
          hasWord: '$hasWord',
          hasMeanings: '$hasMeanings',
        },
        count: { $sum: 1 },
      },
    },
  ];
}

function questionModeFromAggregateKey(key = {}) {
  const quizTag = normalizeQuizKey(key.quizName || key.quizId || key.source);
  const normalizedTopic = normalizeSearchKey(key.topic);
  const questionType = String(key.questionType || '').trim().toLowerCase();
  const quizName = String(key.quizName || '').trim().toLowerCase();

  if (
    questionType === 'study-mode' ||
    questionType === 'studymode' ||
    quizName === 'study mode' ||
    (key.hasWord && key.hasMeanings)
  ) {
    return 'studyMode';
  }

  if (
    [
      'careerwill',
      'patternbank',
      'formula',
      'formulabank',
      'vocabularybank',
      'factbank',
      'antosynopyq',
    ].includes(quizTag) ||
    normalizedTopic === 'antosynopyq' ||
    key.hasLetter ||
    key.hasWord
  ) {
    return 'formula';
  }

  if (['selectionway', 'aichallenge'].includes(quizTag)) return 'aiChallenge';
  if (['tier2', 'tier2hard'].includes(quizTag)) return 'hard';
  if (quizTag === 'topicmix') return 'easy';
  if (['pw', 'mixedpractice', 'mixedpw'].includes(quizTag)) return 'mixed';
  return 'concept';
}

function matchesQuizNameFilter(question, normalizedQuizName) {
  if (!normalizedQuizName) return true;

  const candidates = [
    question.quizName,
    question.quizId,
    question.source,
  ];

  const matched = candidates.some(
    (value) => normalizeQuizKey(value) === normalizedQuizName
  );

  if (normalizedQuizName === 'pyq') {
    return (
      matched ||
      question.quizName === undefined ||
      question.quizName === null ||
      question.quizName === ''
    );
  }

  return matched;
}

export function buildQuestionsCacheKey(parameters, offset, limit) {
  return JSON.stringify({
    params: parameters.map((entry) => [entry.name, entry.value]),
    offset,
    limit,
  });
}

export async function fetchAllQueryResults(container, query, parameters, options = {}) {
  const iterator = container.items.query(
    { query, parameters },
    {
      maxItemCount: 1000,
      enableCrossPartition: options.partitionKey ? undefined : true,
      ...(options.partitionKey ? { partitionKey: options.partitionKey } : {}),
    }
  );
  const { resources } = await iterator.fetchAll({
    maxItemCount: 1000,
    enableCrossPartition: options.partitionKey ? undefined : true,
    ...(options.partitionKey ? { partitionKey: options.partitionKey } : {}),
  });
  return resources;
}

// ── Service Methods ────────────────────────────────────

export async function createQuestion(newQuestion) {
  const collection = getQuestionsCollection();
  const item = { ...newQuestion };

  if (!item.topic) {
    item.topic = item.chapter || item.subject || item.category || 'misc';
  }
  item.topic = String(item.topic).trim() || 'misc';

  await collection.insertOne(item);
  questionsQueryCache.clear();
  questionCountsCache.clear();

  const { _id, ...resource } = item;
  return resource;
}

export async function createQuestionsBulk(questionsData) {
  const collection = getQuestionsCollection();

  const normalizedQuestions = questionsData.map((q, idx) => {
    const item = (q && typeof q === 'object') ? { ...q } : { value: q };

    if (item.id !== undefined && item.id !== null) {
      item.id = String(item.id).trim();
    }

    if (!item.id) {
      const suffix = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
      item.id = `q_${Date.now()}_${idx}_${suffix}`;
    }

    const quizSubject = String(item.quizSubject ?? '').trim();
    const quizTopic = String(item.quizTopic ?? '').trim();

    if (item.word && item.meanings && item.synonyms && item.antonyms) {
      item.questionType = item.questionType || 'study-mode';
      item.quizName = String(item.quizName || 'Study Mode').trim();
    }

    if (!item.subject && quizSubject) item.subject = quizSubject;
    if (!item.chapter && quizTopic) item.chapter = quizTopic;
    if (quizTopic) item.topic = quizTopic;
    if (!item.topic) item.topic = item.chapter || item.subject || item.category || 'misc';
    item.topic = String(item.topic).trim() || 'misc';

    return item;
  });

  const buildNewId = (idx, attempt = 0) => {
    const suffix = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
    return `q_${Date.now()}_${idx}_${attempt}_${suffix}`;
  };

  const createWithRetry = async (item, idx) => {
    let current = { ...item };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await collection.insertOne(current);
        return current;
      } catch (err) {
        if (err?.code !== 11000) throw err;
        current = { ...current, id: buildNewId(idx, attempt + 1) };
      }
    }

    current = { ...current, id: buildNewId(idx, 99) };
    await collection.insertOne(current);
    return current;
  };

  const results = await Promise.allSettled(
    normalizedQuestions.map((q, idx) => createWithRetry(q, idx))
  );
  questionsQueryCache.clear();
  questionCountsCache.clear();
  return results;
}

export async function fetchQuestionCounts(params) {
  const { topic, subject } = params;
  if (!topic && !subject) {
    const error = new Error('topic or subject is required');
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = JSON.stringify({ topic: topic || '', subject: subject || '' });
  const cached = questionCountsCache.get(cacheKey);
  if (cached) return cached;

  const collection = getQuestionsCollection();
  const commonConditions = [];
  if (!topic && subject) {
    commonConditions.push({ subject: caseInsensitiveExact(subject) });
  }

  const normalizedTopic = topic ? normalizeSearchKey(topic) : null;
  const directConditions = [...commonConditions];
  const isSynonymAntonymTopic =
    normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq';

  if (topic) {
    directConditions.push(
      isSynonymAntonymTopic
        ? { topic: { $in: [topic, 'antosynopyq', 'synonyms-antonyms'] } }
        : { topic }
    );
  }

  let grouped = await collection
    .aggregate(questionModeAggregation(combineMongoConditions(directConditions)))
    .toArray();

  if (topic && !isSynonymAntonymTopic && grouped.length === 0) {
    const topicRegex = caseInsensitiveExact(topic);
    const fallbackConditions = [
      ...commonConditions,
      {
        $or: [
          { topic: topicRegex },
          { chapter: topicRegex },
          { subject: topicRegex },
          { quizTopic: topicRegex },
          { quizName: topicRegex },
          { source: topicRegex },
        ],
      },
    ];
    grouped = await collection
      .aggregate(questionModeAggregation(combineMongoConditions(fallbackConditions)))
      .toArray();
  }

  const counts = {
    concept: 0,
    formula: 0,
    mixed: 0,
    aiChallenge: 0,
    easy: 0,
    hard: 0,
    studyMode: 0,
  };

  for (const row of grouped) {
    const mode = questionModeFromAggregateKey(row?._id);
    counts[mode] += Number(row?.count) || 0;
  }

  questionCountsCache.set(cacheKey, counts);
  return counts;
}

export async function fetchImageQuestions(topic = 'visual_reasoning', limit = 20) {
  const collection = getQuestionsCollection();

  const parsedLimit = Number.isFinite(Number(limit))
    ? Math.max(1, parseInt(limit, 10))
    : 20;

  const resources = await collection
    .find({
      questionType: 'image_mcq',
      topic,
    })
    .project({ _id: 0 })
    .limit(parsedLimit)
    .toArray();

  return { count: resources.length, questions: resources };
}

export async function fetchQuestions(params) {
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

  const normalizedTopic = topic ? normalizeSearchKey(topic) : null;
  const normalizedQuizName = quizName ? normalizeQuizKey(quizName) : null;
  const normalizedQuestionType = questionType ? String(questionType).trim().toLowerCase() : null;
  const isStudyModeRequested = normalizedQuestionType === 'study-mode' || normalizedQuestionType === 'studymode';
  const isAllRequested = normalizedQuestionType === 'all';
  const queryMode = topic ? 'topic' : subject ? 'subject' : 'global';

  const parsedOffset = Number.isFinite(Number(offset)) ? Math.max(0, parseInt(offset, 10)) : 0;
  const parsedLimit = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : null;

  const cacheable =
    parsedOffset === 0 &&
    (parsedLimit === null || parsedLimit > 0) &&
    (queryMode === 'topic' || queryMode === 'subject');
  const cacheKey = cacheable
    ? `${queryMode}:${JSON.stringify({
        topic, subject, chapter, concept, difficulty,
        quizName, questionType,
        offset: parsedOffset, limit: parsedLimit,
      })}`
    : null;

  let resources = cacheKey ? questionsQueryCache.get(cacheKey) : null;
  if (resources) {
    return { count: resources.length, questions: resources };
  }

  // ── Build MongoDB filter ─────────────────────────────
  const conditions = [];

  if (!topic && subject) {
    conditions.push({ subject: caseInsensitiveExact(subject) });
  }
  if (chapter) {
    conditions.push({ chapter: caseInsensitiveExact(chapter) });
  }
  if (concept) {
    conditions.push({ concept: caseInsensitiveExact(concept) });
  }
  if (difficulty) {
    conditions.push({ difficulty: caseInsensitiveExact(difficulty) });
  }

  const isSynonymAntonymTopic =
    normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq';

  if (topic) {
    if (isSynonymAntonymTopic) {
      conditions.push({
        topic: { $in: [topic, 'antosynopyq', 'synonyms-antonyms'] },
      });
    } else {
      conditions.push({ topic });
    }
  }

  // Push quizName filter into MongoDB (was in-memory before)
  if (normalizedQuizName) {
    const quizNameRegex = caseInsensitiveExact(quizName);
    if (normalizedQuizName === 'pyq') {
      // PYQ matches quizName/quizId/source OR where quizName is absent
      conditions.push({
        $or: [
          { quizName: quizNameRegex },
          { quizId: quizNameRegex },
          { source: quizNameRegex },
          { quizName: { $in: [null, ''] } },
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
    conditions.push(buildStudyModeMatchCondition());
  } else if (!isAllRequested) {
    if (normalizedQuestionType) {
      conditions.push({ questionType: caseInsensitiveExact(questionType) });
    } else {
      // Default: exclude study-mode records
      conditions.push(buildExcludeStudyModeCondition());
    }
  }

  const mongoFilter = combineMongoConditions(conditions);

  // ── Execute query with DB-side pagination ─────────────
  let cursor = collection.find(mongoFilter).project({ _id: 0 });

  if (parsedOffset > 0) cursor = cursor.skip(parsedOffset);
  if (parsedLimit !== null && parsedLimit > 0) cursor = cursor.limit(parsedLimit);

  resources = await cursor.toArray();

  // Fallback: try multi-field search if no results for topic query
  if (topic && !isSynonymAntonymTopic && resources.length === 0) {
    const topicRegex = caseInsensitiveExact(topic);
    const fallbackConditions = conditions.filter(
      (c) => !c.topic // remove the direct topic condition
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

    let fallbackCursor = collection
      .find(combineMongoConditions(fallbackConditions))
      .project({ _id: 0 });

    if (parsedOffset > 0) fallbackCursor = fallbackCursor.skip(parsedOffset);
    if (parsedLimit !== null && parsedLimit > 0) fallbackCursor = fallbackCursor.limit(parsedLimit);

    resources = await fallbackCursor.toArray();
  }

  if (normalizedTopic && queryMode === 'topic') {
    resources = resources.filter((q) => matchesNormalizedTopic(q, normalizedTopic));
  }
  if (normalizedQuizName) {
    resources = resources.filter((q) => matchesQuizNameFilter(q, normalizedQuizName));
  }
  if (isStudyModeRequested) {
    resources = resources.filter((q) => isStudyModeRecord(q));
  } else if (!isAllRequested) {
    if (normalizedQuestionType) {
      resources = resources.filter(
        (q) => String(q.questionType ?? '').trim().toLowerCase() === normalizedQuestionType
      );
    } else {
      resources = resources.filter((q) => !isStudyModeRecord(q));
    }
  }

  if (cacheKey) {
    questionsQueryCache.set(cacheKey, resources);
  }

  // Get total count when pagination is active
  let total = resources.length;
  if (parsedLimit !== null && parsedLimit > 0) {
    total = resources.length < parsedLimit && parsedOffset === 0
      ? resources.length
      : await collection.countDocuments(mongoFilter);
  }

  return { count: total, questions: resources };
}

// ── Study-mode MongoDB conditions ───────────────────────
function buildStudyModeMatchCondition() {
  return {
    $or: [
      { questionType: { $regex: /^study-?mode$/i } },
      { quizName: { $regex: /^study\s*mode$/i } },
      {
        $and: [
          { word: { $exists: true, $ne: '' } },
          { meanings: { $type: 'array' } },
        ],
      },
    ],
  };
}

function buildExcludeStudyModeCondition() {
  return {
    $nor: [
      { questionType: { $regex: /^study-?mode$/i } },
      { quizName: { $regex: /^study\s*mode$/i } },
      {
        $and: [
          { word: { $exists: true, $ne: '' } },
          { meanings: { $type: 'array' } },
        ],
      },
    ],
  };
}

// ── Mode tag → MongoDB filter mapping ───────────────────
const MODE_QUIZ_TAGS = {
  formula: ['careerwill', 'patternbank', 'formula', 'formulabank', 'vocabularybank', 'factbank', 'antosynopyq'],
  'ai-challenge': ['selectionway', 'aichallenge'],
  hard: ['tier2', 'tier2hard'],
  easy: ['topicmix'],
  mixed: ['pw', 'mixedpractice', 'mixedpw'],
};

function buildModeFilter(mode) {
  const normalizedMode = String(mode || '').trim().toLowerCase();
  const tags = MODE_QUIZ_TAGS[normalizedMode];
  if (!tags) {
    // "concept" mode = everything NOT matched by other modes
    const allOtherTags = Object.values(MODE_QUIZ_TAGS).flat();
    const tagRegexes = allOtherTags.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i'));
    return {
      $and: [
        buildExcludeStudyModeCondition(),
        {
          $nor: [
            { quizName: { $in: tagRegexes } },
            { quizId: { $in: tagRegexes } },
            { source: { $in: tagRegexes } },
          ],
        },
      ],
    };
  }

  const tagRegexes = tags.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i'));

  if (normalizedMode === 'formula') {
    // Formula mode also includes records with letter or word fields
    return {
      $or: [
        { quizName: { $in: tagRegexes } },
        { quizId: { $in: tagRegexes } },
        { source: { $in: tagRegexes } },
        { topic: { $regex: /^antosynopyq$/i } },
        { letter: { $exists: true, $ne: '' } },
        { word: { $exists: true, $ne: '' } },
      ],
    };
  }

  return {
    $or: [
      { quizName: { $in: tagRegexes } },
      { quizId: { $in: tagRegexes } },
      { source: { $in: tagRegexes } },
    ],
  };
}

// ── Session endpoint: mode-filtered + paginated ─────────
export async function fetchQuestionsSession(params) {
  const collection = getQuestionsCollection();
  const {
    topic,
    subject,
    mode,
    limit = 50,
    cursor: cursorId,
    letter,
  } = params;

  const parsedLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const conditions = [];

  if (topic) {
    const normalizedTopic = normalizeSearchKey(topic);
    const isSynonymAntonymTopic =
      normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq';
    if (isSynonymAntonymTopic) {
      conditions.push({
        topic: { $in: [topic, 'antosynopyq', 'synonyms-antonyms'] },
      });
    } else {
      conditions.push({ topic });
    }
  } else if (subject) {
    conditions.push({ subject: caseInsensitiveExact(subject) });
  }

  if (letter) {
    conditions.push({ letter: caseInsensitiveExact(letter) });
  }

  // Apply mode filter
  if (mode) {
    const modeFilter = buildModeFilter(mode);
    conditions.push(modeFilter);
  } else {
    // Default: exclude study-mode
    conditions.push(buildExcludeStudyModeCondition());
  }

  // Cursor-based pagination using _id
  if (cursorId) {
    try {
      const { ObjectId } = await import('mongodb');
      conditions.push({ _id: { $gt: new ObjectId(cursorId) } });
    } catch {
      // Invalid cursor, ignore
    }
  }

  const mongoFilter = combineMongoConditions(conditions);

  // Fetch limit + 1 to know if there are more
  const resources = await collection
    .find(mongoFilter)
    .project({ _id: 1 })  // first pass: get IDs to check hasMore
    .sort({ _id: 1 })
    .limit(parsedLimit + 1)
    .toArray();

  const hasMore = resources.length > parsedLimit;
  const resultIds = resources.slice(0, parsedLimit).map((r) => r._id);

  // Second pass: get full documents for the page
  const questions = resultIds.length > 0
    ? await collection
        .find({ _id: { $in: resultIds } })
        .project({ _id: 0 })
        .sort({ _id: 1 })
        .toArray()
    : [];

  const nextCursor = hasMore && resultIds.length > 0
    ? resultIds[resultIds.length - 1].toString()
    : null;

  return {
    questions,
    nextCursor,
    hasMore,
  };
}

// ── Metadata endpoint: lightweight summary ──────────────
export async function fetchQuestionsMeta(params) {
  const collection = getQuestionsCollection();
  const { topic, subject } = params;

  if (!topic && !subject) {
    const error = new Error('topic or subject is required');
    error.statusCode = 400;
    throw error;
  }

  const conditions = [];
  if (topic) {
    const normalizedTopic = normalizeSearchKey(topic);
    const isSynonymAntonymTopic =
      normalizedTopic === 'synonymsantonyms' || normalizedTopic === 'antosynopyq';
    if (isSynonymAntonymTopic) {
      conditions.push({
        topic: { $in: [topic, 'antosynopyq', 'synonyms-antonyms'] },
      });
    } else {
      conditions.push({ topic });
    }
  } else if (subject) {
    conditions.push({ subject: caseInsensitiveExact(subject) });
  }

  // Exclude study-mode for meta
  conditions.push(buildExcludeStudyModeCondition());

  const mongoFilter = combineMongoConditions(conditions);

  const [total, examAgg, conceptAgg, letterAgg] = await Promise.all([
    collection.countDocuments(mongoFilter),
    collection.aggregate([
      { $match: mongoFilter },
      { $group: { _id: { $toLower: mongoString('$exam') } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    collection.aggregate([
      { $match: mongoFilter },
      { $group: { _id: { $toLower: mongoString('$concept') } } },
      { $match: { _id: { $ne: '' } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    collection.aggregate([
      { $match: mongoFilter },
      {
        $match: {
          letter: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: { $toUpper: { $substrCP: [mongoString('$letter'), 0, 1] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ]);

  const letters = {};
  for (const row of letterAgg) {
    if (row._id && /^[A-Z]$/.test(row._id)) {
      letters[row._id] = row.count;
    }
  }

  return {
    total,
    exams: examAgg.map((r) => r._id).filter(Boolean),
    concepts: conceptAgg.map((r) => r._id).filter(Boolean),
    letters,
  };
}

export async function fetchPracticeTest(params) {
  const collection = getQuestionsCollection();
  const { subject, difficulty, count = 10 } = params;
  const requestedCount = Number.isFinite(Number(count)) ? parseInt(count, 10) : 10;
  const limit = Math.max(1, requestedCount);

  const conditions = [];

  if (subject) {
    conditions.push({ subject: caseInsensitiveExact(subject) });
  }
  if (difficulty) {
    conditions.push({ difficulty: caseInsensitiveExact(difficulty) });
  }

  const resources = await collection
    .find(combineMongoConditions(conditions))
    .project({ _id: 0 })
    .limit(limit * 3)
    .toArray();

  const filteredResources = resources.filter((q) => !isStudyModeRecord(q));
  if (filteredResources.length === 0) return null;

  return filteredResources
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(limit, filteredResources.length))
    .map(q => ({
      id:         q.id,
      subject:    q.subject,
      chapter:    q.chapter,
      concept:    q.concept,
      question:   q.question,
      options:    q.options,
      difficulty: q.difficulty,
    }));
}

export async function analyzeAnswers(answers) {
  const collection = getQuestionsCollection();
  const ids = Array.from(
    new Set(
      answers
        .map((a) => String(a.questionId ?? '').trim())
        .filter(Boolean)
    )
  );

  let questionDocs = [];
  if (ids.length > 0) {
    questionDocs = await collection
      .find({ id: { $in: ids } })
      .project({ _id: 0 })
      .toArray();
  }

  const byId = new Map();
  const byIdTopic = new Map();

  for (const q of questionDocs) {
    if (!byId.has(String(q.id))) {
      byId.set(String(q.id), q);
    }
    byIdTopic.set(`${String(q.id)}::${String(q.topic ?? '')}`, q);
  }

  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  const subjectBreakdown = {};
  const details = [];

  for (const ans of answers) {
    const questionId = String(ans.questionId ?? '');
    const q = ans.topic !== undefined
      ? byIdTopic.get(`${questionId}::${String(ans.topic ?? '')}`) || byId.get(questionId)
      : byId.get(questionId);

    if (!q) continue;

    const subj = q.subject || 'Unknown';
    if (!subjectBreakdown[subj]) {
      subjectBreakdown[subj] = { correct: 0, incorrect: 0, unattempted: 0, total: 0 };
    }

    subjectBreakdown[subj].total++;

    if (ans.selectedAnswer === null || ans.selectedAnswer === undefined) {
      unattempted++;
      subjectBreakdown[subj].unattempted++;
      details.push({ questionId: q.id, status: 'unattempted' });
    } else if (ans.selectedAnswer === q.correctAnswer) {
      correct++;
      subjectBreakdown[subj].correct++;
      details.push({ questionId: q.id, status: 'correct' });
    } else {
      incorrect++;
      subjectBreakdown[subj].incorrect++;
      details.push({ questionId: q.id, status: 'incorrect', correctAnswer: q.correctAnswer });
    }
  }

  const total = correct + incorrect + unattempted;
  const scorePercent = total > 0 ? ((correct / total) * 100).toFixed(2) : 0;

  return {
    summary: { totalQuestions: total, correct, incorrect, unattempted, scorePercent: parseFloat(scorePercent) },
    subjectBreakdown,
    details,
  };
}

export async function fetchQuestionById(
  id,
  topic = undefined
) {
  const collection = getQuestionsCollection();

  const filter = {
    id: String(id),
  };

  if (topic !== undefined && topic !== '') {
    filter.topic = String(topic);
  }

  const question = await collection.findOne(
    filter,
    {
      projection: {
        _id: 0,
      },
    }
  );

  return question;
}

export async function modifyQuestion(id, updates, topic = undefined) {
  const collection = getQuestionsCollection();
  const filter = { id: String(id) };

  if (topic !== undefined && topic !== '') {
    filter.topic = topic;
  }

  const existing = await collection.findOne(filter);
  if (!existing) return null;

  const updated = { ...existing, ...updates, id: existing.id };
  delete updated._id;

  if (!updated.topic) {
    updated.topic = existing.topic || updates.chapter || updates.subject || 'misc';
  }

  await collection.updateOne({ _id: existing._id }, { $set: updated });
  questionsQueryCache.clear();
  questionCountsCache.clear();
  return updated;
}

export async function removeQuestion(id, topic = undefined) {
  const collection = getQuestionsCollection();
  const filter = { id: String(id) };

  if (topic !== undefined && topic !== '') {
    filter.topic = topic;
  }

  const result = topic !== undefined && topic !== ''
    ? await collection.deleteOne(filter)
    : await collection.deleteMany(filter);

  questionsQueryCache.clear();
  questionCountsCache.clear();
  return result.deletedCount > 0;
}

export async function removeQuestionsBulk(ids) {
  const collection = getQuestionsCollection();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { deleted: 0, failed: 0, total: 0 };
  }

  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id).trim()).filter(Boolean))
  );

  if (uniqueIds.length === 0) {
    return { deleted: 0, failed: 0, total: 0 };
  }

  try {
    const result = await collection.deleteMany({ id: { $in: uniqueIds } });
    questionsQueryCache.clear();
    questionCountsCache.clear();

    return {
      deleted: result.deletedCount,
      failed: 0,
      total: uniqueIds.length,
    };
  } catch (err) {
    console.error('removeQuestionsBulk error:', err);

    return {
      deleted: 0,
      failed: uniqueIds.length,
      total: uniqueIds.length,
    };
  }
}

export async function checkDuplicates(questions) {
  const collection = getQuestionsCollection();

  const ids = questions
    .map((q) => String(q.id || q._id || q.questionId || ''))
    .filter(Boolean);

  const getQuestionText = (q) => String(q?.question ?? q?.questionText ?? q?.q ?? '').trim();
  const incomingTexts = questions
    .map(getQuestionText)
    .filter(Boolean);
  const uniqueIds = Array.from(new Set(ids));
  const uniqueTexts = Array.from(new Set(incomingTexts));

  if (uniqueIds.length === 0 && uniqueTexts.length === 0) {
    return [];
  }

  const existingMap = new Map();

  if (uniqueIds.length > 0) {
    const existingById = await collection
      .find({ id: { $in: uniqueIds } })
      .project({
        _id: 0,
        id: 1,
        question: 1,
        questionText: 1,
      })
      .toArray();

    for (const r of existingById) {
      existingMap.set(String(r.id), r.question || r.questionText || '');
    }
  }

  const textBatchSize = 50;
  const existingTextMap = new Map();

  for (let i = 0; i < uniqueTexts.length; i += textBatchSize) {
    const batch = uniqueTexts.slice(i, i + textBatchSize);
    const existingByText = await collection
      .find({
        $or: [
          { question: { $in: batch } },
          { questionText: { $in: batch } },
        ],
      })
      .project({
        _id: 0,
        id: 1,
        question: 1,
        questionText: 1,
      })
      .toArray();

    for (const r of existingByText) {
      const dbText = String(r.question || r.questionText || '').trim();
      if (dbText) existingTextMap.set(dbText, r.id);
    }
  }

  const duplicates = [];
  questions.forEach((q, index) => {
    const qId = String(q.id || q._id || q.questionId || '');
    const qText = getQuestionText(q);
    
    if (qId && existingMap.has(qId)) {
      duplicates.push({ index, id: qId, reason: 'Duplicate ID' });
    } else if (qText && existingTextMap.has(qText)) {
      duplicates.push({ index, id: qId, matchedId: existingTextMap.get(qText), reason: 'Duplicate Question Text' });
    }
  });

  return duplicates;
}
