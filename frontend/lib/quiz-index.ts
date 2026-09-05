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

type BuildQuizIndexOptions<T> = {
  getBucket: (item: T) => string;
  getConcept: (item: T) => string;
  getExam: (item: T) => string;
  compare?: (a: T, b: T) => number;
};

const createPool = <T>(): IndexedPool<T> => ({
  all: [],
  byConcept: new Map<string, T[]>(),
  byExam: new Map<string, T[]>(),
});

const pushToMapArray = <T>(map: Map<string, T[]>, key: string, item: T) => {
  if (!key) return;

  const existing = map.get(key);
  if (existing) {
    existing.push(item);
    return;
  }

  map.set(key, [item]);
};

const indexItem = <T>(
  pool: IndexedPool<T>,
  item: T,
  conceptKey: string,
  examKey: string
) => {
  pool.all.push(item);
  pushToMapArray(pool.byConcept, conceptKey, item);
  pushToMapArray(pool.byExam, examKey, item);
};

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


