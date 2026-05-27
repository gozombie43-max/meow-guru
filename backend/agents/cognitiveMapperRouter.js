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
import { chatJSON } from "../ai/azureClient.js";

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

const DIMENSION_FIXES = {
  [DIMENSIONS.CONCEPTUAL_GAP]: {
    why: "The rule itself is missing or unclear.",
    fix: "Review the rule, then solve a few easy questions before timing.",
  },
  [DIMENSIONS.APPLICATION_ERROR]: {
    why: "The concept is known, but one step went wrong.",
    fix: "Slow down and compare each step against the worked solution.",
  },
  [DIMENSIONS.TRAP_CAUGHT]: {
    why: "A distractor looked more convincing than the correct option.",
    fix: "Write why the wrong option is tempting before choosing.",
  },
  [DIMENSIONS.SPEED_PANIC]: {
    why: "The answer changed under pressure or too quickly.",
    fix: "Use short timed sets and avoid second-guessing.",
  },
  [DIMENSIONS.BLIND_SPOT]: {
    why: "The question was skipped, guessed, or rushed.",
    fix: "Force a written reason before answering.",
  },
};

const normalizeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const average = (values = []) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const round = (value) => Math.round(Number.isFinite(value) ? value : 0);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildWrongAnswerRows = (recentQuizzes = []) => {
  const rows = [];

  for (const quiz of recentQuizzes) {
    if (!Array.isArray(quiz?.results)) continue;

    const subject = normalizeText(quiz.subject, "Unknown Subject");
    const topic = normalizeText(quiz.title || quiz.slug || quiz.subject, "Unknown Topic");
    const updatedAt = quiz.updatedAt || new Date().toISOString();

    for (const result of quiz.results) {
      if (!isRecord(result) || result.isCorrect !== false) continue;

      rows.push({
        subject,
        topic,
        concept: normalizeText(result.concept, topic),
        timeTaken: Number(result.timeTaken) || 0,
        selected: result.selected ?? null,
        updatedAt,
      });
    }
  }

  return rows;
};

const buildHeatmap = (wrongRows = [], fallbackConcepts = []) => {
  const subjectMap = new Map();

  const ensureSubject = (subject) => {
    if (!subjectMap.has(subject)) {
      subjectMap.set(subject, {
        subject,
        totalWrong: 0,
        topics: new Map(),
      });
    }
    return subjectMap.get(subject);
  };

  for (const row of wrongRows) {
    const subjectEntry = ensureSubject(row.subject);
    const topicKey = row.topic;
    if (!subjectEntry.topics.has(topicKey)) {
      subjectEntry.topics.set(topicKey, {
        topic: topicKey,
        totalWrong: 0,
        concepts: new Set(),
        avgTimeValues: [],
        recentAt: row.updatedAt,
      });
    }

    const topicEntry = subjectEntry.topics.get(topicKey);
    topicEntry.totalWrong += 1;
    topicEntry.concepts.add(row.concept);
    topicEntry.avgTimeValues.push(row.timeTaken);
    if (!topicEntry.recentAt || Date.parse(row.updatedAt) > Date.parse(topicEntry.recentAt)) {
      topicEntry.recentAt = row.updatedAt;
    }

    subjectEntry.totalWrong += 1;
  }

  if (subjectMap.size === 0 && fallbackConcepts.length > 0) {
    const subjectEntry = ensureSubject("Practice History");
    for (const concept of fallbackConcepts) {
      const topicKey = concept.topic || "General";
      if (!subjectEntry.topics.has(topicKey)) {
        subjectEntry.topics.set(topicKey, {
          topic: topicKey,
          totalWrong: 0,
          concepts: new Set(),
          avgTimeValues: [],
          recentAt: concept.lastSeen,
        });
      }

      const topicEntry = subjectEntry.topics.get(topicKey);
      topicEntry.totalWrong += concept.totalWrong || 0;
      topicEntry.concepts.add(concept.concept || topicKey);
      subjectEntry.totalWrong += concept.totalWrong || 0;
    }
  }

  return Array.from(subjectMap.values())
    .map((subjectEntry) => {
      const topics = Array.from(subjectEntry.topics.values())
        .map((topicEntry) => ({
          topic: topicEntry.topic,
          totalWrong: topicEntry.totalWrong,
          concepts: topicEntry.concepts.size,
          avgTime: round(average(topicEntry.avgTimeValues)),
          recentAt: topicEntry.recentAt,
        }))
        .sort((a, b) => b.totalWrong - a.totalWrong)
        .slice(0, 5);

      return {
        subject: subjectEntry.subject,
        totalWrong: subjectEntry.totalWrong,
        topics,
      };
    })
    .sort((a, b) => b.totalWrong - a.totalWrong);
};

