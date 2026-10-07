import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { aggregateQuestionModeCounts, aggregateQuestionFacets, findMetadataScopes } from '../../repositories/questionMetadataRepository.js';
import { createHash } from 'node:crypto';
import { redisGetJsonMany } from '../../config/redis.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { canonicalQuestionQuery } from './questionQueryIdentity.js';
import { isNormalizedQuestionKeysEnabled, questionCountsCache, revisionedQuestionCacheKey } from "./questionCache.js";
import { readQuestionMetadata } from "./questionMetadataCache.js";
import { canonicalMode, ensureConceptGroups } from "./conceptGroupService.js";
import { deriveModeKey, normalizeSearchKey } from "./questionNormalizer.js";
import {
  buildExcludeStudyModeCondition,
  caseInsensitiveExact,
  combineMongoConditions,
  mongoString,
  questionModeAggregation,
  questionModeFromAggregateKey,
  buildModeFilter,
} from "./questionQueryBuilder.js";

const countsCache = createTieredCache({
  freshMs: 120000, staleMs: 120000, localCache: questionCountsCache,
  isEmpty: counts => Object.values(counts).every(count => count === 0),
});
const countsKey = async params => `question-counts:v3:${createHash('sha256').update(await revisionedQuestionCacheKey(JSON.stringify(params))).digest('hex')}`;

export async function primeQuestionCountCaches(paramsList) {
  const keys = [...new Set(await Promise.all(paramsList.map(params => countsKey(canonicalQuestionQuery('counts', params)))))];
  const missing = keys.filter(key => !countsCache.hasFresh(key));
  const shared = await redisGetJsonMany(missing.map(key => `tiered:v2:${key}`));
  missing.forEach((key, index) => { if (shared[index]) countsCache.prime(key, shared[index]); });
}

export async function fetchQuestionCounts(input, { sharedChecked = false } = {}) {
  const params = canonicalQuestionQuery('counts', input);
  if (!params.topic && !params.subject) throw Object.assign(new Error('topic or subject is required'), { statusCode: 400 });
  return countsCache.read(await countsKey(params), () => buildQuestionCounts(params), { allowStale: false, sharedChecked });
}

async function buildQuestionCounts(params) {
  const { topic, subject } = params;
  if (isNormalizedQuestionKeysEnabled()) {
    const topicKey = normalizeSearchKey(topic);
    const filter = topic ? { topicKey: ['synonymsantonyms', 'antosynopyq'].includes(topicKey) ? { $in: ['synonymsantonyms', 'antosynopyq'] } : topicKey } : { subjectKey: normalizeSearchKey(subject) };
    const grouped = await aggregateQuestionModeCounts([{ $match: filter }, { $group: { _id: '$modeKey', count: { $sum: 1 } } }]);
    const counts = { concept: 0, formula: 0, mixed: 0, aiChallenge: 0, easy: 0, hard: 0, studyMode: 0 };
    for (const row of grouped) if (Object.hasOwn(counts, row._id)) counts[row._id] += Number(row.count) || 0;
    return counts;
  }
  const commonConditions = [];
  if (!topic && subject) {
    commonConditions.push({ subject: caseInsensitiveExact(subject) });
  }

  const normalizedTopic = topic ? normalizeSearchKey(topic) : null;
  const directConditions = [...commonConditions];
  const isSynonymAntonymTopic =
    normalizedTopic === "synonymsantonyms" || normalizedTopic === "antosynopyq";

  if (topic) {
    directConditions.push(
      isSynonymAntonymTopic
        ? { topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] } }
        : { topic },
    );
  }

  let grouped = await aggregateQuestionModeCounts(questionModeAggregation(combineMongoConditions(directConditions)));

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
    grouped = await aggregateQuestionModeCounts(questionModeAggregation(combineMongoConditions(fallbackConditions)));
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

  return counts;
}

export async function fetchQuestionsMeta(params) {
  params = canonicalQuestionQuery('metadata', params);
  if (!params.topic && !params.subject) {
    const error = new Error("topic or subject is required");
    error.statusCode = 400;
    throw error;
  }
  const meta = await readQuestionMetadata(params, () => buildQuestionsMeta(params));
  return { ...meta, ...await ensureConceptGroups(params, meta.concepts) };
}

