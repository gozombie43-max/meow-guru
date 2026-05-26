// backend/agents/cognitiveMapperRouter.js
// QuizGuru — Cognitive Failure Mapper API Routes

import express from "express";
import {
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
    if (!profile?.failureMap) {
      return res.json({
        failureMap: {},
        topWeakConcepts: [],
        hasSufficientData: false,
      });
    }

    const topWeak = getTopWeakConcepts(profile.failureMap, 10);

    // Dimension distribution across all concepts
    const globalDist = {
      CONCEPTUAL_GAP: 0,
      APPLICATION_ERROR: 0,
      TRAP_CAUGHT: 0,
      SPEED_PANIC: 0,
      BLIND_SPOT: 0,
    };
    for (const entry of Object.values(profile.failureMap)) {
      for (const dim of Object.keys(globalDist)) {
        globalDist[dim] += entry[dim] || 0;
      }
    }

    res.json({
      topWeakConcepts: topWeak,
      globalDistribution: globalDist,
      totalConceptsTracked: Object.keys(profile.failureMap).length,
      hasSufficientData: Object.keys(profile.failureMap).length >= 3,
      lastActiveDate: profile.lastActiveDate,
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/seed-demo-data
// [DEV ONLY] Generate sample failure data for testing/demo purposes
// ─────────────────────────────────────────────────────────────────────────────
router.post("/seed-demo-data", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    // Sample test data with variety of failure dimensions
    const sampleFailures = [
      // Mirror Images topic
      { questionId: "q1", topic: "Mirror Images", concept: "Clock Face Rotation", dimension: "CONCEPTUAL_GAP", count: 4 },
      { questionId: "q2", topic: "Mirror Images", concept: "Shape Reflection", dimension: "APPLICATION_ERROR", count: 3 },
      { questionId: "q3", topic: "Mirror Images", concept: "Pattern Recognition", dimension: "TRAP_CAUGHT", count: 2 },
      
      // Analogy topic
      { questionId: "q4", topic: "Analogy", concept: "Word Relations", dimension: "CONCEPTUAL_GAP", count: 3 },
      { questionId: "q5", topic: "Analogy", concept: "Synonym Pairs", dimension: "SPEED_PANIC", count: 2 },
      
      // Classification topic
      { questionId: "q6", topic: "Classification", concept: "Category Grouping", dimension: "BLIND_SPOT", count: 5 },
      { questionId: "q7", topic: "Classification", concept: "Odd One Out", dimension: "TRAP_CAUGHT", count: 1 },
      
      // Math topic
      { questionId: "q8", topic: "Mathematics", concept: "Percentage Calculations", dimension: "APPLICATION_ERROR", count: 4 },
      { questionId: "q9", topic: "Mathematics", concept: "Profit & Loss", dimension: "CONCEPTUAL_GAP", count: 2 },
    ];

    const container = getUsersContainer();
    let profile;
    try {
      const { resources } = await container.items
        .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: userId }] })
        .fetchAll();
      profile = resources[0] || null;
    } catch {
      profile = null;
    }

    if (!profile) {
      profile = {
        id: userId,
        userId,
        failureMap: {},
        masteryMap: {},
        timePerQuestion: {},
        createdAt: new Date().toISOString(),
      };
    }

    // Build failure map from sample data
    const failureMap = { ...profile.failureMap };
    const now = new Date().toISOString();

    for (const sample of sampleFailures) {
      const key = `${sample.topic}::${sample.concept}`;
      if (!failureMap[key]) {
        failureMap[key] = {
          CONCEPTUAL_GAP: 0,
          APPLICATION_ERROR: 0,
          TRAP_CAUGHT: 0,
          SPEED_PANIC: 0,
          BLIND_SPOT: 0,
          lastSeen: null,
          totalWrong: 0,
        };
      }
      failureMap[key][sample.dimension] = (failureMap[key][sample.dimension] || 0) + sample.count;
      failureMap[key].totalWrong = (failureMap[key].totalWrong || 0) + sample.count;
      failureMap[key].lastSeen = now;
    }

    // Upsert profile
    await container.items.upsert({
      ...profile,
      failureMap,
      lastActiveDate: Date.now(),
    });

    res.json({
      success: true,
      message: "Demo data seeded successfully",
      userId,
      conceptsSeeded: Object.keys(failureMap).length,
      totalFailuresSeeded: sampleFailures.reduce((sum, s) => sum + s.count, 0),
    });
  } catch (err) {
    console.error("[seed-demo-data]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
