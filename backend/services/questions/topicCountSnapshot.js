import { findPersistedQuestionMetadata, saveTopicCountSnapshot } from '../../repositories/questionMetadataRepository.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { getQuestionRevision, isNormalizedQuestionKeysEnabled } from "./questionCache.js";
import { fetchQuestionCounts, primeQuestionCountCaches } from "./questionMetadataService.js";

// Canonical hub topics per subject. Counts use the same mode resolver as topic pages.
const SUBJECT_TOPICS = {
  mathematics: [
    "percentages", "ratio-and-proportion", "profit-and-loss", "simple-interest",
    "compound-interest", "time-and-work", "time-and-distance", "algebra", "geometry",
    "mensuration", "trigonometry", "number-system", "averages", "discount",
    "mixture-and-alligation", "partnership", "square-roots", "statistics-probability",
    "simplification", "lcm-and-hcf", "problems-on-ages", "pipes-and-cisterns",
    "calendar-and-clock",
  ],
  reasoning: [
    "coding-decoding", "syllogism-inferences", "puzzle-seating-arrangement", "series",
    "analogy", "classification-odd-one-out", "blood-relations", "direction-distance",
    "venn-diagram", "inequalities", "mathematical-symbolic-operations", "order-ranking",
    "statement-conclusion", "statement-assumptions", "statement-arguments",
    "problem-solving-critical-thinking", "non-verbal-figures", "paper-folding-cutting",
    "mirror-water-image", "cube-dice", "matrix", "logical-sequence-of-words",
    "emotional-intelligence", "social-intelligence", "word-building",
  ],
  english: [
    "synonyms-antonyms", "one-word-substitution", "idioms-phrases",
    "spot-the-error-error-detection", "sentence-correction-improvement", "cloze-test",
    "reading-comprehension", "active-passive-voice", "direct-indirect-narration",
    "tenses", "subject-verb-agreement", "para-jumbles", "fill-in-the-blanks",
    "spelling-misspelled-words", "prepositions", "articles", "conjunctions",
    "homonyms-homophones", "sentence-structure", "para-sentence-completion",
    "pronouns", "modifiers", "parallelism",
  ],
  "general-awareness": [
    "ancient-history", "medieval-history", "modern-history", "polity", "geography",
    "physics", "chemistry", "biology", "economy", "current-affairs", "static-gk",
  ],
};

const MODES = ["concept", "formula", "mixed", "aiChallenge", "easy", "hard"];
const MAX_SNAPSHOT_AGE_MS = 60 * 60 * 1000;
const freshSnapshot = (data, revision) => {
  const generatedAt = new Date(data?.generatedAt || data?.updatedAt).getTime();
  const age = Date.now() - generatedAt;
  return data?.revision === revision && Number.isFinite(age) && age >= 0 && age < MAX_SNAPSHOT_AGE_MS;
};

const snapshots = createTieredCache({
  freshMs: 120000, staleMs: 120000,
  validUntil: data => data ? new Date(data.generatedAt || data.updatedAt).getTime() + MAX_SNAPSHOT_AGE_MS : Infinity,
});

export async function fetchTopicCountSnapshot(subject = "mathematics") {
  const normalizedSubject = String(subject).toLowerCase();
  const topics = SUBJECT_TOPICS[normalizedSubject];
  if (!topics) throw Object.assign(new Error(`Unsupported topic-count subject: ${subject}`), { statusCode: 400 });
  const id = `topic-counts:v2:${normalizedSubject}:${isNormalizedQuestionKeysEnabled()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await getQuestionRevision();
    const data = await snapshots.read(`topic-counts:v3:${id}:${revision}`, async () => {
      const cached = await findPersistedQuestionMetadata(id);
      if (cached?.revision === revision && freshSnapshot(cached.data, revision)) return cached.data;
      const totals = {};
      await primeQuestionCountCaches(topics.map(topic => ({ subject: normalizedSubject, topic })));
      for (let offset = 0; offset < topics.length; offset += 4) {
        await Promise.all(topics.slice(offset, offset + 4).map(async topic => {
          const counts = await fetchQuestionCounts({ subject: normalizedSubject, topic }, { sharedChecked: true });
          totals[topic] = MODES.reduce((sum, mode) => sum + (counts[mode] ?? 0), 0);
        }));
      }
      if (await getQuestionRevision() !== revision) return null;
      const generatedAt = new Date().toISOString();
      const result = { subject: normalizedSubject, revision, totals, generatedAt, updatedAt: generatedAt };
      await saveTopicCountSnapshot({ _id: id, revision, data: result, kind: "topic-counts" });
      return result;
    }, { allowStale: false });
    if (data && await getQuestionRevision() === data.revision) return data;
  }
  throw Object.assign(new Error("Question counts are updating; please retry"), { statusCode: 503 });
}
