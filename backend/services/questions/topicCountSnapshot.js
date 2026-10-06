import { findPersistedQuestionMetadata, saveTopicCountSnapshot } from '../../repositories/questionMetadataRepository.js';
import { redisGetJson, redisSetJson } from '../../config/redis.js';
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
const pending = new Map();

export async function fetchTopicCountSnapshot(subject = "mathematics") {
  const normalizedSubject = String(subject).toLowerCase();
  const topics = SUBJECT_TOPICS[normalizedSubject];
  if (!topics) {
    const error = new Error(`Unsupported topic-count subject: ${subject}`);
    error.statusCode = 400;
    throw error;
  }
  const id = `topic-counts:v2:${normalizedSubject}:${isNormalizedQuestionKeysEnabled()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await getQuestionRevision();
    const sharedKey = `topic-counts:${id}:${revision}`;
    const shared = await redisGetJson(sharedKey);
    if (shared?.revision === revision) return shared;
    const cached = await findPersistedQuestionMetadata(id);
    if (cached?.revision === revision) {
      await redisSetJson(sharedKey, cached.data, 120);
      return cached.data;
    }
    const key = `${id}:${revision}`;
    if (!pending.has(key)) {
      const work = (async () => {
        const totals = {};
        await primeQuestionCountCaches(topics.map(topic => ({ subject: normalizedSubject, topic })));
        // Bounded concurrency; only runs at initialization or after question writes.
        for (let offset = 0; offset < topics.length; offset += 4) {
          await Promise.all(topics.slice(offset, offset + 4).map(async topic => {
            const counts = await fetchQuestionCounts({ subject: normalizedSubject, topic }, { sharedChecked: true });
            totals[topic] = MODES.reduce((sum, mode) => sum + (counts[mode] ?? 0), 0);
          }));
        }
        if (await getQuestionRevision() !== revision) return null;
        const data = { subject, revision, totals, updatedAt: new Date().toISOString() };
        const snapshot = { _id: id, revision, data, kind: "topic-counts" };
        // An older worker must never overwrite a newer snapshot.
        await saveTopicCountSnapshot(snapshot);
        return data;
      })();
      pending.set(key, work);
      work.finally(() => pending.delete(key)).catch(() => {});
    }
    const data = await pending.get(key);
    if (data && await getQuestionRevision() === data.revision) {
      await redisSetJson(sharedKey, data, 120);
      return data;
    }
  }
  const error = new Error("Question counts are updating; please retry");
  error.statusCode = 503;
  throw error;
}
