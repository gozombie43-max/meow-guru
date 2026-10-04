import { createEmptyDistribution, isRecord, getFailureTotal, buildGlobalDistribution, round, buildBrainInsights, buildFailureMapFromRecentQuizzes, buildQuizSummary } from './../services/cognitive/brainScanInsights.js';
import { runtimeLog } from '../infrastructure/runtimeLog.js';

// backend/agents/cognitiveMapperRouter.js
// QuizGuru — Cognitive Failure Mapper API Routes

import express from "express";
import { createHash } from 'node:crypto';
import { createTieredCache } from '../infrastructure/tieredCache.js';
import { protect } from '../middleware/protect.js';
import { idempotency } from '../middleware/idempotency.js';
import { aiAdmission } from '../middleware/aiAdmission.js';
import { failureRequestSchema, failureBatchRequestSchema } from '@meow/contracts/cognitive';
import { getCognitiveProfile as getUserById, appendCognitiveFailures as updateUserCognitiveData } from '../repositories/cognitiveProfileRepository.js';
import { tagFailure, tagFailureBatch, updateFailureMap, getTopWeakConcepts } from "./cognitiveMapper.js";

const router = express.Router();

// Cache brain-scan AI results for 5 min per user to prevent
// every dashboard page-load from firing an LLM call.
const brainScanCache = createTieredCache({ freshMs: 300000, staleMs: 330000, lockMs: 15000 });
router.use(protect);
router.use((req, res, next) => {
  const userId = req.method === 'GET' ? req.path.split('/').pop() : req.body?.userId;
  if (userId && String(userId) !== String(req.user.id)) return res.status(403).json({ error: 'Cannot access another user' });
  next();
});
const validate = schema => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid cognitive request' });
  req.body = parsed.data;
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/tag-failure
// Tag a single wrong answer in real-time (call immediately after wrong answer)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/tag-failure", validate(failureRequestSchema), idempotency('cognitive.tag-failure'), aiAdmission, async (req, res) => {
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

    // 4. Update cognitive data in MongoDB
    await updateUserCognitiveData(
      profile,
      [{ questionId, topic, concept, ...tag }],
      {
        masteryMap: profile.masteryMap || {},
        timePerQuestion: profile.timePerQuestion || {},
        lastActiveDate: new Date().toISOString(),
      }
    );

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
    runtimeLog.error("[tag-failure]", err);
    res.status(err.statusCode || 500).json({ error: 'Cognitive service unavailable. Please retry.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/tag-quiz-results
// Batch-tag all wrong answers after a full quiz completes
// ─────────────────────────────────────────────────────────────────────────────
router.post("/tag-quiz-results", validate(failureBatchRequestSchema), idempotency('cognitive.tag-batch'), aiAdmission, async (req, res) => {
  try {
    const { userId, wrongAnswers } = req.body;

    if (!userId || !Array.isArray(wrongAnswers) || wrongAnswers.length === 0) {
      return res.status(400).json({ error: "userId and wrongAnswers[] required" });
    }

    // 1. Batch tag all wrong answers (parallel, capped at 3 concurrent LLM calls)
    const { tagged, failures } = await tagFailureBatch(wrongAnswers, 3);
    if (!tagged.length) return res.status(502).json({ error: 'Classification unavailable', failedAnswers: failures });

    // 2. Fetch user profile
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

    // 5. Update cognitive data in MongoDB
    await updateUserCognitiveData(
      profile,
      tagged,
      {
        timePerQuestion: timeMap,
        masteryMap: profile.masteryMap || {},
        lastActiveDate: new Date().toISOString(),
      }
    );

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
      failedAnswers: failures,
      topWeakConcepts: topWeak,
      summary: buildQuizSummary(tagged),
    });
  } catch (err) {
    runtimeLog.error("[tag-quiz-results]", err);
    res.status(err.statusCode || 500).json({ error: 'Cognitive service unavailable. Please retry.' });
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

    const fingerprint = createHash('sha256').update(JSON.stringify([profile.failureMap, profile.recentQuizzes, profile.masteryMap, profile.timePerQuestion])).digest('hex');
    let built = false;
    const result = await brainScanCache.read(`brain-scan:v1:${userId}:${fingerprint}`, async () => {
    built = true;
    const storedFailureMap = isRecord(profile.failureMap) ? profile.failureMap : {};
    const storedFailureTotal = getFailureTotal(storedFailureMap);
    const recentQuizFailureMap =
      storedFailureTotal > 0 ? {} : buildFailureMapFromRecentQuizzes(profile.recentQuizzes);
    const failureMap = storedFailureTotal > 0 ? storedFailureMap : recentQuizFailureMap;
    const totalFailures = getFailureTotal(failureMap);
    const topWeak = getTopWeakConcepts(failureMap, 10);
    const globalDist = buildGlobalDistribution(failureMap);
    const insights = await buildBrainInsights({
      recentQuizzes: profile.recentQuizzes || [],
      failureMap,
      topWeakConcepts: topWeak,
      globalDist,
      totalFailures,
    });

    const result = {
      topWeakConcepts: topWeak,
      globalDistribution: globalDist,
      totalConceptsTracked: Object.keys(failureMap).length,
      hasSufficientData: totalFailures > 0,
      lastActiveDate: profile.lastActiveDate,
      source:
        storedFailureTotal > 0 ? "failureMap" : totalFailures > 0 ? "recentQuizzes" : "none",
      insights,
    };

    // Cache the result for 5 minutes
    return result;
    }, { allowStale: false });

    res.set("Cache-Control", "private, no-store").json({ ...result, cached: !built });
  } catch (err) {
    runtimeLog.error("[brain-scan]", err);
    res.status(err.statusCode || 500).json({ error: 'Cognitive service unavailable. Please retry.' });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

export default router;