async function buildQuestionsMeta(params) {
  const { topic, subject, mode } = params;

  if (!topic && !subject) {
    const error = new Error("topic or subject is required");
    error.statusCode = 400;
    throw error;
  }

  const conditions = [];
  if (topic) {
    const normalizedTopic = normalizeSearchKey(topic);
    const isSynonymAntonymTopic =
      normalizedTopic === "synonymsantonyms" ||
      normalizedTopic === "antosynopyq";
    if (isSynonymAntonymTopic) {
      conditions.push(isNormalizedQuestionKeysEnabled() ? {
        topicKey: { $in: ['antosynopyq', 'synonymsantonyms'] },
      } : {
        topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] },
      });
    } else {
      conditions.push(isNormalizedQuestionKeysEnabled() ? { topicKey: normalizeSearchKey(topic) } : { topic });
    }
  }
  if (subject) {
    conditions.push(isNormalizedQuestionKeysEnabled() ? { subjectKey: normalizeSearchKey(subject) } : { subject: caseInsensitiveExact(subject) });
  }

  if (mode) {
    if (isNormalizedQuestionKeysEnabled()) {
      conditions.push({ modeKey: canonicalMode(mode) });
    } else if (mode === "studyMode") {
      conditions.push({ $nor: [buildExcludeStudyModeCondition()] });
    } else {
      conditions.push(buildModeFilter(canonicalMode(mode) === "aiChallenge" ? "ai-challenge" : mode));
    }
  } else {
    // Exclude study-mode for meta if no specific mode is requested
    conditions.push(buildExcludeStudyModeCondition());
  }

  const mongoFilter = combineMongoConditions(conditions);

  const [facets] = await aggregateQuestionFacets([
    { $match: mongoFilter },
    { $facet: {
      total: [{ $count: 'count' }],
      exams: [
        { $group: { _id: { $toLower: mongoString("$exam") } } },
        { $match: { _id: { $ne: "" } } },
        { $sort: { _id: 1 } },
      ],
      concepts: [
        { $group: { _id: { $toLower: mongoString("$concept") } } },
        { $match: { _id: { $ne: "" } } },
        { $sort: { _id: 1 } },
      ],
      letters: [
        {
          $match: {
            letter: { $exists: true, $ne: "" },
          },
        },
        {
          $group: {
            _id: { $toUpper: { $substrCP: [mongoString("$letter"), 0, 1] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ],
    } },
  ]);
  const { exams: examAgg, concepts: conceptAgg, letters: letterAgg } = facets;
  const total = facets.total[0]?.count ?? 0;

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

// Warm metadata already used by students after an upload. Never load question
// bodies here; the builder aggregates just the stored filter fields.
export async function refreshUploadedQuestionMetadata(questions) {
  const topics = new Set(questions.map(q => normalizeSearchKey(q.topic)));
  const subjects = new Set(questions.map(q => normalizeSearchKey(q.subject)));
  try {
    const entries = await findMetadataScopes();
    const affected = entries.filter(({ params }) => params.topic
      ? topics.has(normalizeSearchKey(params.topic))
      : subjects.has(normalizeSearchKey(params.subject)));
    // Also prepare brand-new quiz scopes that nobody has opened yet.
    const scopes = new Map(affected.map(({ params }) => [JSON.stringify(params), params]));
    for (const question of questions) {
      if (!question.topic || !question.subject) continue;
      const params = { subject: question.subject, topic: question.topic, mode: deriveModeKey(question) };
      scopes.set(JSON.stringify(params), params);
    }
    const pending = [...scopes.values()];
    for (let offset = 0; offset < pending.length; offset += 4) {
      await Promise.all(pending.slice(offset, offset + 4).map(params => fetchQuestionsMeta(params)));
    }
  } catch (error) {
    // The revision was already advanced. A failed warmup is retried on the next
    // metadata read and must not report an already saved upload as failed.
    runtimeLog.error("Question metadata warmup failed:", error.message);
  }
}
