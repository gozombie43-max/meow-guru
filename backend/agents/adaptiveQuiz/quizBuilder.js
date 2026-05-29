// backend/agents/adaptiveQuiz/quizBuilder.js
// QuizGuru — Adaptive Quiz Builder
// Fetches questions from Cosmos DB based on AI-generated topic allocations

import { CosmosClient } from "@azure/cosmos";
import { chatJSON } from "../../ai/azureClient.js";

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

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

const DB   = process.env.COSMOS_DB_NAME   || "quizDB";
const CONT = process.env.COSMOS_CONTAINER || "questions";

function getContainer() {
  return cosmosClient.database(DB).container(CONT);
}

// ─── Fetch questions for a single topic allocation ────────────────────────────

async function fetchForAllocation({ topic, subject, difficultyMix, excludeIds = [] }) {
  const container = getContainer();
  const questions = [];
  const normalizedTopic = normalizeTopicName(topic);
  const requiredTotal = Object.values(difficultyMix).reduce((a, b) => a + b, 0);

  // Fetch per difficulty level in parallel
  const difficulties = Object.entries(difficultyMix).filter(([, count]) => count > 0);

  const fetches = difficulties.map(async ([difficulty, count]) => {
    // Extra buffer: fetch 3× needed, then pick randomly (avoids repetition)
    const fetchCount = Math.min(count * 3, 50);
    const excludeClause = excludeIds.length > 0
      ? `AND NOT ARRAY_CONTAINS(@excluded, c.id)`
      : "";

    // Be tolerant: some question sources use `topic`, others `chapter` or `concept`.
    // Also compare `subject` case-insensitively (Maths vs Mathematics vs Maths).
    const query = {
      query: `SELECT TOP @count c.id, c.topic, c.subject, c.chapter, c.concept,
             c.difficulty, c.question, c.options, c.correctAnswer,
             c.correctLetter, c.solution, c.exam, c.year
              FROM c
              WHERE (c.topic = @topic OR c.chapter = @topic OR c.concept = @topic)
              AND c.difficulty = @difficulty
              AND LOWER(c.subject) = @subjectLower
              ${excludeClause}
              ORDER BY c._ts DESC`,
      parameters: [
        { name: "@count",      value: fetchCount },
        { name: "@topic",      value: normalizedTopic },
        { name: "@difficulty", value: difficulty },
        { name: "@subjectLower", value: (subject || "").toLowerCase() },
        ...(excludeIds.length > 0
          ? [{ name: "@excluded", value: excludeIds.slice(-300) }]
          : []),
      ],
    };

    try {
      // Do not force a partition key here — question documents across sources
      // may have different partition schemes. Let the query engine route.
      const { resources } = await container.items.query(query).fetchAll();

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
  if (questions.length < requiredTotal) {
    const needed = requiredTotal - questions.length;
    const existingIds = new Set(questions.map(q => q.id));
    const topupQuery = {
      query: `SELECT TOP @count c.id, c.topic, c.subject, c.chapter, c.concept,
             c.difficulty, c.question, c.options, c.correctAnswer,
             c.correctLetter, c.solution, c.exam, c.year
              FROM c
              WHERE (c.topic = @topic OR c.chapter = @topic OR c.concept = @topic)
              AND NOT ARRAY_CONTAINS(@excluded, c.id)`,
      parameters: [
        { name: "@count",    value: needed + 5 },
        { name: "@topic",    value: normalizedTopic },
        { name: "@excluded", value: [...excludeIds.slice(-200), ...existingIds] },
      ],
    };
    try {
      const { resources } = await container.items.query(topupQuery).fetchAll();
      questions.push(...resources.slice(0, needed));
    } catch (_) {}
  }

  // If still short, try generating synthetic similar questions using Azure OpenAI.
  // This is the main fallback path when Cosmos has no rows for a topic like
  // Active & Passive Voice.
  if (questions.length < requiredTotal) {
    const stillNeeded = requiredTotal - questions.length;
    const generated = await generateSyntheticQuestions(normalizedTopic, subject, stillNeeded, difficultyMix, excludeIds);
    questions.push(...generated.slice(0, stillNeeded));
  }

  // Final safety net: if Cosmos returned nothing and OpenAI generation failed,
  // produce a minimal synthetic set so the UI never hard-stops on an empty topic.
  if (questions.length === 0 && requiredTotal > 0) {
    const fallbackGenerated = await generateSyntheticQuestions(normalizedTopic, subject, requiredTotal, difficultyMix, excludeIds, true);
    questions.push(...fallbackGenerated.slice(0, requiredTotal));
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

// Generate synthetic question variations using Azure OpenAI (best-effort)
async function generateSyntheticQuestions(topic, subject, count, difficultyMix, excludeIds = [], forceFallback = false) {
  const prompt = `Create ${count} unique multiple-choice questions for the topic "${topic}" (subject: ${subject}).
${forceFallback ? "There are zero Cosmos DB questions for this topic, so generate the entire quiz from scratch." : "Use this as a backup to fill missing quiz slots."}
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