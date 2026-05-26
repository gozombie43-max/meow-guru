// backend/agents/cognitiveMapperRouter.js
// QuizGuru — Cognitive Failure Mapper API Routes

import express from "express";
import {
  DIMENSIONS,
  tagFailure,
  tagFailureBatch,
  updateFailureMap,
  getTopWeakConcepts,
} from "./cognitiveMapper.js";
import { getUsersContainer } from "../containerStore.js";

const router = express.Router();

const getUserById = async (id) => {
  const { resources } = await getUsersContainer().items
    .query({
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    })
    .fetchAll();
  return resources[0];
};

const DIMENSION_KEYS = Object.values(DIMENSIONS);

const createEmptyDistribution = () => ({
  [DIMENSIONS.CONCEPTUAL_GAP]: 0,
  [DIMENSIONS.APPLICATION_ERROR]: 0,
  [DIMENSIONS.TRAP_CAUGHT]: 0,
  [DIMENSIONS.SPEED_PANIC]: 0,
  [DIMENSIONS.BLIND_SPOT]: 0,
});

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getEntryWrongTotal = (entry) => {
  if (!isRecord(entry)) return 0;
  const explicitTotal = Number(entry.totalWrong);
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;
  return DIMENSION_KEYS.reduce((total, dim) => total + (Number(entry[dim]) || 0), 0);
};

const getFailureTotal = (failureMap = {}) =>
  Object.values(failureMap).reduce((total, entry) => total + getEntryWrongTotal(entry), 0);

const buildGlobalDistribution = (failureMap = {}) => {
  const distribution = createEmptyDistribution();

  for (const entry of Object.values(failureMap)) {
    if (!isRecord(entry)) continue;
    for (const dim of DIMENSION_KEYS) {
      distribution[dim] += Number(entry[dim]) || 0;
    }
  }

  return distribution;
};

const getAttemptDimension = (result) => {
  const timeTaken = Number(result?.timeTaken);
  if (result?.selected === null) return DIMENSIONS.BLIND_SPOT;
  if (Number.isFinite(timeTaken) && timeTaken > 0 && timeTaken < 6) {
    return DIMENSIONS.BLIND_SPOT;
  }
  return DIMENSIONS.APPLICATION_ERROR;
};

const getAttemptReason = (result) => {
  const timeTaken = Number(result?.timeTaken);
  if (result?.selected === null) return "Question was left unanswered in the saved attempt.";
  if (Number.isFinite(timeTaken) && timeTaken > 0 && timeTaken < 6) {
    return `Answered in ${timeTaken}s in the saved attempt.`;
  }
  return "Wrong answer from saved quiz attempt.";
};

