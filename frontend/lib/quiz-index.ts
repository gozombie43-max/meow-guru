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

export function buildQuizIndex<T>(
  items: T[],
  { getBucket, getConcept, getExam, compare }: BuildQuizIndexOptions<T>
): QuizIndex<T> {
  const ordered = compare ? [...items].sort(compare) : [...items];
  const byBucket = new Map<string, IndexedPool<T>>();

  for (const item of ordered) {
    const bucketKey = getBucket(item);
    const conceptKey = getConcept(item) || "";
    const examKey = normalizeExamLabel(getExam(item) || "");

    let bucket = byBucket.get(bucketKey);
    if (!bucket) {
      bucket = createPool<T>();
      byBucket.set(bucketKey, bucket);
    }

    indexItem(bucket, item, conceptKey, examKey);
  }

  return { byBucket };
}

type ResolveIndexedQuestionsOptions = {
  bucket: string;
  concept?: string;
  exam?: string;
};

export function resolveIndexedQuestions<T>(
  index: QuizIndex<T>,
  { bucket, concept = "all", exam = "" }: ResolveIndexedQuestionsOptions
): T[] {
  const pool = index.byBucket.get(bucket);
  if (!pool) return [];

  const conceptKey = concept.trim();
  const examKey = normalizeExamLabel(exam);

  const result = conceptKey && conceptKey !== "all"
    ? pool.byConcept.get(conceptKey) ?? []
    : pool.all;

  if (!examKey || examKey === "all") {
    return result;
  }

  if (conceptKey && conceptKey !== "all") {
    return result.filter((item) => normalizeExamLabel(String((item as QuizIndexRecord).exam ?? "")) === examKey);
  }

  return pool.byExam.get(examKey) ?? [];
}
