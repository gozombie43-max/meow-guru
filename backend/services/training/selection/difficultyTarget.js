const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function adaptiveTargetDifficulty({
  question,
  answer,
  mastery = 0.5,
  mode = "adaptive",
}) {
  const floor = mode === "nightmare" ? 3 : 1;
  const masteryValue = Number(mastery);
  const normalizedMastery = Number.isFinite(masteryValue)
    ? clamp(masteryValue, 0, 1)
    : 0.5;
  const abilityTarget = 1 + normalizedMastery * 4;
  const correct = answer.choice === question.correctIndex;
  const confidenceAdjustment = correct
    ? answer.confidence === "guess"
      ? 0
      : answer.confidence === "unsure"
        ? 0.25
        : 0.65
    : answer.confidence === "sure"
      ? -1
      : -0.65;
  const paceRatio = answer.seconds / Math.max(1, question.expectedTime);
  const paceAdjustment = correct
    ? paceRatio <= 1
      ? 0.25
      : paceRatio > 1.5
        ? -0.2
        : 0
    : paceRatio > 1.5
      ? -0.25
      : 0;
  const challengeAdjustment = mode === "challenge" ? 0.35 : 0;
  return clamp(
    Math.round(
      question.difficulty * 0.45 +
        abilityTarget * 0.55 +
        confidenceAdjustment +
        paceAdjustment +
        challengeAdjustment,
    ),
    floor,
    5,
  );
}