const buildConfidenceProfile = (allResults = []) => {
  const wrongResults = allResults.filter((result) => result.isCorrect === false);
  const correctResults = allResults.filter((result) => result.isCorrect === true);
  const skippedResults = wrongResults.filter((result) => result.selected === null);
  const fastWrongResults = wrongResults.filter((result) => (Number(result.timeTaken) || 0) <= 5);

  const skipRate = wrongResults.length > 0 ? skippedResults.length / wrongResults.length : 0;
  const fastWrongRate = wrongResults.length > 0 ? fastWrongResults.length / wrongResults.length : 0;
  const avgWrongTime = round(average(wrongResults.map((result) => Number(result.timeTaken) || 0)));
  const avgCorrectTime = round(average(correctResults.map((result) => Number(result.timeTaken) || 0)));

  let label = "Balanced";
  let detail = "Your pace and accuracy are relatively even.";

  if (skipRate >= 0.3) {
    label = "Guess/Skip Heavy";
    detail = "Skipped or guessed answers are driving the misses.";
  } else if (fastWrongRate >= 0.45) {
    label = "Panic Prone";
    detail = "Most wrong answers happen very quickly under pressure.";
  } else if (avgWrongTime > avgCorrectTime + 5) {
    label = "Slow Misfire";
    detail = "You spend time, but the final check still needs work.";
  }

  return {
    label,
    detail,
    fastWrongRate: round(fastWrongRate * 100),
    skipRate: round(skipRate * 100),
    avgWrongTime,
    avgCorrectTime,
  };
};

const buildAdaptiveNextDrill = ({ topWeakConcepts = [], globalDist = {}, subjectHeatmap = [] }) => {
  const dominantDimension = Object.entries(globalDist).sort((a, b) => b[1] - a[1])[0]?.[0] || DIMENSIONS.APPLICATION_ERROR;
  const topConcept = topWeakConcepts[0] || null;
  const topSubject = subjectHeatmap[0] || null;
  const count = topConcept?.totalWrong >= 5 ? 10 : topConcept?.totalWrong >= 3 ? 8 : 5;
  const drillType =
    dominantDimension === DIMENSIONS.TRAP_CAUGHT
      ? "trap-awareness"
      : dominantDimension === DIMENSIONS.SPEED_PANIC
        ? "timed-pressure"
        : dominantDimension === DIMENSIONS.BLIND_SPOT
          ? "forced-explanation"
          : dominantDimension === DIMENSIONS.CONCEPTUAL_GAP
            ? "concept-rebuild"
            : "step-by-step";

  return {
    count,
    drillType,
    subject: topSubject?.subject || topConcept?.topic || "General",
    topic: topConcept?.topic || topSubject?.topics?.[0]?.topic || "General",
    concept: topConcept?.concept || topConcept?.topic || "General",
    difficulty:
      dominantDimension === DIMENSIONS.CONCEPTUAL_GAP || dominantDimension === DIMENSIONS.BLIND_SPOT
        ? "easy"
        : dominantDimension === DIMENSIONS.SPEED_PANIC
          ? "medium"
          : "medium",
    reason: topConcept
      ? `Most misses are concentrated in ${topConcept.concept} (${topConcept.totalWrong} wrong).`
      : "Use the current weakness map to keep practice targeted.",
    focus: DIMENSION_FIXES[dominantDimension]?.fix || "Keep the next drill short and focused.",
    dominantDimension,
  };
};

