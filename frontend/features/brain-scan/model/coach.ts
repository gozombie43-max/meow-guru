import type { WeakConcept,useBrainScan } from "@/hooks/useCognitiveMapper";
type DimensionMeta = {
  label: string;
  color: string;
  bg: string;
  accent: string;
  summary: string;
};

const DIMENSION_META: Record<string, DimensionMeta> = {
  CONCEPTUAL_GAP: {
    label: "Conceptual gap",
    color: "#9A3412",
    bg: "#FFF4EC",
    accent: "#F97316",
    summary: "The rule is missing or not stable yet.",
  },
  APPLICATION_ERROR: {
    label: "Application error",
    color: "#166534",
    bg: "#ECFDF3",
    accent: "#22C55E",
    summary: "You know the idea, but the method breaks while solving.",
  },
  TRAP_CAUGHT: {
    label: "Trap caught",
    color: "#075985",
    bg: "#ECFEFF",
    accent: "#06B6D4",
    summary: "A distractor or shortcut looked more convincing than it should.",
  },
  SPEED_PANIC: {
    label: "Speed panic",
    color: "#7C2D12",
    bg: "#FFF7ED",
    accent: "#FB923C",
    summary: "Time pressure or answer switching caused the miss.",
  },
  BLIND_SPOT: {
    label: "Blind spot",
    color: "#4338CA",
    bg: "#EEF2FF",
    accent: "#6366F1",
    summary: "You skipped, guessed, or moved too fast to engage the question.",
  },
};

const FALLBACK_META: DimensionMeta = {
  label: "Unclear pattern",
  color: "#475569",
  bg: "#F8FAFC",
  accent: "#94A3B8",
  summary: "This pattern still needs more attempts to classify well.",
};

const DIMENSION_ORDER = [
  "CONCEPTUAL_GAP",
  "APPLICATION_ERROR",
  "TRAP_CAUGHT",
  "SPEED_PANIC",
  "BLIND_SPOT",
];

const EMPTY_DISTRIBUTION = DIMENSION_ORDER.reduce<Record<string, number>>((acc, key) => {
  acc[key] = 0;
  return acc;
}, {});

export const PRESCRIPTION: Record<string, string> = {
  CONCEPTUAL_GAP: "Study the concept first, then do 10 easy questions.",
  APPLICATION_ERROR: "Do 15 medium questions with step-by-step solution review.",
  TRAP_CAUGHT: "Practice 10 misleading SSC-style questions and explain the trap.",
  SPEED_PANIC: "Solve 10 timed questions and do not change the first answer.",
  BLIND_SPOT: "Force yourself to explain the question before answering.",
};


export function getDimensionMeta(dimension: string) {
  return DIMENSION_META[dimension] || FALLBACK_META;
}

export function formatLastSeen(iso?: string) {
  if (!iso) return "No recent attempt";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No recent attempt";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getSeverity(totalWrong: number) {
  if (totalWrong >= 5) return { label: "Critical", color: "#B42318", bg: "#FEF3F2" };
  if (totalWrong >= 3) return { label: "Priority", color: "#B54708", bg: "#FFFAEB" };
  return { label: "Watch", color: "#4338CA", bg: "#EEF2FF" };
}

function getDataDepth(totalFailures: number) {
  if (totalFailures >= 12) return { label: "Stable signal", detail: "Enough misses for a dependable pattern." };
  if (totalFailures >= 5) return { label: "Growing signal", detail: "Useful trend, but still expanding." };
  return { label: "Early signal", detail: "A small sample is shaping the current scan." };
}

function getWeaknessSpread(activeDimensions: number) {
  if (activeDimensions >= 4) return { label: "Scattered", detail: "Misses are spread across multiple failure modes." };
  if (activeDimensions >= 2) return { label: "Mixed", detail: "A few failure modes are active together." };
  return { label: "Focused", detail: "Most misses point to one dominant issue." };
}

function getLatestWeakConcept(concepts: WeakConcept[]) {
  return concepts.reduce<WeakConcept | null>((latest, concept) => {
    if (!latest) return concept;
    const latestTime = Date.parse(latest.lastSeen || "") || 0;
    const conceptTime = Date.parse(concept.lastSeen || "") || 0;
    return conceptTime > latestTime ? concept : latest;
  }, null);
}

export function formatCountLabel(count: number) {
  return `${count} wrong${count === 1 ? "" : "s"}`;
}


export function buildCoachModel(data: NonNullable<ReturnType<typeof useBrainScan>["data"]>) {
  const distribution = data.globalDistribution || EMPTY_DISTRIBUTION;
  const dimensionRows = DIMENSION_ORDER.map((dimension) => [dimension, distribution[dimension] || 0] as const);
  const totalFailures = dimensionRows.reduce((sum, [, count]) => sum + count, 0);
  const activeDimensions = dimensionRows.filter(([, count]) => count > 0).length;
  const dominant = dimensionRows.slice().sort((a, b) => b[1] - a[1])[0] || ["APPLICATION_ERROR", 0];
  const dominantMeta = getDimensionMeta(dominant[0]);
  const dominantPct = totalFailures > 0 ? Math.round((dominant[1] / totalFailures) * 100) : 0;
  const weaknessSpread = getWeaknessSpread(activeDimensions);
  const dataDepth = getDataDepth(totalFailures);
  const sourceLabel =
    data.source === "recentQuizzes"
      ? "Based on recent quizzes"
      : data.source === "failureMap"
        ? "Based on your failure map"
        : "Practice history only";
  const insights = data.insights;
  const adaptiveNextDrill = insights?.adaptiveNextDrill;
  const mistakeCoach = insights?.mistakeCoach || [];
  const subjectHeatmap = insights?.subjectHeatmap || [];
  const confidenceProfile = insights?.confidenceProfile;
  const revisionPack = insights?.revisionPack || [];
  const trapRadar = insights?.trapRadar;
  const progressNarrative = insights?.progressNarrative;
  const latestWeakConcept = getLatestWeakConcept(data.topWeakConcepts);
  const topCoachItem = mistakeCoach[0];
  const headlineConcept = latestWeakConcept?.concept || adaptiveNextDrill?.concept || dominantMeta.label;
  const nextDrillLabel = adaptiveNextDrill
    ? `${adaptiveNextDrill.count} ${adaptiveNextDrill.difficulty} questions on ${adaptiveNextDrill.concept}`
    : "A focused drill will be suggested after more attempts.";
  const nextDrillReason = adaptiveNextDrill?.reason || topCoachItem?.why || dominantMeta.summary;
  const nextDrillFocus = adaptiveNextDrill?.focus || topCoachItem?.fix || "Work one concept at a time and review every miss.";
  const progressCopy = progressNarrative?.detail || "The scan will sharpen as you keep practicing.";
  const priorityTargets = data.topWeakConcepts.slice(0, 4);

  return { distribution, dimensionRows, totalFailures, activeDimensions, dominant, dominantMeta, dominantPct, weaknessSpread, dataDepth, sourceLabel, insights, adaptiveNextDrill, mistakeCoach, subjectHeatmap, confidenceProfile, revisionPack, trapRadar, progressNarrative, latestWeakConcept, topCoachItem, headlineConcept, nextDrillLabel, nextDrillReason, nextDrillFocus, progressCopy, priorityTargets };
}
