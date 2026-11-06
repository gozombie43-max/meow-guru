import { aggregateQuestionModeCounts, findPersistedQuestionMetadata, saveTopicCountSnapshot } from '../../repositories/questionMetadataRepository.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { getQuestionRevision, isNormalizedQuestionKeysEnabled } from "./questionCache.js";
import { fetchQuestionCounts } from "./questionMetadataService.js";
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { caseInsensitiveExact, mongoString, questionModeFromAggregateKey } from "./questionQueryBuilder.js";
import { normalizeSearchKey } from "./questionNormalizer.js";
import { SUBJECT_TOPICS, PUBLIC_CATALOG_SUBJECTS } from './topicCatalog.js';

const MODES = ["concept", "formula", "mixed", "aiChallenge", "easy", "hard"];
const COUNTED_MODES = new Set(MODES);

// Subjects whose hub topics are groups of chapters (e.g. Geography -> Solar
// System & Universe). Chapter pages read `totals[chapterSlug]`, so the snapshot
// also carries one total per uploaded chapter and rolls them into the group.
const CHAPTER_SUBJECTS = new Set(["general-awareness"]);
const slugify = value => String(value || "").trim().toLowerCase()
  .replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function addChapterTotals(subject, groupTopics, totals) {
  const normalized = isNormalizedQuestionKeysEnabled();
  const match = normalized ? { subjectKey: normalizeSearchKey(subject) } : { subject: caseInsensitiveExact(subject) };
  const rows = await aggregateQuestionModeCounts([
    { $match: match },
    { $project: {
      chapterSlug: mongoString("$chapterSlug"),
      topicGroup: { $toLower: mongoString("$topicGroup") },
      rawTopic: mongoString("$topic"),
      modeKey: mongoString("$modeKey"),
      quizName: { $toLower: mongoString("$quizName") },
      quizId: { $toLower: mongoString("$quizId") },
      source: { $toLower: mongoString("$source") },
      questionType: { $toLower: mongoString("$questionType") },
      topic: { $toLower: mongoString("$topic") },
      hasLetter: { $ne: [mongoString("$letter"), ""] },
      hasWord: { $ne: [mongoString("$word"), ""] },
      hasMeanings: { $isArray: "$meanings" },
    } },
    { $group: {
      _id: {
        chapterSlug: "$chapterSlug", topicGroup: "$topicGroup", rawTopic: "$rawTopic", modeKey: "$modeKey",
        quizName: "$quizName", quizId: "$quizId", source: "$source", questionType: "$questionType",
        topic: "$topic", hasLetter: "$hasLetter", hasWord: "$hasWord", hasMeanings: "$hasMeanings",
      },
      count: { $sum: 1 },
    } },
  ]);
  const groups = new Set(groupTopics);
  const groupKeys = new Set(groupTopics.map(normalizeSearchKey));
  const chapterTotals = new Map();
  const groupTotals = new Map();
  for (const row of rows) {
    const key = row?._id || {};
    const mode = normalized ? key.modeKey : questionModeFromAggregateKey(key);
    if (!COUNTED_MODES.has(mode)) continue;
    const count = Number(row.count) || 0;
    // Questions tagged directly with a group name are already counted above.
    if (groupKeys.has(normalizeSearchKey(key.rawTopic))) continue;
    const chapter = slugify(key.chapterSlug) || slugify(key.rawTopic);
    if (chapter && !groups.has(chapter) && chapter !== "__proto__") {
      chapterTotals.set(chapter, (chapterTotals.get(chapter) || 0) + count);
    }
    if (groups.has(key.topicGroup)) groupTotals.set(key.topicGroup, (groupTotals.get(key.topicGroup) || 0) + count);
  }
  for (const [chapter, count] of chapterTotals) totals[chapter] = count;
  for (const [group, count] of groupTotals) totals[group] = (totals[group] || 0) + count;
}
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
  freshMs: 900000, staleMs: 900000,
  validUntil: data => data ? new Date(data.generatedAt || data.updatedAt).getTime() + MAX_SNAPSHOT_AGE_MS : Infinity,
});

