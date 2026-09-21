const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const baseRank = (q, { weakness, recency, isDue, p }) =>
  weakness * 4 + recency + Number(isDue) * 4 + Number(q.sourceType === "pyq");

const adaptiveOnAnswer = (s, q, a, { policy, adaptiveTargetDifficulty }, mode = "adaptive") => {
  const topicKey = `${q.subject} / ${q.topic}`;
  const target = adaptiveTargetDifficulty({
    question: q,
    answer: a,
    mastery: s.baseline?.[topicKey] ?? 0.5,
    mode: mode,
  });
  const blockEnd =
    s.mode === "mission" && q.trainingBlockId
      ? s.questions.findIndex(
          (item, index) =>
            index >= s.current &&
            item.trainingBlockId !== q.trainingBlockId,
        )
      : -1;
  const endExclusive = blockEnd === -1 ? s.questions.length : blockEnd;
  const remaining = s.questions.slice(s.current, endExclusive);
  remaining.sort(
    (x, y) =>
      Math.abs(x.difficulty - target) - Math.abs(y.difficulty - target),
  );
  s.questions.splice(s.current, remaining.length, ...remaining);
};

const modeStrategies = {
  adaptive: {
    rankCandidate: baseRank,
    targetDifficulty: ({ ability, position }) => ability + [0, 0, -1, 0, 1][position % 5],
    afterAdvance: adaptiveOnAnswer,
  },
  sprint: {
    rankCandidate: (q, { mastery, p }) =>
      mastery * 4 + clamp((p?.seconds || q.expectedTime) / Math.max(1, q.expectedTime) - 1, 0, 2) * mastery * 3,
    targetDifficulty: ({ ability }) => Math.min(3, ability),
  },
  section: {
    rankCandidate: (q, { weakness, recency }) =>
      weakness * 0.5 + recency + Number(q.sourceType === "pyq"),
    targetDifficulty: ({ position }) => [2, 3, 1, 3, 4][position % 5],
  },
  pressure: {
    rankCandidate: (q, { weakness, recency }) =>
      weakness * 0.5 + recency + Number(q.sourceType === "pyq"),
    targetDifficulty: ({ position }) => [2, 3, 1, 3, 4][position % 5],
  },
  challenge: {
    rankCandidate: (q, ctx) => baseRank(q, ctx) + clamp(Number(q.discrimination) || 0, 0, 1) * 2,
    targetDifficulty: ({ ability, position, progress }) =>
      (position + 1) % 5 === 0 ? ability - 1 : ability + progress * (5 - ability),
    orderQuestions: (selected) => selected.sort((a, b) => a.difficulty - b.difficulty),
    afterAdvance: (s, q, a, ctx) => {
      adaptiveOnAnswer(s, q, a, ctx, "challenge");
      const blockEnd =
        s.mode === "mission" && q.trainingBlockId
          ? s.questions.findIndex(
              (item, index) =>
                index >= s.current &&
                item.trainingBlockId !== q.trainingBlockId,
            )
          : -1;
      const endExclusive = blockEnd === -1 ? s.questions.length : blockEnd;
      const remaining = s.questions.slice(s.current, endExclusive);
      if (s.current % (ctx.policy.challengeCheckInterval || 5) === 4) {
        remaining.sort((x, y) => x.difficulty - y.difficulty);
      }
      s.questions.splice(s.current, remaining.length, ...remaining);
    }
  },
  nightmare: {
    rankCandidate: (q, ctx) => baseRank(q, ctx) + clamp(Number(q.discrimination) || 0, 0, 1) * 2,
    targetDifficulty: ({ ability, progress }) =>
      Math.max(3, ability) + progress * (5 - Math.max(3, ability)),
    orderQuestions: (selected) => selected.sort((a, b) => a.difficulty - b.difficulty),
    afterAdvance: (s, q, a, ctx) => adaptiveOnAnswer(s, q, a, ctx, "nightmare")
  },
  survival: {
    rankCandidate: baseRank,
    targetDifficulty: ({ progress }) => 2 + progress * 3,
    orderQuestions: (selected) => selected.sort((a, b) => a.difficulty - b.difficulty),
    beforeAdvance: (s, q, a, { policy }) => {
      if (a.choice !== q.correctIndex) s.lives--;
      s.slowStreak =
        a.choice !== null &&
        a.seconds > q.expectedTime * (policy.slowPenaltyThreshold || 1.5)
          ? (s.slowStreak || 0) + 1
          : 0;
      if (s.slowStreak >= 2) {
        s.lives--;
        s.slowStreak = 0;
      }
    }
  },
  gauntlet: {
    rankCandidate: baseRank,
    targetDifficulty: ({ position }) => [2, 3, 1, 3, 4][position % 5],
    orderQuestions: (selected, { masteryFor, skills, topicKey }) =>
      selected.sort((a, b) => {
        const aMastery = masteryFor(skills.get(topicKey(a)));
        const bMastery = masteryFor(skills.get(topicKey(b)));
        return aMastery - bMastery || a.topic.localeCompare(b.topic) || a.difficulty - b.difficulty;
      }),
    beforeAdvance: (s, q, a, ctx) => {
      if (
        !q.recoveryFor &&
        s.questions[s.current + 1]?.topic !== q.topic &&
        (s.recoveredTopics || []).length < 3 &&
        !(s.recoveredTopics || []).includes(q.topic)
      ) {
        const block = s.questions
          .slice(0, s.current + 1)
          .filter((item) => item.topic === q.topic);
        const accuracy =
          block.filter(
            (item) => s.answers[item.id]?.choice === item.correctIndex,
          ).length / block.length;
        if (block.length >= 3 && accuracy < 0.5) {
          const recovery = (s.reserve || [])
            .filter(
              (item) =>
                item.topic === q.topic && item.difficulty <= q.difficulty,
            )
            .slice(0, 2)
            .map((item) => ({
              ...item,
              recoveryFor: q.topic,
              trainingBlock: `Recovery: ${q.topic}`,
            }));
          if (recovery.length) {
            s.questions.splice(s.current + 1, 0, ...recovery);
            s.reserve = s.reserve.filter(
              (item) => !recovery.some((r) => r.id === item.id),
            );
            s.recoveredTopics = [...(s.recoveredTopics || []), q.topic];
          }
        }
      }
    }
  },
  review: {
    rankCandidate: (q, { isDue }) => (isDue ? 100 : -100),
    targetDifficulty: ({ ability }) => ability, // Doesn't matter, difficultyFit will be 0 in selectQuestions
    ignoreDifficultyFit: true,
  },
};

export function getStrategy(mode) {
  return modeStrategies[mode] || modeStrategies.adaptive;
}
