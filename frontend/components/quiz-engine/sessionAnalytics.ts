import type { SessionResult } from "./types";

export type SessionStats = {
  correct: number;
  wrong: number;
  accuracy: number;
  avgTime: number;
};

export type WeakConcept = {
  concept: string;
  accuracy: number;
};

export function buildSessionAnalytics(results: SessionResult[]): {
  stats: SessionStats;
  weakConcepts: WeakConcept[];
} {
  const correct = results.filter((result) => result.isCorrect).length;
  const wrong = results.filter(
    (result) => !result.isCorrect && result.selected !== null
  ).length;
  const attempted = results.length;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const avgTime =
    attempted > 0
      ? Math.round(
          results.reduce((total, result) => total + result.timeTaken, 0) /
            attempted
        )
      : 0;

  const conceptStats = new Map<string, { correct: number; total: number }>();
  for (const result of results) {
    const current = conceptStats.get(result.concept) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (result.isCorrect) current.correct += 1;
    conceptStats.set(result.concept, current);
  }

  const weakConcepts = Array.from(conceptStats, ([concept, conceptResult]) => ({
    concept,
    accuracy: Math.round((conceptResult.correct / conceptResult.total) * 100),
    total: conceptResult.total,
  }))
    .filter((concept) => concept.total >= 2 && concept.accuracy < 50)
    .map(({ concept, accuracy: conceptAccuracy }) => ({
      concept,
      accuracy: conceptAccuracy,
    }));

  return {
    stats: { correct, wrong, accuracy, avgTime },
    weakConcepts,
  };
}
