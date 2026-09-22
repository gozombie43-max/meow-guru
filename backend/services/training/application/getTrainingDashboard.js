import {
  trainingHistory as history,
  expiredActiveSessions,
  trainingDashboardData,
  commitTrainingTransition,
} from "../../../repositories/trainingRepository.js";
import {
  buildIntelligence,
  transition,
  readinessWithEvidence,
  mergeDurableIntelligence,
} from "../../trainingEngine.js";
import { getDailyMissionBlocks } from "../mission/missionBlocks.js";
import { logger, hashId } from "../../../infrastructure/logger.js";

export async function getTrainingDashboardData(userId, exam) {
  const start = performance.now();
  const expired = await expiredActiveSessions(userId, exam);
  for (const stale of expired) {
    const finalized = transition(stale, { type: "finish" });
    await commitTrainingTransition(stale, finalized);
  }

  const [previous, dashboard] = await Promise.all([history(userId, exam), trainingDashboardData(userId, exam)]);
  const {
    active,
    catalogPairs,
    mocks,
    reviewRows,
    skillRows,
    stateMeta,
  } = dashboard;
  const subjects = [...new Set(catalogPairs.map((item) => item.subject))];
  const topics = [...new Set(catalogPairs.map((item) => item.topic))];

  let intelligence = mergeDurableIntelligence(
    buildIntelligence(previous, Date.now(), stateMeta?.version === 1 && stateMeta?.status === 'ready'),
    skillRows,
    reviewRows,
  );

  intelligence = readinessWithEvidence(intelligence, previous, topics, mocks);
  const trainedTopics = new Set(intelligence.topics.map((item) => item.topic));
  const coverageRatio = topics.length
    ? topics.filter((topic) => trainedTopics.has(topic)).length / topics.length
    : 0;
  const recentDays = new Set(
    previous
      .filter((session) => Date.now() - new Date(session.completedAt).getTime() <= 7 * 86400000)
      .map((session) => String(session.completedAt).slice(0, 10)),
  ).size;
  const confidenceScore =
    Math.min(1, intelligence.attempts / 200) * 0.45 +
    coverageRatio * 0.25 +
    Math.min(1, mocks.length / 5) * 0.2 +
    Math.min(1, recentDays / 7) * 0.1;
  const evidenceConfidence =
    confidenceScore >= 0.72 ? "high" : confidenceScore >= 0.4 ? "medium" : "low";

  const blocks = getDailyMissionBlocks(intelligence);
  const mission = blocks.map(({ mode, count, label }) => ({ mode, count, label }));

  logger.info({
    event: "training.dashboard.duration_ms",
    durationMs: Math.round(performance.now() - start),
    userId: hashId(userId),
    exam,
  }, "Dashboard generated");

  return {
    ...intelligence,
    evidenceConfidence,
    confidenceScore: Math.round(confidenceScore * 100),
    active,
    subjects,
    catalogTopics: topics,
    catalog: catalogPairs,
    mission,
    history: previous.slice(0, 20).map((s) => ({
      id: s.id,
      mode: s.mode,
      at: s.completedAt,
      score: s.result.score,
      maxScore: s.result.maxScore,
      accuracy: s.result.accuracy,
      completionReason: s.completionReason || "submitted",
    })),
    personalBest: Math.max(
      0,
      ...previous
        .filter((s) => s.mode === "survival")
        .map((s) => s.result.correct),
    ),
  };
}
