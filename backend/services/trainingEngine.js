import { TRAINING_MODES, TRAINING_EXAMS } from "./trainingModePolicy.js";

export const MODES = TRAINING_MODES;
export const EXAMS = TRAINING_EXAMS.map((exam) => exam.id);

export { normalizeQuestion } from "./training/domain/questionNormalizer.js";
export { buildIntelligence, mergeDurableIntelligence } from "./training/domain/mastery.js";
export { readinessWithEvidence } from "./training/domain/readiness.js";
export { MISTAKES, resultFor } from "./training/domain/scoring.js";
export { transition } from "./training/domain/sessionStateMachine.js";

export { adaptiveTargetDifficulty } from "./training/selection/difficultyTarget.js";
export { selectQuestions } from "./training/selection/candidateRanker.js";

export { publicSession } from "./training/serializers/publicSession.js";
