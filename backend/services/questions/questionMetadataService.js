import { getQuestionsCollection } from "../../config/mongodb.js";
import { questionCountsCache } from "./questionCache.js";
import { normalizeSearchKey } from "./questionNormalizer.js";
import {
  buildExcludeStudyModeCondition,
  caseInsensitiveExact,
  combineMongoConditions,
  mongoString,
  questionModeAggregation,
  questionModeFromAggregateKey,
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
  const collection = getQuestionsCollection();
  const { topic, subject } = params;

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
