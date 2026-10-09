import { findPersistedQuestionMetadata, saveTopicCountSnapshot } from '../../repositories/questionMetadataRepository.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { getQuestionRevision, isNormalizedQuestionKeysEnabled } from "./questionCache.js";
import { fetchQuestionCounts, primeQuestionCountCaches } from "./questionMetadataService.js";
import { runtimeLog } from '../../infrastructure/runtimeLog.js';

// Canonical hub topics per subject. Counts use the same mode resolver as topic pages.
const SUBJECT_TOPICS = {
  mathematics: [
    "percentages", "ratio-and-proportion", "profit-and-loss", "simple-interest",
    "compound-interest", "time-and-work", "time-and-distance", "algebra", "geometry",
    "mensuration", "trigonometry", "number-system", "averages", "discount",
    "mixture-and-alligation", "partnership", "square-roots", "statistics-probability",
    "simplification", "lcm-and-hcf", "problems-on-ages", "pipes-and-cisterns",
    "calendar-and-clock", "height-and-distance", "boat-and-stream",
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
const MAX_PUBLIC_AGE_MS = 24 * 60 * 60 * 1000;
const validSnapshot = (data, subject, revision, maxAge) => {
  const topics = Object.hasOwn(SUBJECT_TOPICS, subject || '') ? SUBJECT_TOPICS[subject] : undefined;
  const age = Date.now() - new Date(data?.generatedAt || data?.updatedAt).getTime();
  return Boolean(topics && data?.subject === subject && data?.revision === revision
    && Number.isSafeInteger(revision) && revision >= 0 && age >= 0 && age < maxAge
    && Number.isFinite(new Date(data?.updatedAt).getTime())
    && topics.every(topic => Number.isSafeInteger(data.totals?.[topic]) && data.totals[topic] >= 0));
};
const freshSnapshot = (data, revision) => {
  return validSnapshot(data, data?.subject, revision, MAX_SNAPSHOT_AGE_MS);
};

const snapshots = createTieredCache({
  freshMs: 120000, staleMs: 120000,
  validUntil: data => data ? new Date(data.generatedAt || data.updatedAt).getTime() + MAX_SNAPSHOT_AGE_MS : Infinity,
});

// This cache is exclusively public catalog data. A previous bank revision is
// permitted here, never in scoring, question pages or private progress reads.
const publicSnapshots = createTieredCache({
  freshMs: 5000, staleMs: MAX_PUBLIC_AGE_MS,
  validUntil: data => new Date(data?.generatedAt || data?.updatedAt).getTime() + MAX_PUBLIC_AGE_MS,
});
const refreshes = new Map();
function refreshPublicSnapshot(subject) {
  const key = `${subject}:${isNormalizedQuestionKeysEnabled()}`;
  if (refreshes.has(key)) return refreshes.get(key);
  const work = fetchTopicCountSnapshot(subject).catch(error => {
    runtimeLog.error('Public topic count refresh failed:', error.message);
  }).finally(() => refreshes.delete(key));
  refreshes.set(key, work);
  return work;
}

let catalogRefresh;
export function refreshPublicCatalogs() {
  if (catalogRefresh) return catalogRefresh;
  catalogRefresh = (async () => {
    // Keep the existing <=4 topic-query budget across subjects as well.
    for (const subject of Object.keys(SUBJECT_TOPICS)) await refreshPublicSnapshot(subject);
  })().finally(() => { catalogRefresh = undefined; });
  return catalogRefresh;
}

export async function initializePublicCatalogs({ fresh = false } = {}) {
  const results = [];
  for (const subject of Object.keys(SUBJECT_TOPICS)) {
    const id = `topic-counts:v2:${subject}:${isNormalizedQuestionKeysEnabled()}`;
    const saved = await findPersistedQuestionMetadata(id);
    if (!fresh && validSnapshot(saved?.data, subject, saved?.revision, MAX_PUBLIC_AGE_MS)) {
      results.push({ subject, revision: saved.revision, rebuilt: false });
      continue;
    }
    const data = await fetchTopicCountSnapshot(subject);
    // A tiered cache hit alone does not establish durable snapshot presence.
    await saveTopicCountSnapshot({ _id: id, revision: data.revision, data, kind: 'topic-counts' });
    results.push({ subject, revision: data.revision, rebuilt: true });
  }
  return results;
}

export async function fetchPublicTopicCountSnapshot(subject = 'mathematics') {
  const normalizedSubject = String(subject).toLowerCase();
  const topics = Object.hasOwn(SUBJECT_TOPICS, normalizedSubject) ? SUBJECT_TOPICS[normalizedSubject] : undefined;
  if (!topics) throw Object.assign(new Error(`Unsupported topic-count subject: ${subject}`), { statusCode: 400 });
  const id = `topic-counts:v2:${normalizedSubject}:${isNormalizedQuestionKeysEnabled()}`;
  const data = await publicSnapshots.read(`public-catalog:v1:${id}`, async () => {
    const cached = await findPersistedQuestionMetadata(id);
    const value = cached?.data;
    if (validSnapshot(value, normalizedSubject, cached?.revision, MAX_PUBLIC_AGE_MS)) return value;
    return fetchTopicCountSnapshot(normalizedSubject);
  });
  if (!freshSnapshot(data, await getQuestionRevision())) void refreshPublicSnapshot(normalizedSubject);
  return { subject: data.subject, revision: data.revision, totals: data.totals,
    generatedAt: data.generatedAt, updatedAt: data.updatedAt };
}

// Readiness establishes durable presence first; periodic refresh covers all
// subjects and durable bank revision changes from external mutation tools.
export function startTopicCountPrewarm() {
  let stopped = false, pending;
  const warm = () => {
    if (stopped || pending) return;
    pending = refreshPublicCatalogs().finally(() => { pending = undefined; });
  };
  warm();
  const timer = setInterval(warm, 15 * 60 * 1000);
  timer.unref();
  return async () => { stopped = true; clearInterval(timer); await pending; };
}

export async function fetchTopicCountSnapshot(subject = "mathematics") {
  const normalizedSubject = String(subject).toLowerCase();
  const topics = Object.hasOwn(SUBJECT_TOPICS, normalizedSubject) ? SUBJECT_TOPICS[normalizedSubject] : undefined;
  if (!topics) throw Object.assign(new Error(`Unsupported topic-count subject: ${subject}`), { statusCode: 400 });
  const id = `topic-counts:v2:${normalizedSubject}:${isNormalizedQuestionKeysEnabled()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await getQuestionRevision();
    const data = await snapshots.read(`topic-counts:v3:${id}:${revision}`, async () => {
      const cached = await findPersistedQuestionMetadata(id);
      if (cached?.revision === revision && validSnapshot(cached.data, normalizedSubject, revision, MAX_SNAPSHOT_AGE_MS)) return cached.data;
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
