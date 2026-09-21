import { canNavigateMode, effectiveTrainingMode, publicModePolicy } from "../../trainingModePolicy.js";

export function publicSession(s, now = Date.now(), includeQuestions = true) {
  const currentQuestion = s.questions[s.current] || s.questions.at(-1);
  const effectiveMode = effectiveTrainingMode(s, currentQuestion);
  const currentBlock = currentQuestion?.trainingBlockId || null;
  const allowedVisitIndices = canNavigateMode(effectiveMode)
    ? s.questions
        .map((question, index) => ({ question, index }))
        .filter(({ question }) =>
          s.mode !== "mission" ||
          !currentBlock ||
          question.trainingBlockId === currentBlock,
        )
        .map(({ index }) => index)
    : [];
  return {
    id: s.id,
    mode: s.mode,
    effectiveMode,
    policy: publicModePolicy(effectiveMode),
    allowedVisitIndices,
    exam: s.exam,
    revision: s.revision,
    status: s.status,
    completionReason: s.completionReason || null,
    current: s.current,
    duration: s.duration,
    deadline: s.deadline,
    serverNow: now,
    lastEventAt: s.lastEventAt,
    lives: s.lives,
    marking: s.marking,
    answers: s.answers,
    result: s.result || null,
    ...(includeQuestions ? { questions: s.questions.map(({ correctIndex, solution, ...q }) =>
      s.status === "completed" ? { ...q, correctIndex, solution } : q,
    ) } : {}),
  };
}

export function publicActionDelta(previous, updated, now = Date.now()) {
  // Completion reveals solutions once. Replayed terminal actions also return a
  // complete snapshot so clients can recover from an uncertain previous save.
  if (updated.status !== 'active') return publicSession(updated, now);
  const { answers, ...state } = publicSession(updated, now, false);
  const changedAnswers = Object.fromEntries(Object.entries(answers)
    .filter(([id, answer]) => answer !== previous.answers[id]));
  const oldQuestions = new Map(previous.questions.map(q => [q.id, q]));
  const questionUpdates = updated.questions.filter(q => oldQuestions.get(q.id) !== q)
    .map(({ correctIndex: _correctIndex, solution: _solution, ...q }) => q);
  const reordered = previous.questions.length !== updated.questions.length ||
    updated.questions.some((q, i) => q.id !== previous.questions[i]?.id);
  return {
    kind: 'delta', baseRevision: previous.revision, ...state,
    answers: changedAnswers,
    ...(reordered ? { questionOrder: updated.questions.map(q => q.id) } : {}),
    ...(questionUpdates.length ? { questionUpdates } : {}),
  };
}