const buildRevisionPack = (topWeakConcepts = []) =>
  topWeakConcepts.slice(0, 6).map((concept) => ({
    subject: concept.topic || "General",
    topic: concept.topic || "General",
    concept: concept.concept,
    totalWrong: concept.totalWrong,
    drillSize: concept.totalWrong >= 5 ? 10 : concept.totalWrong >= 3 ? 8 : 5,
    drillType: DIMENSION_FIXES[concept.dominantDimension]?.why || "Review the concept, then test it again.",
  }));

const buildTrapRadar = (topWeakConcepts = [], globalDist = {}) => {
  const trapCount = Number(globalDist[DIMENSIONS.TRAP_CAUGHT]) || 0;
  const total = DIMENSION_KEYS.reduce((sum, key) => sum + (Number(globalDist[key]) || 0), 0);
  const trapShare = total > 0 ? trapCount / total : 0;

  const trapHotspots = topWeakConcepts
    .filter((concept) => (concept.breakdown?.[DIMENSIONS.TRAP_CAUGHT] || 0) > 0)
    .slice(0, 3)
    .map((concept) => ({
      concept: concept.concept,
      topic: concept.topic,
      hits: concept.breakdown?.[DIMENSIONS.TRAP_CAUGHT] || 0,
    }));

  return {
    label:
      trapShare >= 0.3 ? "High Trap Risk" : trapShare >= 0.15 ? "Watch Traps" : "Low Trap Pressure",
    detail:
      trapShare >= 0.3
        ? "Distractors are a major source of errors right now."
        : trapShare >= 0.15
          ? "Trap-style mistakes are showing up often enough to warrant review."
          : "Trap errors are present, but not the main pattern.",
    trapShare: round(trapShare * 100),
    hotspots: trapHotspots,
  };
};

const buildProgressNarrative = (recentQuizzes = [], confidenceProfile, topWeakConcepts = []) => {
  const ordered = [...recentQuizzes].sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""));
  const latest = ordered[0];
  const previous = ordered[1];

  const summarizeQuiz = (quiz) => {
    const results = Array.isArray(quiz?.results) ? quiz.results : [];
    const correct = results.filter((result) => result.isCorrect === true).length;
    const wrong = results.filter((result) => result.isCorrect === false).length;
    const avgTime = round(average(results.map((result) => Number(result.timeTaken) || 0)));
    const accuracy = results.length > 0 ? round((correct / results.length) * 100) : 0;
    return { correct, wrong, avgTime, accuracy };
  };

  if (!latest || !previous) {
    return {
      headline: "Baseline set",
      detail: "Keep practicing and the next scan will reveal a real trend line.",
    };
  }

  const latestStats = summarizeQuiz(latest);
  const previousStats = summarizeQuiz(previous);
  const deltaWrong = previousStats.wrong - latestStats.wrong;
  const deltaAccuracy = latestStats.accuracy - previousStats.accuracy;
  const deltaSpeed = previousStats.avgTime - latestStats.avgTime;

  let headline = "Steady";
  let detail = `Your latest accuracy is ${latestStats.accuracy}% with ${latestStats.wrong} wrong.`;

  if (deltaWrong > 0 && deltaAccuracy >= 0) {
    headline = "Improving";
    detail = `Wrong answers dropped by ${deltaWrong} since the previous session.`;
  } else if (deltaWrong < 0) {
    headline = "Needs attention";
    detail = `The latest session had ${Math.abs(deltaWrong)} more wrong answers than the previous one.`;
  }

  if (confidenceProfile.label === "Panic Prone") {
    detail += " Speed pressure is still part of the problem.";
  } else if (deltaSpeed > 0) {
    detail += ` You are also answering ${deltaSpeed} seconds faster on average.`;
  }

  if ((topWeakConcepts[0]?.totalWrong || 0) >= 5) {
    detail += ` ${topWeakConcepts[0].concept} remains the main anchor point.`;
  }

  return { headline, detail };
};