const buildFailureMapFromRecentQuizzes = (recentQuizzes = []) => {
  const tagged = [];

  for (const quiz of recentQuizzes) {
    if (!Array.isArray(quiz?.results)) continue;

    const topic = String(quiz.subject || quiz.title || "Current Attempt");
    const taggedAt = quiz.updatedAt || new Date().toISOString();

    for (const result of quiz.results) {
      if (!isRecord(result) || result.isCorrect !== false) continue;

      const concept = String(result.concept || quiz.title || "Attempted Question");
      const questionId = String(
        result.questionId ?? `${quiz.quizKey || "quiz"}:${result.questionIndex ?? tagged.length}`
      );

      tagged.push({
        questionId,
        topic,
        concept,
        dimension: getAttemptDimension(result),
        reason: getAttemptReason(result),
        confidence: 1,
        source: "attempt",
        taggedAt,
      });
    }
  }

  return updateFailureMap({}, tagged);
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/tag-failure
// Tag a single wrong answer in real-time (call immediately after wrong answer)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/tag-failure", async (req, res) => {
  try {
    const {
      userId,
      questionId,
      topic,
      concept,
      question,
      options,
      userAnswer,
      correctAnswer,
      solution,
      timeSpent,
      changedAnswer = false,
      skipped = false,
    } = req.body;

    // Required fields check
    if (!userId || !questionId || !topic || !concept) {
      return res
        .status(400)
        .json({ error: "Missing required fields: userId, questionId, topic, concept" });
    }

    // 1. Get AI tag
    const tag = await tagFailure({
      questionId,
      topic,
      concept,
      question,
      options,
      userAnswer,
      correctAnswer,
      solution,
      timeSpent,
      changedAnswer,
      skipped,
    });

    // 2. Fetch user profile
    const container = getUsersContainer();
    const profile = await getUserById(userId);
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    // 3. Update failure map
    const updatedMap = updateFailureMap(profile.failureMap || {}, [
      {
        questionId,
        topic,
        concept,
        ...tag,
      },
    ]);

    // 4. Upsert profile back to Cosmos
    await container.items.upsert({
      ...profile,
      failureMap: updatedMap,
      masteryMap: profile.masteryMap || {},
      timePerQuestion: profile.timePerQuestion || {},
      lastActiveDate: new Date().toISOString(),
    });

    res.json({
      success: true,
      tag: {
        dimension: tag.dimension,
        reason: tag.reason,
        confidence: tag.confidence,
        source: tag.source,
      },
      conceptKey: `${topic}::${concept}`,
      totalWrongOnConcept: updatedMap[`${topic}::${concept}`]?.totalWrong || 1,
    });
  } catch (err) {
    console.error("[tag-failure]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/tag-quiz-results
// Batch-tag all wrong answers after a full quiz completes
// ─────────────────────────────────────────────────────────────────────────────
router.post("/tag-quiz-results", async (req, res) => {
  try {
    const { userId, wrongAnswers } = req.body;

    if (!userId || !Array.isArray(wrongAnswers) || wrongAnswers.length === 0) {
      return res.status(400).json({ error: "userId and wrongAnswers[] required" });
    }

    // 1. Batch tag all wrong answers (parallel, capped at 3 concurrent LLM calls)
    const tagged = await tagFailureBatch(wrongAnswers, 3);

    // 2. Fetch user profile
    const container = getUsersContainer();
    const profile = await getUserById(userId);
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    // 3. Update failure map in bulk
    const updatedMap = updateFailureMap(profile.failureMap || {}, tagged);

    // 4. Update average time per question by topic
    const timeMap = { ...profile.timePerQuestion };
    for (const q of wrongAnswers) {
      if (q.timeSpent && q.topic) {
        const existing = timeMap[q.topic] || q.timeSpent;
        timeMap[q.topic] = Math.round((existing + q.timeSpent) / 2);
      }
    }

    // 5. Upsert back
    await container.items.upsert({
      ...profile,
      failureMap: updatedMap,
      timePerQuestion: timeMap,
      masteryMap: profile.masteryMap || {},
      lastActiveDate: new Date().toISOString(),
    });

    // 6. Surface top weak concepts
    const topWeak = getTopWeakConcepts(updatedMap, 5);

    res.json({
      success: true,
      tagged: tagged.map((t) => ({
        questionId: t.questionId,
        concept: t.concept,
        dimension: t.dimension,
        reason: t.reason,
        confidence: t.confidence,
      })),
      topWeakConcepts: topWeak,
      summary: buildQuizSummary(tagged),
    });
  } catch (err) {
    console.error("[tag-quiz-results]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agent/brain-scan/:userId
// Returns the full cognitive failure profile for dashboard display
// ─────────────────────────────────────────────────────────────────────────────
router.get("/brain-scan/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await getUserById(userId);
    if (!profile) {
      return res.json({
        topWeakConcepts: [],
        globalDistribution: createEmptyDistribution(),
        totalConceptsTracked: 0,
        hasSufficientData: false,
        source: "none",
      });
    }

    const storedFailureMap = isRecord(profile.failureMap) ? profile.failureMap : {};
    const storedFailureTotal = getFailureTotal(storedFailureMap);
    const recentQuizFailureMap =
      storedFailureTotal > 0 ? {} : buildFailureMapFromRecentQuizzes(profile.recentQuizzes);
    const failureMap = storedFailureTotal > 0 ? storedFailureMap : recentQuizFailureMap;
    const totalFailures = getFailureTotal(failureMap);
    const topWeak = getTopWeakConcepts(failureMap, 10);
    const globalDist = buildGlobalDistribution(failureMap);

    res.json({
      topWeakConcepts: topWeak,
      globalDistribution: globalDist,
      totalConceptsTracked: Object.keys(failureMap).length,
      hasSufficientData: totalFailures > 0,
      lastActiveDate: profile.lastActiveDate,
      source:
        storedFailureTotal > 0 ? "failureMap" : totalFailures > 0 ? "recentQuizzes" : "none",
    });
  } catch (err) {
    console.error("[brain-scan]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function buildQuizSummary(tagged) {
  const counts = {
    CONCEPTUAL_GAP: 0,
    APPLICATION_ERROR: 0,
    TRAP_CAUGHT: 0,
    SPEED_PANIC: 0,
    BLIND_SPOT: 0,
  };
  for (const t of tagged) counts[t.dimension] = (counts[t.dimension] || 0) + 1;

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  const messages = {
    CONCEPTUAL_GAP: "Most errors were conceptual — you need to learn the rules, not just practice.",
    APPLICATION_ERROR:
      "You know the concepts but are making execution mistakes — slow down and check steps.",
    TRAP_CAUGHT: "SSC's traps are catching you — focus on distractor-awareness drills.",
    SPEED_PANIC: "You're second-guessing correct answers — trust your first instinct more.",
    BLIND_SPOT: "You're skipping or rushing certain concepts — targeted exposure needed.",
  };

  return {
    dimensionBreakdown: counts,
    dominantPattern: dominant[0],
    insight: messages[dominant[0]],
  };
}

export default router;
