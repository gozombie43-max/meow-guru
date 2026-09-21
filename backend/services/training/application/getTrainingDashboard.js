import {
  trainingHistory as history,
  expiredActiveSessions,
  trainingDashboardData,
  saveSkillProfile,
  commitTrainingTransition,
} from "../../../repositories/trainingRepository.js";
import {
  buildIntelligence,
  transition,
  readinessWithEvidence,
  mergeDurableIntelligence,
} from "../../trainingEngine.js";

export async function getTrainingDashboardData(userId, exam) {
  const expired = await expiredActiveSessions(userId, exam);
  for (const stale of expired) {
    const finalized = transition(stale, { type: "finish" });
    await commitTrainingTransition(stale, finalized);
  }

  const previous = await history(userId, exam);
  let intelligence = buildIntelligence(previous);
  const {
    active,
    catalogPairs,
    mocks,
    reviewRows,
    skillRows,
  } = await trainingDashboardData(userId, exam);
  const subjects = [...new Set(catalogPairs.map((item) => item.subject))];
  const topics = [...new Set(catalogPairs.map((item) => item.topic))];

  intelligence = mergeDurableIntelligence(
    intelligence,
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

  await saveSkillProfile(userId, exam, {
    ...intelligence,
    evidenceConfidence,
    confidenceScore,
  });

  const weak = intelligence.topics[0];
  const mission = [
    {
      mode: "adaptive",
      count: 10,
      label: weak ? `Strengthen ${weak.topic}` : "Build your skill baseline",
    },
    { mode: "sprint", count: 8, label: "Train execution speed" },
    ...(intelligence.due.length
      ? [{
          mode: "review",
          count: Math.min(5, intelligence.due.length),
          label: "Review due mistakes",
        }]
      : []),
    { mode: "section", count: 10, label: "Previous-year practice" },
    { mode: "adaptive", count: 9, label: "Consolidate with a mixed block" },
  ];

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
