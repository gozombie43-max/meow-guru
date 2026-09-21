import { canNavigateMode, effectiveTrainingMode, publicModePolicy } from "../../trainingModePolicy.js";

export function publicSession(s, now = Date.now()) {
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
    questions: s.questions.map(({ correctIndex, solution, ...q }) =>
      s.status === "completed" ? { ...q, correctIndex, solution } : q,
    ),
  };
}