// This cache is exclusively public catalog data. A previous bank revision is
// permitted here, never in scoring, question pages or private progress reads.
const publicSnapshots = createTieredCache({
  freshMs: 300000, staleMs: MAX_PUBLIC_AGE_MS,
  validUntil: data => new Date(data?.generatedAt || data?.updatedAt).getTime() + MAX_PUBLIC_AGE_MS,
});

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function subjectAppearsEmpty(subject, topics) {
  if ((await aggregateQuestionModeCounts([{ $limit: 1 }])).length === 0) return true;
  if (isNormalizedQuestionKeysEnabled()) {
    if (CHAPTER_SUBJECTS.has(subject)) {
      const subjectKey = normalizeSearchKey(subject);
      const topicKeys = topics.map(normalizeSearchKey);
      return (await aggregateQuestionModeCounts([
        { $match: { $or: [{ subjectKey }, { topicKey: { $in: topicKeys } }] } },
        { $limit: 1 },
      ])).length === 0;
    }
    const match = subject === 'iit-jam-physics'
      ? { subjectKey: normalizeSearchKey(subject) }
      : { topicKey: { $in: [...new Set(topics.flatMap(topic => {
        const key = normalizeSearchKey(topic);
        return ['synonymsantonyms', 'antosynopyq'].includes(key) ? ['synonymsantonyms', 'antosynopyq'] : [key];
      }))] } };
    return (await aggregateQuestionModeCounts([{ $match: match }, { $limit: 1 }])).length === 0;
  }
  if (subject === 'iit-jam-physics') {
    return (await aggregateQuestionModeCounts([{ $match: { subject: caseInsensitiveExact(subject) } }, { $limit: 1 }])).length === 0;
  }
  const aliases = [...new Set(topics.flatMap(topic => (
    ['synonymsantonyms', 'antosynopyq'].includes(normalizeSearchKey(topic))
      ? [topic, 'antosynopyq', 'synonyms-antonyms']
      : [topic]
  )))];
  const pattern = new RegExp(`^\\s*(?:${aliases.map(escapeRegex).join('|')})\\s*$`, 'i');
  const clauses = [
    { topic: pattern }, { chapter: pattern }, { subject: pattern },
    { quizTopic: pattern }, { quizName: pattern }, { source: pattern },
  ];
  if (CHAPTER_SUBJECTS.has(subject)) clauses.push({ subject: caseInsensitiveExact(subject) });
  return (await aggregateQuestionModeCounts([{ $match: { $or: clauses } }, { $limit: 1 }])).length === 0;
}

const refreshes = new Map();
function refreshPublicSnapshot(subject, { periodic = false } = {}) {
  const key = `${subject}:${isNormalizedQuestionKeysEnabled()}`;
  if (refreshes.has(key)) return refreshes.get(key);
  const work = (async () => {
    const id = `topic-counts:v3:${subject}:${isNormalizedQuestionKeysEnabled()}`;
    const [revision, saved] = await Promise.all([getQuestionRevision(), findPersistedQuestionMetadata(id)]);
    if (saved?.revision === revision && validSnapshot(saved.data, subject, revision, MAX_SNAPSHOT_AGE_MS)) {
      publicSnapshots.prime(`public-catalog:v1:${id}`, saved.data);
      snapshots.prime(`topic-counts:v3:${id}:${revision}`, saved.data);
      return saved.data;
    }
    if (saved?.revision === revision && validSnapshot(saved.data, subject, revision, MAX_PUBLIC_AGE_MS)
      && Object.values(saved.data.totals).every(count => count === 0)
      && await subjectAppearsEmpty(subject, SUBJECT_TOPICS[subject])) {
      const nowIso = new Date(Date.now()).toISOString();
      const refreshed = { ...saved.data, generatedAt: nowIso, updatedAt: nowIso };
      await saveTopicCountSnapshot({ _id: id, revision, data: refreshed, kind: 'topic-counts' });
      publicSnapshots.prime(`public-catalog:v1:${id}`, refreshed);
      snapshots.prime(`topic-counts:v3:${id}:${revision}`, refreshed);
      return refreshed;
    }
    return fetchTopicCountSnapshot(subject, { cacheShared: !periodic });
  })().catch(error => {
    runtimeLog.error('Public topic count refresh failed:', error.message);
  }).finally(() => refreshes.delete(key));
  refreshes.set(key, work);
  return work;
}

// Rebuild and persist topic count snapshots for specific uploaded subjects.
export async function refreshTopicCountSnapshots(subjects = PUBLIC_CATALOG_SUBJECTS) {
  for (const raw of subjects) {
    const subject = String(raw || '').trim().toLowerCase();
    if (!subject || subject === 'mathematics' || !Object.hasOwn(SUBJECT_TOPICS, subject)) continue;
    try { await fetchTopicCountSnapshot(subject); }
    catch (error) { runtimeLog.error(`Topic count refresh failed for ${subject}:`, error.message); }
  }
}

