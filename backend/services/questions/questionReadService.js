import { getQuestionsCollection } from "../../config/mongodb.js";
import { questionsQueryCache } from "./questionCache.js";
import {
  isStudyModeRecord,
  matchesNormalizedTopic,
  normalizeQuizKey,
  normalizeSearchKey,
} from "./questionNormalizer.js";
import {
  buildExcludeStudyModeCondition,
  buildStudyModeMatchCondition,
  caseInsensitiveExact,
  combineMongoConditions,
  matchesQuizNameFilter,
} from "./questionQueryBuilder.js";

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

  const parsedLimit = Number.isFinite(Number(limit))
    ? Math.max(1, parseInt(limit, 10))
    : 20;

  const resources = await collection
    .find({
      questionType: "image_mcq",
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
  const parsedLimit = Number.isFinite(Number(limit))
    ? parseInt(limit, 10)
    : null;

  const cacheable =
    parsedOffset === 0 &&
    (parsedLimit === null || parsedLimit > 0) &&
    (queryMode === "topic" || queryMode === "subject");
  const cacheKey = cacheable
    ? `${queryMode}:${JSON.stringify({
        topic,
        subject,
        chapter,
        concept,
        difficulty,
        quizName,
        questionType,
        offset: parsedOffset,
        limit: parsedLimit,
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
    normalizedTopic === "synonymsantonyms" || normalizedTopic === "antosynopyq";

  if (topic) {
    if (isSynonymAntonymTopic) {
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
  if (parsedLimit !== null && parsedLimit > 0)
    cursor = cursor.limit(parsedLimit);

  resources = await cursor.toArray();

  // Fallback: try multi-field search if no results for topic query
  if (topic && !isSynonymAntonymTopic && resources.length === 0) {
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

    let fallbackCursor = collection
      .find(combineMongoConditions(fallbackConditions))
      .project({ _id: 0 });

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

  if (cacheKey) {
    questionsQueryCache.set(cacheKey, resources);
  }

  // Get total count when pagination is active
  let total = resources.length;
  if (parsedLimit !== null && parsedLimit > 0) {
    total =
      resources.length < parsedLimit && parsedOffset === 0
        ? resources.length
        : await collection.countDocuments(mongoFilter);
  }

  return { count: total, questions: resources };
}

export async function fetchPracticeTest(params) {
  const collection = getQuestionsCollection();
  const { subject, difficulty, count = 10 } = params;
  const requestedCount = Number.isFinite(Number(count))
    ? parseInt(count, 10)
    : 10;
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
      .project({ _id: 0 })
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

export async function fetchQuestionById(id, topic = undefined) {
  const collection = getQuestionsCollection();

  const filter = {
    id: String(id),
  };

  if (topic !== undefined && topic !== "") {
    filter.topic = String(topic);
  }

  const question = await collection.findOne(filter, {
    projection: {
      _id: 0,
    },
  });

  return question;
}
