import {
  findOwnedSession,
  commitTrainingTransition,
} from "../../../repositories/trainingRepository.js";
import { transition } from "../../trainingEngine.js";

export async function applyTrainingActionCommand(userId, sessionId, action) {
  const s = await findOwnedSession(sessionId, userId);
  if (!s) throw new Error("Session not found");
  if (s.status !== "active") return s;
  if (s.revision !== action.revision)
    throw new Error("Session changed. Reload before continuing.");
  if (s.events.length >= 2000 && !["finish", "abandon"].includes(action.type))
    throw new Error("Session action limit reached. Finish this session.");
  const updated = transition(s, action);
  const write = await commitTrainingTransition(s, updated);
  if (!write.modifiedCount)
    throw new Error("Session changed. Reload before continuing.");
  return updated;
}
