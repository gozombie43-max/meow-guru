// backend/agents/adaptiveQuiz/quizBuilder.js
// QuizGuru — Adaptive Quiz Builder
// Fetches questions from Cosmos DB based on AI-generated topic allocations

import { CosmosClient } from "@azure/cosmos";

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const DB   = process.env.COSMOS_DB_NAME   || "quizDB";
const CONT = process.env.COSMOS_CONTAINER || "questions";

function getContainer() {
  return cosmosClient.database(DB).container(CONT);
}

// ─── Fetch questions for a single topic allocation ────────────────────────────

async function fetchForAllocation({ topic, subject, difficultyMix, excludeIds = [] }) {
  const container = getContainer();
  const questions = [];

  // Fetch per difficulty level in parallel
  const difficulties = Object.entries(difficultyMix).filter(([, count]) => count > 0);

  const fetches = difficulties.map(async ([difficulty, count]) => {
    // Extra buffer: fetch 3× needed, then pick randomly (avoids repetition)
    const fetchCount = Math.min(count * 3, 50);
    const excludeClause = excludeIds.length > 0
      ? `AND NOT ARRAY_CONTAINS(@excluded, c.id)`
      : "";

    const query = {
      query: `SELECT TOP @count c.id, c.topic, c.subject, c.chapter, c.concept,
                     c.difficulty, c.question, c.options, c.correctAnswer,
                     c.correctLetter, c.solution, c.exam
              FROM c
              WHERE c.topic = @topic
              AND c.difficulty = @difficulty
              AND c.subject = @subject
              ${excludeClause}
              ORDER BY c._ts DESC`,
      parameters: [
        { name: "@count",     value: fetchCount },
        { name: "@topic",     value: topic },
        { name: "@difficulty", value: difficulty },
        { name: "@subject",   value: subject },
        ...(excludeIds.length > 0
          ? [{ name: "@excluded", value: excludeIds.slice(-300) }]
          : []),
      ],
    };

    try {
      const { resources } = await container.items.query(query, {
        partitionKey: topic,
      }).fetchAll();

      // Randomly pick only what we need from the buffer
      const shuffled = resources.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count);
    } catch (err) {
      console.error(`[quizBuilder] Cosmos query failed for ${topic}/${difficulty}:`, err.message);
      return [];
    }
  });

  const results = await Promise.all(fetches);
  questions.push(...results.flat());

  // If not enough questions for this topic, top-up with any difficulty
  if (questions.length < Object.values(difficultyMix).reduce((a, b) => a + b, 0)) {
    const needed = Object.values(difficultyMix).reduce((a, b) => a + b, 0) - questions.length;
    const existingIds = new Set(questions.map(q => q.id));
    const topupQuery = {
      query: `SELECT TOP @count c.id, c.topic, c.subject, c.chapter, c.concept,
                     c.difficulty, c.question, c.options, c.correctAnswer,
                     c.correctLetter, c.solution, c.exam
              FROM c
              WHERE c.topic = @topic
              AND NOT ARRAY_CONTAINS(@excluded, c.id)`,
      parameters: [
        { name: "@count",    value: needed + 5 },
        { name: "@topic",    value: topic },
        { name: "@excluded", value: [...excludeIds.slice(-200), ...existingIds] },
      ],
    };
    try {
      const { resources } = await container.items.query(topupQuery, {
        partitionKey: topic,
      }).fetchAll();
      questions.push(...resources.slice(0, needed));
    } catch (_) {}
  }

  return questions;
}

// ─── Main: build full quiz from config ───────────────────────────────────────

/**
 * Fetches and assembles a complete quiz from Cosmos DB
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

// ─── Save attempt history to Cosmos userProfiles ─────────────────────────────

/**
 * Records quiz results for future pattern analysis.
 * Call this after the student completes the quiz.
 */
export async function saveQuizAttempts(userId, attempts) {
  const profileContainer = cosmosClient
    .database(DB)
    .container("userProfiles");

  try {
    let profile;
    try {
      const { resource } = await profileContainer.item(userId, userId).read();
      profile = resource;
    } catch {
      profile = {
        id: userId, userId,
        attemptHistory: [],
        failureMap: {},
        masteryMap: {},
        recentAttemptIds: [],
        createdAt: new Date().toISOString(),
      };
    }

    // Append new attempts, keep last 500
    const updated = [
      ...(profile.attemptHistory || []),
      ...attempts,
    ].slice(-500);

    // Track recent IDs (last 48 hours) to avoid repeats
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const recentIds = [
      ...(profile.recentAttemptIds || []).filter(r => r.ts > cutoff),
      ...attempts.map(a => ({ id: a.questionId, ts: Date.now() })),
    ].slice(-300);

    // Update mastery level per topic based on accuracy
    const masteryMap = { ...(profile.masteryMap || {}) };
    const topicResults = {};
    for (const a of attempts) {
      if (!topicResults[a.topic]) topicResults[a.topic] = { correct: 0, total: 0 };
      topicResults[a.topic].total++;
      if (a.isCorrect) topicResults[a.topic].correct++;
    }
    for (const [topic, stats] of Object.entries(topicResults)) {
      const acc = stats.correct / stats.total;
      const currentLevel = masteryMap[topic]?.level || 0;
      const newLevel = acc >= 0.95 ? 5
        : acc >= 0.80 ? 4
        : acc >= 0.60 ? 3
        : acc >= 0.30 ? 2
        : 1;
      masteryMap[topic] = {
        level:         Math.max(currentLevel, newLevel), // never downgrade immediately
        lastPracticed: Date.now(),
        history:       [...(masteryMap[topic]?.history || []), newLevel].slice(-10),
      };
    }

    await profileContainer.items.upsert({
      ...profile,
      attemptHistory:   updated,
      recentAttemptIds: recentIds,
      masteryMap,
      lastActiveDate:   Date.now(),
    });

    return { success: true, attemptsRecorded: attempts.length };
  } catch (err) {
    console.error("[saveQuizAttempts]", err.message);
    return { success: false, error: err.message };
  }
}