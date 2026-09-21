import { effectiveTrainingMode } from "../../trainingModePolicy.js";

export const MISTAKES = [
  "Concept Gap",
  "Calculation Error",
  "Misread",
  "Memory/Formula",
  "Bad Elimination",
  "Time Management",
  "Guessing",
];

export function resultFor(s) {
  const rows = s.questions.map((q, index) => {
    const a = s.answers[q.id];
    const attempted = a?.choice !== null && a?.choice !== undefined;
    const correct = attempted && a.choice === q.correctIndex;
    return {
      questionId: q.id,
      number: index + 1,
      topic: q.topic,
      attempted,
      correct,
      choice: a?.choice ?? null,
      correctIndex: q.correctIndex,
      seconds: a?.seconds || 0,
      target: q.expectedTime,
      confidence: a?.confidence || null,
      mistake: a?.mistake || null,
      solution: q.solution,
      score: correct ? s.marking.correct : attempted ? -s.marking.wrong : 0,
    };
  });
  const attempted = rows.filter((r) => r.attempted),
    correct = attempted.filter((r) => r.correct).length;
  const findings = rows
    .filter((r) => !r.correct && r.seconds > r.target)
    .map(
      (r) =>
        `Q${r.number}: ${Math.round(r.seconds)}s invested without a correct answer; target ${r.target}s. Try an earlier skip.`,
    );
  const untouched = rows.filter(
    (r) => !r.attempted && s.questions[r.number - 1].difficulty <= 2,
  ).length;
  if (untouched)
    findings.push(
      `${untouched} easy/medium questions left unanswered. Scan these first next time.`,
    );
  const revisits =
    s.events.filter((e) => e.type === "visit").length -
    new Set(s.events.filter((e) => e.type === "visit").map((e) => e.questionId))
      .size;
  if (revisits > 0)
    findings.push(
      `${revisits} revisits. Check whether returning improved your final choices.`,
    );
  const last = attempted.filter(
    (r) =>
      (s.answers[r.questionId]?.at || 0) >=
      new Date(s.startedAt).getTime() + s.duration * 800,
  );
  if (last.length >= 3)
    findings.push(
      `Final fifth of the clock: ${Math.round((last.filter((r) => r.correct).length / last.length) * 100)}% accuracy across ${last.length} attempts.`,
    );
  let streak = 0,
    bestStreak = 0,
    modePoints = 0;
  for (const row of rows) {
    if (row.correct) {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      modePoints += Math.round(
        10 *
          s.questions[row.number - 1].difficulty *
          Math.min(2, row.target / Math.max(1, row.seconds)) *
          (1 + Math.min(streak, 10) / 10),
      );
    } else {
      streak = 0;
      if (
        effectiveTrainingMode(s, s.questions[row.number - 1]) === "sprint" &&
        !row.attempted
      )
        modePoints -= 5;
    }
  }
  const elapsed = Math.max(
    1,
    (new Date(s.completedAt || s.deadline).getTime() -
      new Date(s.startedAt).getTime()) /
      60000,
  );
  const blockMap = new Map();
  for (const row of rows) {
    const question = s.questions[row.number - 1];
    if (!question.trainingBlock) continue;
    const key = question.trainingBlockId || question.trainingBlock;
    const block = blockMap.get(key) || {
      id: key,
      label: question.trainingBlock,
      mode: question.trainingMode || s.mode,
      attempted: 0,
      correct: 0,
      seconds: 0,
      questions: 0,
    };
    block.questions++;
    block.attempted += Number(row.attempted);
    block.correct += Number(row.correct);
    block.seconds += row.seconds;
    blockMap.set(key, block);
  }
  const blockBreakdown = [...blockMap.values()].map((block) => ({
    ...block,
    accuracy: block.attempted
      ? Math.round((block.correct / block.attempted) * 100)
      : 0,
    averageSeconds: block.attempted
      ? Math.round(block.seconds / block.attempted)
      : 0,
  }));

  const mastery = new Map();
  for (const row of rows.filter((r) => r.attempted)) {
    const q = s.questions[row.number - 1],
      key = `${q.subject} / ${q.topic}`;
    const before = s.baseline?.[key] ?? 0.5;
    const item = mastery.get(key) || {
      key,
      topic: q.topic,
      before,
      after: before,
    };
    item.after =
      0.8 * item.after +
      0.2 *
        (row.correct
          ? row.confidence === "guess"
            ? 0.25
            : row.confidence === "unsure"
              ? 0.6
              : 1
          : 0);
    mastery.set(key, item);
  }
  return {
    rows,
    blockBreakdown,
    masteryDelta: [...mastery.values()].map((p) => ({
      ...p,
      before: Math.round(p.before * 100),
      after: Math.round(p.after * 100),
      delta: Math.round((p.after - p.before) * 100),
    })),
    attempted: attempted.length,
    correct,
    accuracy: attempted.length
      ? Math.round((correct / attempted.length) * 100)
      : 0,
    modePoints: Math.max(0, modePoints),
    bestStreak,
    questionsPerMinute: Math.round((attempted.length / elapsed) * 100) / 100,
    score: rows.reduce((n, r) => n + r.score, 0),
    maxScore: s.questions.length * s.marking.correct,
    negativeLoss: attempted.filter((r) => !r.correct).length * s.marking.wrong,
    secondsSaved: Math.round(
      attempted.reduce((n, r) => n + r.target - r.seconds, 0),
    ),
    averageSeconds: attempted.length
      ? Math.round(
          attempted.reduce((n, r) => n + r.seconds, 0) / attempted.length,
        )
      : 0,
    findings,
    failureMap: Object.fromEntries(
      MISTAKES.map((m) => [m, rows.filter((r) => r.mistake === m).length]),
    ),
  };
}