const buildMistakeCoach = async ({ topWeakConcepts = [], confidenceProfile, trapRadar }) => {
  if (!topWeakConcepts.length) return [];

  const summary = topWeakConcepts.slice(0, 4).map((concept) => ({
    concept: concept.concept,
    topic: concept.topic,
    dominantDimension: concept.dominantDimension,
    totalWrong: concept.totalWrong,
    breakdown: concept.breakdown,
  }));

  const prompt = `Create a concise JSON coaching response for an SSC exam dashboard.
Analytics:\n${JSON.stringify({ summary, confidenceProfile, trapRadar })}\n\nReturn JSON with this exact shape:\n{\n  "mistakeCoach": [\n    {"concept":"","dimension":"","why":"","fix":""}\n  ]\n}\n\nRules:\n- include 3 to 4 items\n- keep each why/fix under 18 words\n- use the dominantDimension where possible\n- if there is no strong signal, explain in plain exam language`;

  const aiResponse = chatJSON(prompt, undefined, "You are a concise SSC exam coach.")
    .then((response) => {
      if (Array.isArray(response?.mistakeCoach) && response.mistakeCoach.length > 0) {
        return response.mistakeCoach.slice(0, 4);
      }
      return null;
    })
    .catch((err) => {
      console.warn("[brain-insights] mistake coach fallback:", err.message);
      return null;
    });

  const timeout = wait(3500).then(() => null);

  const response = await Promise.race([aiResponse, timeout]);
  if (response) return response;

  return summary.slice(0, 4).map((concept) => ({
    concept: concept.concept,
    dimension: concept.dominantDimension,
    why: DIMENSION_FIXES[concept.dominantDimension]?.why || "The pattern needs another review pass.",
    fix: DIMENSION_FIXES[concept.dominantDimension]?.fix || "Rework the concept with one short drill.",
  }));
};

const buildBrainInsights = async ({
  recentQuizzes,
  failureMap,
  topWeakConcepts,
  globalDist,
  totalFailures,
}) => {
  const wrongRows = buildWrongAnswerRows(recentQuizzes);
  const allResults = (recentQuizzes || []).flatMap((quiz) =>
    Array.isArray(quiz?.results)
      ? quiz.results.map((result) => ({
          isCorrect: result?.isCorrect === true,
          selected: result?.selected ?? null,
          timeTaken: Number(result?.timeTaken) || 0,
        }))
      : []
  );

  const subjectHeatmap = buildHeatmap(wrongRows, topWeakConcepts);
  const confidenceProfile = buildConfidenceProfile(allResults);
  const adaptiveNextDrill = buildAdaptiveNextDrill({ topWeakConcepts, globalDist, subjectHeatmap });
  const revisionPack = buildRevisionPack(topWeakConcepts);
  const trapRadar = buildTrapRadar(topWeakConcepts, globalDist);
  const progressNarrative = buildProgressNarrative(recentQuizzes, confidenceProfile, topWeakConcepts);
  const mistakeCoach = await buildMistakeCoach({ topWeakConcepts, confidenceProfile, trapRadar });

  return {
    adaptiveNextDrill,
    mistakeCoach,
    subjectHeatmap,
    confidenceProfile,
    revisionPack,
    trapRadar,
    progressNarrative,
    summary: {
      totalFailures,
      trackedConcepts: Object.keys(failureMap || {}).length,
      weakestSubject: subjectHeatmap[0]?.subject || null,
    },
  };
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
    const insights = await buildBrainInsights({
      recentQuizzes: profile.recentQuizzes || [],
      failureMap,
      topWeakConcepts: topWeak,
      globalDist,
      totalFailures,
    });

    res.json({
      topWeakConcepts: topWeak,
      globalDistribution: globalDist,
      totalConceptsTracked: Object.keys(failureMap).length,
      hasSufficientData: totalFailures > 0,
      lastActiveDate: profile.lastActiveDate,
      source:
        storedFailureTotal > 0 ? "failureMap" : totalFailures > 0 ? "recentQuizzes" : "none",
      insights,
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
