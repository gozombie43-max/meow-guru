import { canNavigateMode, effectiveTrainingMode, getTrainingModePolicy } from "../../trainingModePolicy.js";
import { getStrategy } from "../selection/modeStrategies.js";
import { adaptiveTargetDifficulty } from "../selection/difficultyTarget.js";
import { resultFor } from "./scoring.js";

export function transition(session, action, now = Date.now()) {
  const s = structuredClone(session);
  if (s.status !== "active") return s;
  const expired = now >= new Date(s.deadline).getTime();
  const q = s.questions[s.current];
  const mode = effectiveTrainingMode(s, q);
  const policy = getTrainingModePolicy(mode);
  const strategy = getStrategy(mode);
  
  const elapsed = Math.max(
    0,
    (Math.min(now, new Date(s.deadline).getTime()) - s.lastEventAt) / 1000,
  );
  const a = s.answers[q.id] || { choice: null, seconds: 0, confidence: null };
  a.seconds += elapsed;
  s.answers[q.id] = a;
  s.lastEventAt = now;
  if (!expired && action.type === "answer") {
    if (
      action.choice !== null &&
      (!Number.isInteger(action.choice) ||
        action.choice < 0 ||
        action.choice >= q.options.length)
    )
      throw new Error("Invalid answer");
    if (
      action.confidence &&
      !["sure", "unsure", "guess"].includes(action.confidence)
    )
      throw new Error("Invalid confidence");
    a.choice = action.choice;
    a.confidence = action.confidence || null;
    a.at = now;
    s.events.push({ type: "answer", questionId: q.id, at: now });
    if (strategy.beforeAdvance) {
      strategy.beforeAdvance(s, q, a, { policy, adaptiveTargetDifficulty });
    }

    if (
      canNavigateMode(mode) &&
      s.mode === "mission" &&
      a.choice !== null
    ) {
      const blockId = q.trainingBlockId;
      const nextInBlock = s.questions.findIndex(
        (item, index) =>
          index > s.current &&
          (!blockId || item.trainingBlockId === blockId) &&
          s.answers[item.id]?.choice == null,
      );
      if (nextInBlock !== -1) {
        s.current = nextInBlock;
      } else if (s.current < s.questions.length - 1) {
        const nextBlock = s.questions.findIndex(
          (item, index) =>
            index > s.current &&
            (!blockId || item.trainingBlockId !== blockId),
        );
        if (nextBlock !== -1) s.current = nextBlock;
      } else {
        action = { type: "finish" };
      }
    }
    if (!canNavigateMode(mode)) {
      if (s.current === s.questions.length - 1) action = { type: "finish" };
      else {
        s.current++;
        if (strategy.afterAdvance) {
          strategy.afterAdvance(s, q, a, { policy, adaptiveTargetDifficulty });
        }
      }
    }
  }
  if (!expired && action.type === "visit") {
    if (!canNavigateMode(mode))
      throw new Error("This mode moves forward only");
    if (
      !Number.isInteger(action.index) ||
      action.index < 0 ||
      action.index >= s.questions.length
    )
      throw new Error("Invalid question");
    if (
      s.mode === "mission" &&
      q.trainingBlockId &&
      s.questions[action.index]?.trainingBlockId !== q.trainingBlockId
    )
      throw new Error("Mission navigation stays inside the current block");
    s.current = action.index;
    s.events.push({
      type: "visit",
      questionId: s.questions[s.current].id,
      at: now,
    });
  }
  if (!expired && action.type === "abandon") {
    s.status = "abandoned";
    s.completedAt = new Date(now).toISOString();
    s.completionReason = "abandoned";
    s.result = null;
  } else if (expired || action.type === "finish" || s.lives <= 0) {
    s.status = "completed";
    s.completedAt = expired ? s.deadline : new Date(now).toISOString();
    s.completionReason = expired
      ? "timeout"
      : s.lives <= 0
        ? "survival_lives"
        : "submitted";
    s.result = resultFor(s);
  }
  s.revision++;
  return s;
}
