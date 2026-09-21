import {
  findOwnedSession,
  commitTrainingTransition,
} from "../../../repositories/trainingRepository.js";
import { transition } from "../../trainingEngine.js";
import { logger, hashId } from "../../../infrastructure/logger.js";
import { publicActionDelta, publicSession } from '../serializers/publicSession.js';

export async function applyTrainingActionCommand(userId, sessionId, action, delta = false) {
  const s = await findOwnedSession(sessionId, userId);
  if (!s) throw new Error("Session not found");
  if (s.status !== "active") return delta ? publicSession(s) : s;
  if (s.revision !== action.revision) {
    logger.warn({ event: "training.action.revision_conflict", sessionId, userId: hashId(userId), actionType: action.type });
    throw new Error("Session changed. Reload before continuing.");
  }
  if (s.events.length >= 2000 && !["finish", "abandon"].includes(action.type))
    throw new Error("Session action limit reached. Finish this session.");
  
  const updated = transition(s, action);
  
  const start = performance.now();
  let write;
  try {
    write = await commitTrainingTransition(s, updated);
  } catch (error) {
    logger.error({ event: "training.learning.commit.failure", sessionId, userId: hashId(userId), error: error.message });
    throw error;
  }
  const commitDuration = Math.round(performance.now() - start);
  
  if (!write.modifiedCount) {
    logger.warn({ event: "training.action.revision_conflict", sessionId, userId: hashId(userId), actionType: action.type });
    throw new Error("Session changed. Reload before continuing.");
  }
  
  if (updated.status !== s.status) {
    logger.info({
      event: updated.status === "abandoned" ? "training.session.abandoned" : "training.session.completed",
      sessionId,
      userId: hashId(userId),
      mode: updated.mode,
    });
  }
  
  logger.info({
    event: "training.learning.commit.duration_ms",
    durationMs: commitDuration,
    sessionId,
  }, "Committed training state");
  
  return delta ? publicActionDelta(s, updated) : updated;
}
