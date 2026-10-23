import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import { advanceQuestionRevision, findPersistedQuestionMetadata, savePersistedQuestionMetadata } from '../../repositories/questionMetadataRepository.js';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { createHash } from 'node:crypto';
import { heavyMongo } from '../../infrastructure/dependencyBoundary.js';
import { publishCacheInvalidation, onCacheInvalidation } from '../../infrastructure/cacheInvalidation.js';
import { invalidateTrainingCatalog } from '../training/catalogCache.js';
import { invalidateQuestionCacheRevision, getQuestionRevision } from './questionCache.js';
import { isNormalizedQuestionKeysEnabled } from './questionCache.js';
import { canonicalQuestionQuery } from './questionQueryIdentity.js';

// Recovery for imports performed outside the application write services.
const MAX_AGE_MS = 60 * 60 * 1000;
const pending = new Map();
const metadataCache = createTieredCache({ freshMs: 300000, staleMs: 300000 });
onCacheInvalidation(type => { if (type === 'question.changed') { invalidateTrainingCatalog(); invalidateQuestionCacheRevision(); } });

export async function invalidateQuestionMetadata() {
  invalidateTrainingCatalog();
  invalidateQuestionCacheRevision();
  await advanceQuestionRevision();
  await publishCacheInvalidation();
  try {
    const { fetchTopicCountSnapshot } = await import("./topicCountSnapshot.js");
    await fetchTopicCountSnapshot();
  } catch (error) {
    // The write succeeded. A failed refresh is retried by the next metadata read.
    runtimeLog.error("Topic count snapshot refresh failed:", error.message);
  }
}

export async function readQuestionMetadata(params, build) {
  params = canonicalQuestionQuery('metadata', params);
  const key = JSON.stringify({
    topic: params.topic || "", subject: params.subject || "", mode: params.mode || "",
    normalized: isNormalizedQuestionKeysEnabled(), schema: 3,
  });
  const revision = await getQuestionRevision();
  return metadataCache.read(`question-meta:${revision}:${createHash('sha256').update(key).digest('hex')}`, () => readPersistedMetadata(key, revision, params, build));
}

async function readPersistedMetadata(key, revision, params, build) {
  const cached = await findPersistedQuestionMetadata(key);
  if (cached?.revision === revision && Date.now() - new Date(cached.updatedAt).getTime() < MAX_AGE_MS) {
    return cached.data;
  }
  const pendingKey = `${key}:${revision}`;
  if (pending.has(pendingKey)) return pending.get(pendingKey);
  const work = (async () => {
    const data = await heavyMongo.execute(build);
    // A concurrent upload changes the revision. Older builds can never be reused
    // as current metadata, even across separate API/worker processes.
    await savePersistedQuestionMetadata(key, revision, data, params);
    return data;
  })();
  pending.set(pendingKey, work);
  try { return await work; }
  finally { pending.delete(pendingKey); }
}
