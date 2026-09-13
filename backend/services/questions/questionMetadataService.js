import { getMongoDB, getQuestionsCollection } from "../../config/mongodb.js";
import { questionCountsCache } from "./questionCache.js";
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

export async function fetchQuestionCounts(params) {
  const { topic, subject } = params;
  if (!topic && !subject) {
    const error = new Error("topic or subject is required");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = JSON.stringify({
    topic: topic || "",
    subject: subject || "",
  });
  const cached = questionCountsCache.get(cacheKey);
  if (cached) return cached;

  const collection = getQuestionsCollection();
  if (process.env.QUESTIONS_NORMALIZED_KEYS === 'true') {
    const topicKey = normalizeSearchKey(topic);
    const filter = topic ? { topicKey: ['synonymsantonyms', 'antosynopyq'].includes(topicKey) ? { $in: ['synonymsantonyms', 'antosynopyq'] } : topicKey } : { subjectKey: normalizeSearchKey(subject) };
    const grouped = await collection.aggregate([{ $match: filter }, { $group: { _id: '$modeKey', count: { $sum: 1 } } }]).toArray();
    const counts = { concept: 0, formula: 0, mixed: 0, aiChallenge: 0, easy: 0, hard: 0, studyMode: 0 };
    for (const row of grouped) if (Object.hasOwn(counts, row._id)) counts[row._id] += Number(row.count) || 0;
    questionCountsCache.set(cacheKey, counts);
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

  let grouped = await collection
    .aggregate(
      questionModeAggregation(combineMongoConditions(directConditions)),
    )
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
      .aggregate(
        questionModeAggregation(combineMongoConditions(fallbackConditions)),
      )
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

export async function fetchQuestionsMeta(params) {
  if (!params.topic && !params.subject) {
    const error = new Error("topic or subject is required");
    error.statusCode = 400;
    throw error;
  }
  const meta = await readQuestionMetadata(params, () => buildQuestionsMeta(params));
  return { ...meta, ...await ensureConceptGroups(params, meta.concepts) };
}

async function buildQuestionsMeta(params) {
  const collection = getQuestionsCollection();
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
      conditions.push({
        topic: { $in: [topic, "antosynopyq", "synonyms-antonyms"] },
      });
    } else {
      conditions.push(process.env.QUESTIONS_NORMALIZED_KEYS === "true" ? { topicKey: normalizeSearchKey(topic) } : { topic });
    }
  }
  if (subject) {
    conditions.push(process.env.QUESTIONS_NORMALIZED_KEYS === "true" ? { subjectKey: normalizeSearchKey(subject) } : { subject: caseInsensitiveExact(subject) });
  }

  if (mode) {
    if (process.env.QUESTIONS_NORMALIZED_KEYS === "true") {
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

  const [total, examAgg, conceptAgg, letterAgg] = await Promise.all([
    collection.countDocuments(mongoFilter),
    collection
      .aggregate([
        { $match: mongoFilter },
        { $group: { _id: { $toLower: mongoString("$exam") } } },
        { $match: { _id: { $ne: "" } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    collection
      .aggregate([
        { $match: mongoFilter },
        { $group: { _id: { $toLower: mongoString("$concept") } } },
        { $match: { _id: { $ne: "" } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    collection
      .aggregate([
        { $match: mongoFilter },
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
      ])
      .toArray(),
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

// Warm metadata already used by students after an upload. Never load question
// bodies here; the builder aggregates just the stored filter fields.
export async function refreshUploadedQuestionMetadata(questions) {
  const topics = new Set(questions.map(q => normalizeSearchKey(q.topic)));
  const subjects = new Set(questions.map(q => normalizeSearchKey(q.subject)));
  try {
    const entries = await getMongoDB().collection("questionMetadata")
      .find({ params: { $exists: true } }, { projection: { params: 1 } }).toArray();
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
    console.error("Question metadata warmup failed:", error.message);
  }
}