let catalogRefresh;
export function refreshPublicCatalogs({ periodic = false } = {}) {
  if (catalogRefresh) return catalogRefresh;
  catalogRefresh = (async () => {
    // Keep the existing <=4 topic-query budget across subjects as well.
    for (const subject of PUBLIC_CATALOG_SUBJECTS) await refreshPublicSnapshot(subject, { periodic });
  })().finally(() => { catalogRefresh = undefined; });
  return catalogRefresh;
}

export async function initializePublicCatalogs({ fresh = false } = {}) {
  const results = [];
  const currentRevision = fresh ? null : await getQuestionRevision();
  for (const subject of PUBLIC_CATALOG_SUBJECTS) {
    const id = `topic-counts:v3:${subject}:${isNormalizedQuestionKeysEnabled()}`;
    const saved = await findPersistedQuestionMetadata(id);
    if (!fresh && validSnapshot(saved?.data, subject, saved?.revision, MAX_PUBLIC_AGE_MS)) {
      publicSnapshots.prime(`public-catalog:v1:${id}`, saved.data);
      if (saved.revision === currentRevision && validSnapshot(saved.data, subject, currentRevision, MAX_SNAPSHOT_AGE_MS)) {
        snapshots.prime(`topic-counts:v3:${id}:${currentRevision}`, saved.data);
      }
      results.push({ subject, revision: saved.revision, rebuilt: false });
      continue;
    }
    const data = await fetchTopicCountSnapshot(subject, { cacheShared: false });
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
  const id = `topic-counts:v3:${normalizedSubject}:${isNormalizedQuestionKeysEnabled()}`;
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
    pending = refreshPublicCatalogs({ periodic: true }).finally(() => { pending = undefined; });
  };
  warm();
  const timer = setInterval(warm, 15 * 60 * 1000);
  timer.unref();
  return async () => { stopped = true; clearInterval(timer); await pending; };
}

export async function fetchTopicCountSnapshot(subject = "mathematics", { cacheShared = true } = {}) {
  const normalizedSubject = String(subject).toLowerCase();
  const topics = Object.hasOwn(SUBJECT_TOPICS, normalizedSubject) ? SUBJECT_TOPICS[normalizedSubject] : undefined;
  if (!topics) throw Object.assign(new Error(`Unsupported topic-count subject: ${subject}`), { statusCode: 400 });
  const id = `topic-counts:v3:${normalizedSubject}:${isNormalizedQuestionKeysEnabled()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const revision = await getQuestionRevision();
    const data = await snapshots.read(`topic-counts:v3:${id}:${revision}`, async () => {
      const cached = await findPersistedQuestionMetadata(id);
      if (cached?.revision === revision && validSnapshot(cached.data, normalizedSubject, revision, MAX_SNAPSHOT_AGE_MS)) {
        publicSnapshots.prime(`public-catalog:v1:${id}`, cached.data);
        return cached.data;
      }
      const totals = {};
      if (await subjectAppearsEmpty(normalizedSubject, topics)) {
        for (const topic of topics) totals[topic] = 0;
      } else {
        for (let offset = 0; offset < topics.length; offset += 4) {
          await Promise.all(topics.slice(offset, offset + 4).map(async topic => {
            const counts = await fetchQuestionCounts({ subject: normalizedSubject, topic }, { cacheShared: false });
            totals[topic] = MODES.reduce((sum, mode) => sum + (counts[mode] ?? 0), 0);
          }));
        }
        if (CHAPTER_SUBJECTS.has(normalizedSubject)) await addChapterTotals(normalizedSubject, topics, totals);
      }
      if (await getQuestionRevision() !== revision) return null;
      const generatedAt = new Date(Date.now()).toISOString();
      const result = { subject: normalizedSubject, revision, totals, generatedAt, updatedAt: generatedAt };
      await saveTopicCountSnapshot({ _id: id, revision, data: result, kind: "topic-counts" });
      publicSnapshots.prime(`public-catalog:v1:${id}`, result);
      return result;
    }, { allowStale: false, cacheShared });
    if (data && await getQuestionRevision() === data.revision) return data;
  }
  throw Object.assign(new Error("Question counts are updating; please retry"), { statusCode: 503 });
}
