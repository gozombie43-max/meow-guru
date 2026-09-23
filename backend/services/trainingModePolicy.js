export const TRAINING_MODES = [
  "adaptive",
  "challenge",
  "sprint",
  "pressure",
  "section",
  "gauntlet",
  "nightmare",
  "survival",
];

export const TRAINING_EXAMS = [
  { id: "ssc-cgl", label: "SSC CGL" },
  { id: "ssc-chsl", label: "SSC CHSL" },
  { id: "cat", label: "CAT" },
];

const base = {
  navigation: "forward",
  confidence: true,
  sectional: false,
  requiresSubject: false,
  supportsFullSection: false,
  supportsTier: false,
  clockMultiplier: 1.2,
  minDifficulty: 1,
  lives: null,
};

export const TRAINING_MODE_POLICIES = {
  adaptive: {
    ...base,
    id: "adaptive",
    selection: "adaptive",
    adaptiveDifficulty: true,
  },
  challenge: {
    ...base,
    id: "challenge",
    selection: "challenge",
    adaptiveDifficulty: true,
    challengeCheckInterval: 5,
    supportsTier: true,
  },
  sprint: {
    ...base,
    id: "sprint",
    selection: "sprint",
    clock: "fixed",
    minuteOptions: [5, 10, 15],
  },
  pressure: {
    ...base,
    id: "pressure",
    selection: "pressure",
    navigation: "free",
    clockMultiplier: 0.7,
  },
  section: {
    ...base,
    id: "section",
    selection: "section",
    navigation: "free",
    sectional: true,
    requiresSubject: true,
    supportsFullSection: true,
    supportsTier: true,
  },
  gauntlet: {
    ...base,
    id: "gauntlet",
    selection: "gauntlet",
    sectional: true,
    requiresSubject: true,
    supportsFullSection: true,
    supportsTier: true,
    recoveryBlocks: true,
  },
  nightmare: {
    ...base,
    id: "nightmare",
    selection: "nightmare",
    adaptiveDifficulty: true,
    confidence: false,
    clockMultiplier: 0.85,
    minDifficulty: 3,
    supportsTier: true,
  },
  survival: {
    ...base,
    id: "survival",
    selection: "survival",
    confidence: false,
    minDifficulty: 2,
    lives: 3,
    slowPenaltyThreshold: 1.5,
    supportsTier: true,
  },
  review: {
    ...base,
    id: "review",
    selection: "review",
  },
  mission: {
    ...base,
    id: "mission",
    selection: "mission",
  },
};

export const getTrainingModePolicy = (mode) =>
  TRAINING_MODE_POLICIES[mode] || TRAINING_MODE_POLICIES.adaptive;

export function effectiveTrainingMode(session, question) {
  if (session?.mode === "mission" && question?.trainingMode) {
    return question.trainingMode;
  }
  return session?.mode || "adaptive";
}

export const canNavigateMode = (mode) =>
  getTrainingModePolicy(mode).navigation === "free";

export function publicModePolicy(mode) {
  const policy = getTrainingModePolicy(mode);
  return {
    id: policy.id,
    navigation: policy.navigation,
    confidence: policy.confidence,
    sectional: policy.sectional,
    requiresSubject: policy.requiresSubject,
    supportsFullSection: policy.supportsFullSection,
    supportsTier: policy.supportsTier,
    clock: policy.clock || "target",
    clockMultiplier: policy.clockMultiplier,
    minuteOptions: policy.minuteOptions || [],
    minDifficulty: policy.minDifficulty,
    lives: policy.lives,
  };
}
