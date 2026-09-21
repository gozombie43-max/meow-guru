const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function readinessWithEvidence(
  intelligence,
  sessions,
  catalogTopics,
  mocks,
) {
  const rows = sessions
    .flatMap((s) => s.result?.rows || [])
    .filter((r) => r.attempted);
  const trained = new Set(intelligence.topics.map((p) => p.topic));
  const coverage = catalogTopics.length
    ? catalogTopics.filter((t) => trained.has(t)).length / catalogTopics.length
    : 0;
  const questions = sessions.flatMap((s) =>
    s.questions.filter((q) => s.answers[q.id]?.choice === q.correctIndex),
  );
  const difficulty = questions.length
    ? questions.reduce((n, q) => n + q.difficulty / 5, 0) / questions.length
    : 0;
  const mockScores = mocks
    .map((m) => m.result)
    .filter((r) => r && Number(r.maxScore) > 0)
    .map((r) => clamp(Number(r.totalScore) / Number(r.maxScore), 0, 1));
  const positive = sessions.reduce((n, s) => n + (s.result?.maxScore || 0), 0);
  const losses = sessions.reduce(
    (n, s) => n + (s.result?.negativeLoss || 0),
    0,
  );
  const factors = {
    ...intelligence.factors,
    catalogCoverage: Math.round(coverage * 100),
    difficulty: Math.round(difficulty * 100),
    mockPerformance: mockScores.length
      ? Math.round(
          (mockScores.reduce((n, v) => n + v, 0) / mockScores.length) * 100,
        )
      : 0,
    negativeMarking: rows.length
      ? Math.round((1 - Math.min(1, losses / Math.max(1, positive))) * 100)
      : 0,
  };
  const weights = {
    accuracy: 0.2,
    mastery: 0.2,
    speed: 0.15,
    catalogCoverage: 0.1,
    difficulty: 0.1,
    mockPerformance: 0.1,
    consistency: 0.1,
    negativeMarking: 0.05,
  };
  return {
    ...intelligence,
    factors,
    weights,
    readiness:
      intelligence.attempts >= 30
        ? Math.round(
            Object.entries(weights).reduce(
              (n, [key, weight]) => n + factors[key] * weight,
              0,
            ),
          )
        : null,
    evidence: `Provisional estimate from ${sessions.length} recent training sessions and ${mockScores.length} scored mocks. Coverage is against catalog topics, not a verified complete syllabus. Missing mock evidence contributes zero.`,
  };
}
