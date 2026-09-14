export interface QuizIndexRecord {
  concept?: string;
  exam?: string;
}

export interface IndexedPool<T> {
  all: T[];
  byConcept: Map<string, T[]>;
  byExam: Map<string, T[]>;
}

export interface QuizIndex<T> {
  byBucket: Map<string, IndexedPool<T>>;
}

export function normalizeExamLabel(exam: string): string {
  const normalized = (exam ?? "").trim();
  const upper = normalized.toUpperCase();

  if (upper.includes("SSC CGL") && upper.includes("TIER II")) return "SSC CGL Tier II";
  if (upper.includes("SSC CGL")) return "SSC CGL";
  if (upper.includes("SSC CHSL") && upper.includes("TIER II")) return "SSC CHSL Tier II";
  if (upper.includes("SSC CHSL")) return "SSC CHSL";
  if (upper.includes("SSC CPO")) return "SSC CPO";
  if (upper.includes("GRADUATE LEVEL")) return "Graduate Level";
  if (upper.includes("HIGHER SECONDARY")) return "Higher Secondary";
  if (upper.includes("LECTURER")) return "Lecturer";
  if (upper.includes("POLICE")) return "Police";
  if (upper.includes("RAILWAY")) return "Railway";

  return normalized
    .replace(
      /\b(?:\d{1,4}|\d{1,2}TH|\d{1,2}ND|\d{1,2}ST|\d{1,2}RD|SHIFT|SESSION|SET|PAPER|SLOT|AFTERNOON|MORNING|EVENING|TIER\s*I+|LEVEL)\b/gi,
      ""
    )
    .replace(/[\(\)\[\],\/\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


