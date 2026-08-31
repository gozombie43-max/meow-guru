// backend/agents/adaptiveQuiz/quizBuilder.js
// QuizGuru — Adaptive Quiz Builder
// Fetches questions from MongoDB Atlas based on AI-generated topic allocations

import { chatJSON } from "../../ai/azureClient.js";
import {
  getQuestionsCollection,
  getUsersCollection,
  getMongoDB,
} from "../../config/mongodb.js";

const AOAI_MODEL = process.env.AZURE_OPENAI_MODEL || process.env.AZURE_OPENAI_DEPLOYMENT || "o4-mini";

function normalizeTopicName(topic) {
  const value = String(topic || "").trim().toLowerCase();
  if (
    value === "active & passive voice" ||
    value === "active passive" ||
    value === "active voice" ||
    value === "active voices"
  ) {
    return "Active Passive";
  }
  return topic;
}

function escapeRegex(value = "") {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function exactCI(value) {
  return new RegExp(
    `^${escapeRegex(value)}$`,
    "i"
  );
}

const QUESTION_PROJECTION = {
  _id: 0,
  id: 1,
  topic: 1,
  subject: 1,
  chapter: 1,
  concept: 1,
  difficulty: 1,
  question: 1,
  options: 1,
  correctAnswer: 1,
  correctLetter: 1,
  solution: 1,
  exam: 1,
  year: 1,
};

// ─── Fetch questions for a single topic allocation ────────────────────────────

async function fetchForAllocation({
  topic,
  subject,
  difficultyMix,
  excludeIds = [],
}) {
  const collection = getQuestionsCollection();
  const questions = [];
  const normalizedTopic = normalizeTopicName(topic);
  const requiredTotal = Object.values(difficultyMix)
    .reduce((a, b) => a + b, 0);

  const difficulties = Object.entries(difficultyMix)
    .filter(([, count]) => count > 0);

  const topicFilter = {
    $or: [
      { topic: exactCI(normalizedTopic) },
      { chapter: exactCI(normalizedTopic) },
      { concept: exactCI(normalizedTopic) },
    ],
  };

  const fetches = difficulties.map(
    async ([difficulty, count]) => {
      const fetchCount = Math.min(count * 3, 50);
      const filter = {
        ...topicFilter,
        difficulty: exactCI(difficulty),
        subject: exactCI(subject || ""),
      };

      if (excludeIds.length > 0) {
        filter.id = { $nin: excludeIds.slice(-300) };
      }

      try {
        const resources = await collection
          .find(filter, { projection: QUESTION_PROJECTION })
          .sort({ _ts: -1, createdAt: -1 })
          .limit(fetchCount)
          .toArray();

        const shuffled = resources.sort(
          () => Math.random() - 0.5
        );

        return shuffled.slice(0, count);
      } catch (err) {
        console.error(
          `[quizBuilder] MongoDB query failed for ${topic}/${difficulty}:`,
          err.message
        );

        return [];
      }
    }
  );

  const results = await Promise.all(fetches);
  questions.push(...results.flat());

  // ── Top up from any difficulty ──────────────────────
  if (questions.length < requiredTotal) {
    const needed = requiredTotal - questions.length;
    const existingIds = new Set(questions.map((q) => q.id));
    const excluded = [
      ...excludeIds.slice(-200),
      ...existingIds,
    ];
    const topupFilter = { ...topicFilter };

    if (excluded.length > 0) {
      topupFilter.id = { $nin: excluded };
    }

    try {
      const resources = await collection
        .find(topupFilter, { projection: QUESTION_PROJECTION })
        .limit(needed + 5)
        .toArray();

      questions.push(...resources.slice(0, needed));
    } catch (err) {
      console.warn(
        "[quizBuilder] MongoDB top-up failed:",
        err.message
      );
    }
  }

  // If still short, try generating synthetic similar questions using Azure OpenAI.
  // This is the main fallback path when MongoDB has no rows for a topic like
  // Active & Passive Voice.
  if (questions.length < requiredTotal) {
    const stillNeeded = requiredTotal - questions.length;
    const generated = await generateSyntheticQuestions(normalizedTopic, subject, stillNeeded, difficultyMix, excludeIds);
    questions.push(...generated.slice(0, stillNeeded));
  }

  // Final safety net: if MongoDB returned nothing and OpenAI generation failed,
  // produce a minimal synthetic set so the UI never hard-stops on an empty topic.
  if (questions.length === 0 && requiredTotal > 0) {
    const fallbackGenerated = await generateSyntheticQuestions(normalizedTopic, subject, requiredTotal, difficultyMix, excludeIds, true);
    questions.push(...fallbackGenerated.slice(0, requiredTotal));
  }

  return questions;
}

// ─── Main: build full quiz from config ───────────────────────────────────────

/**
 * Fetches and assembles a complete quiz from MongoDB Atlas
 * based on the pattern analyzer's configuration.
 *
 * @param {Object} config          - Output of analyzePatternAndConfigure()
 * @param {Array}  recentIds       - Question IDs attempted in last 48 hours
 * @returns {Object} { questions, meta }
 */
export async function buildAdaptiveQuiz(config, recentIds = []) {
  const { topicAllocations, quizStrategy, overallInsight, focusArea, estimatedDuration } = config;

  // Fetch all topics in parallel
  const fetchPromises = topicAllocations.map(allocation =>
    fetchForAllocation({
      topic:         allocation.topic,
      subject:       allocation.subject,
      difficultyMix: allocation.difficultyMix,
      excludeIds:    recentIds,
    }).then(questions => ({
      topic:  allocation.topic,
      reason: allocation.reason,
      questions,
    }))
  );

  const topicResults = await Promise.all(fetchPromises);

  // Flatten and tag each question with its allocation reason
  let allQuestions = topicResults.flatMap(({ topic, reason, questions }) =>
    questions.map(q => ({ ...q, _adaptiveReason: reason }))
  );

  // Final shuffle so questions aren't grouped by topic
  allQuestions = allQuestions.sort(() => Math.random() - 0.5);

  // Build topic breakdown for frontend
  const topicBreakdown = topicResults.map(({ topic, questions }) => ({
    topic,
    count:    questions.length,
    expected: topicAllocations.find(a => a.topic === topic)?.questionCount || 0,
  }));

  return {
    questions: allQuestions,
    meta: {
      quizStrategy,
      overallInsight,
      focusArea,
      estimatedDuration,
      totalQuestions:  allQuestions.length,
      topicBreakdown,
      generatedAt:     new Date().toISOString(),
      source:          config.source || "azure-openai",
    },
  };
}

// ─── Save attempt history to MongoDB userProfiles ────────────────────────────

/**
 * Records quiz results for future pattern analysis.
 * Call this after the student completes the quiz.
 */
function buildAttemptState(
  source,
  attempts
) {
  const attemptHistory = [
    ...(source.attemptHistory || []),
    ...attempts,
  ].slice(-500);

  const cutoff =
    Date.now() -
    48 * 60 * 60 * 1000;

  const recentAttemptIds = [
    ...(source.recentAttemptIds || [])
      .filter((record) => record.ts > cutoff),
    ...attempts.map((attempt) => ({
      id: attempt.questionId,
      ts: Date.now(),
    })),
  ].slice(-300);

  const masteryMap = {
    ...(source.masteryMap || {}),
  };
  const topicResults = {};

  for (const attempt of attempts) {
    const topic =
      attempt.topic || "unknown";

    if (!topicResults[topic]) {
      topicResults[topic] = {
        correct: 0,
        total: 0,
      };
    }

    topicResults[topic].total++;

    if (attempt.isCorrect) {
      topicResults[topic].correct++;
    }
  }

  for (const [topic, stats] of Object.entries(topicResults)) {
    const accuracy =
      stats.correct / stats.total;
    const currentLevel =
      masteryMap[topic]?.level || 0;
    const newLevel =
      accuracy >= 0.95
        ? 5
        : accuracy >= 0.80
          ? 4
          : accuracy >= 0.60
            ? 3
            : accuracy >= 0.30
              ? 2
              : 1;

    masteryMap[topic] = {
      level: Math.max(
        currentLevel,
        newLevel
      ),
      lastPracticed: Date.now(),
      history: [
        ...(masteryMap[topic]?.history || []),
        newLevel,
      ].slice(-10),
    };
  }

  return {
    attemptHistory,
    recentAttemptIds,
    masteryMap,
  };
}

export async function saveQuizAttempts(
  userId,
  attempts
) {
  if (
    !userId ||
    userId === "demo-user" ||
    !Array.isArray(attempts) ||
    attempts.length === 0
  ) {
    return {
      success: true,
      attemptsRecorded: 0,
    };
  }

  try {
    const identifier =
      String(userId).trim();
    const users =
      getUsersCollection();

    /*
     * First preference:
     * registered user document.
     */
    const userDoc =
      await users.findOne({
        $and: [
          {
            $or: [
              { id: identifier },
              {
                email:
                  exactCI(identifier),
              },
            ],
          },
          {
            type: {
              $ne: "email_lock",
            },
          },
        ],
      });

    if (userDoc) {
      const state =
        buildAttemptState(
          userDoc,
          attempts
        );

      await users.updateOne(
        { _id: userDoc._id },
        {
          $set: {
            ...state,
            lastActiveDate:
              new Date().toISOString(),
          },
        }
      );

      return {
        success: true,
        attemptsRecorded:
          attempts.length,
      };
    }

    /*
     * Secondary fallback:
     * MongoDB userProfiles collection.
     *
     * This preserves the old Cosmos fallback
     * without requiring Cosmos.
     */
    const profiles =
      getMongoDB().collection(
        "userProfiles"
      );

    let profile =
      await profiles.findOne({
        $or: [
          { id: identifier },
          { userId: identifier },
        ],
      });

    if (!profile) {
      profile = {
        id: identifier,
        userId: identifier,
        attemptHistory: [],
        failureMap: {},
        masteryMap: {},
        recentAttemptIds: [],
        createdAt:
          new Date().toISOString(),
      };

      const state =
        buildAttemptState(
          profile,
          attempts
        );

      await profiles.insertOne({
        ...profile,
        ...state,
        lastActiveDate:
          Date.now(),
      });
    } else {
      const state =
        buildAttemptState(
          profile,
          attempts
        );

      await profiles.updateOne(
        { _id: profile._id },
        {
          $set: {
            ...state,
            lastActiveDate:
              Date.now(),
          },
        }
      );
    }

    return {
      success: true,
      attemptsRecorded:
        attempts.length,
    };
  } catch (err) {
    console.error(
      "[saveQuizAttempts]",
      err.message
    );

    return {
      success: false,
      error: err.message,
    };
  }
}
// Generate synthetic question variations using Azure OpenAI (best-effort)
async function generateSyntheticQuestions(topic, subject, count, difficultyMix, excludeIds = [], forceFallback = false) {
  const prompt = `Create ${count} unique multiple-choice questions for the topic "${topic}" (subject: ${subject}).
${forceFallback ? "There are zero MongoDB questions for this topic, so generate the entire quiz from scratch." : "Use this as a backup to fill missing quiz slots."}
Return JSON array of objects with keys: id, topic, subject, difficulty (easy|medium|hard), question, options (array of 4), correctAnswer, correctLetter, solution.
Do not include any copyrighted passages. Keep each question concise.
If the topic is Active & Passive Voice, generate transformation questions, not vocabulary questions.`;

  try {
    const parsed = await chatJSON(
      prompt,
      AOAI_MODEL,
      "You are a helpful question generator. Return only valid JSON."
    );

    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.questions) ? parsed.questions : []);
    // Add synthetic ids and basic metadata
    return list.map((q, i) => ({
      id: `synth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`,
      topic,
      subject,
      difficulty: q.difficulty || (i % 3 === 0 ? "easy" : i % 3 === 1 ? "medium" : "hard"),
      question: q.question || q.prompt || "",
      options: q.options || q.choices || [],
      correctAnswer: q.correctAnswer || q.answer || null,
      correctLetter: q.correctLetter || null,
      solution: q.solution || q.explanation || "",
    }));
  } catch (err) {
    console.error("[quizBuilder] generateSyntheticQuestions failed:", err?.message || err);
    return [];
  }
}
