import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';

const redisTracker = vi.hoisted(() => {
  const store = new Map();
  const fences = new Map();
  const locks = new Map();
  const counts = { get: 0, mGet: 0, set: 0, eval: 0, del: 0, publish: 0 };
  const resetCounts = () => {
    counts.get = 0; counts.mGet = 0; counts.set = 0; counts.eval = 0; counts.del = 0; counts.publish = 0;
  };
  const resetAll = () => {
    store.clear(); fences.clear(); locks.clear(); resetCounts();
  };
  const totalCommands = () => counts.get + counts.mGet + counts.set + counts.eval + counts.del + counts.publish;
  const client = {
    async get(key) { counts.get++; return store.get(key) ?? null; },
    async mGet(keys) { counts.mGet++; return keys.map(k => store.get(k) ?? null); },
    async set(key, value) { counts.set++; store.set(key, value); return 'OK'; },
    async del(keys) {
      counts.del++;
      for (const k of (Array.isArray(keys) ? keys : [keys])) { store.delete(k); locks.delete(k); }
      return 1;
    },
    async publish() { counts.publish++; return 1; },
    async eval(script, { keys, arguments: args }) {
      counts.eval++;
      if (script.includes("INCR', KEYS[2]")) {
        if (locks.has(keys[0])) return 0;
        const fence = (fences.get(keys[1]) ?? 0) + 1;
        fences.set(keys[1], fence);
        locks.set(keys[0], args[0]);
        return fence;
      }
      if (script.includes("SET', KEYS[3]")) {
        if (locks.get(keys[0]) !== args[0]) return 0;
        if ((fences.get(keys[1]) ?? -1) !== Number(args[1])) return 0;
        store.set(keys[2], args[2]);
        if (script.includes("DEL', KEYS[1]")) locks.delete(keys[0]);
        return 1;
      }
      if (script.includes("DEL', KEYS[1]")) {
        if (locks.get(keys[0]) === args[0]) { locks.delete(keys[0]); return 1; }
        return 0;
      }
      return 1;
    },
  };
  return { store, locks, counts, resetCounts, resetAll, totalCommands, client };
});

vi.mock('../../config/redis.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    redisKey: suffix => `opt-test:v1:${suffix}`,
    getRedisClient: vi.fn(async () => redisTracker.client),
    redisGetJson: vi.fn(async key => {
      const raw = await redisTracker.client.get(`opt-test:v1:${key}`);
      return raw == null ? null : JSON.parse(raw);
    }),
    redisGetJsonMany: vi.fn(async keys => {
      if (!keys.length) return [];
      const rows = await redisTracker.client.mGet(keys.map(k => `opt-test:v1:${k}`));
      return rows.map(r => (r == null ? null : JSON.parse(r)));
    }),
    redisSetJson: vi.fn(async (key, value, ttlSeconds, { lease, encoded } = {}) => {
      const payload = encoded?.encoded ?? JSON.stringify(value);
      if (lease) {
        return Boolean(await redisTracker.client.eval(
          "SET', KEYS[3] DEL', KEYS[1]",
          { keys: [lease.lockKey, lease.fenceKey, `opt-test:v1:${key}`], arguments: [lease.owner, String(lease.fence), payload, String(ttlSeconds)] },
        ));
      }
      await redisTracker.client.set(`opt-test:v1:${key}`, payload);
      return true;
    }),
  };
});

import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { initializePublicCatalogs, startTopicCountPrewarm, refreshPublicCatalogs, fetchPublicTopicCountSnapshot, fetchTopicCountSnapshot } from '../questions/topicCountSnapshot.js';
import { fetchQuestionCounts, fetchQuestionsMeta } from '../questions/questionMetadataService.js';
import { invalidateQuestionMetadata } from '../questions/questionMetadataCache.js';
import { invalidateQuestionCacheRevision, questionCountsCache } from '../questions/questionCache.js';
import { createQuestionsBulk } from '../questions/questionWriteService.js';
import { cachedTopicProgress, advanceTopicProgressRevision, invalidateTopicProgress, TOPIC_PROGRESS_CACHE_TTL_SECONDS } from '../questions/topicProgressCache.js';
import { cachedTrainingDashboard, invalidateTrainingDashboard, TRAINING_DASHBOARD_CACHE_TTL_SECONDS } from '../training/dashboardCache.js';

let mongo, db;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'redis_opt_integration');
  vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
  db = await connectMongoDB();
}, 90000);

beforeEach(async () => {
  clearSharedLocalCaches();
  questionCountsCache.clear();
  invalidateQuestionCacheRevision();
  redisTracker.resetAll();
  for (const name of ['questions', 'questionMetadata', 'runtimeCacheRevisions', 'userTopicProgress']) {
    await db.collection(name).deleteMany({});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await disconnectMongoDB();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

it('keeps idle topic-count prewarming and public catalog reads at zero Redis commands after initialization', async () => {
  await initializePublicCatalogs();
  redisTracker.resetCounts();

  // Startup prewarm immediately after initializePublicCatalogs must do 0 Redis operations.
  const stop = startTopicCountPrewarm();
  await stop();
  expect(redisTracker.totalCommands()).toBe(0);

  // Repeated public catalog reads across 60s (past old 5s freshMs and 10s localMs) hit L1 with 0 Redis ops.
  const baseNow = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(baseNow);
  for (const offset of [0, 6_000, 15_000, 60_000]) {
    clock.mockReturnValue(baseNow + offset);
    const snap = await fetchPublicTopicCountSnapshot('mathematics');
    expect(snap.totals.percentages).toBe(0);
  }
  expect(redisTracker.totalCommands()).toBe(0);

  // Even 75 minutes later (> 60m MAX_SNAPSHOT_AGE_MS), periodic prewarm on an empty DB does 0 Redis ops
  // AND updates durable timestamps so subsequent public reads at +76m also issue 0 Redis ops.
  clock.mockReturnValue(baseNow + 75 * 60_000);
  await refreshPublicCatalogs({ periodic: true });
  expect(redisTracker.totalCommands()).toBe(0);

  clock.mockReturnValue(baseNow + 76 * 60_000);
  expect((await fetchPublicTopicCountSnapshot('mathematics')).totals.percentages).toBe(0);
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(redisTracker.totalCommands()).toBe(0);
  clock.mockRestore();
});

it('keeps periodic prewarming at zero Redis commands in default QUESTIONS_NORMALIZED_KEYS=false mode with populated and empty subjects', async () => {
  vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'false');
  try {
    await createQuestionsBulk([{ id: 'legacy-q1', subject: 'mathematics', topic: 'percentages', quizName: 'PYQ' }]);
    clearSharedLocalCaches();
    questionCountsCache.clear();
    await db.collection('questionMetadata').deleteMany({});
    redisTracker.resetAll();

    await initializePublicCatalogs();
    expect(redisTracker.totalCommands()).toBe(0);

    const baseNow = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(baseNow + 75 * 60_000);
    await refreshPublicCatalogs({ periodic: true });
    expect(redisTracker.totalCommands()).toBe(0);

    clock.mockReturnValue(baseNow + 76 * 60_000);
    expect((await fetchPublicTopicCountSnapshot('mathematics')).totals.percentages).toBe(1);
    expect((await fetchPublicTopicCountSnapshot('reasoning')).totals['coding-decoding']).toBe(0);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(redisTracker.totalCommands()).toBe(0);
    clock.mockRestore();
  } finally {
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
  }
});

it('retains empty canonical topics and metadata beyond 5s without per-topic Redis lock churn during snapshot rebuilds', async () => {
  const baseNow = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(baseNow);

  // Canonical empty topic stays fresh in L1 well past 5s (5m TTL) for both counts and metadata, unlike arbitrary unknown slugs (5s negativeMs).
  expect(await fetchQuestionCounts({ subject: 'mathematics', topic: 'geometry' })).toMatchObject({ concept: 0 });
  expect(await fetchQuestionsMeta({ subject: 'mathematics', topic: 'geometry', mode: 'concept' })).toMatchObject({ total: 0 });
  expect(await fetchQuestionCounts({ subject: 'mathematics', topic: 'random-unknown-slug-xyz' })).toMatchObject({ concept: 0 });
  expect(await fetchQuestionsMeta({ subject: 'mathematics', topic: 'random-unknown-slug-xyz', mode: 'concept' })).toMatchObject({ total: 0 });
  redisTracker.resetCounts();

  clock.mockReturnValue(baseNow + 30_000);
  expect(await fetchQuestionCounts({ subject: 'mathematics', topic: 'geometry' })).toMatchObject({ concept: 0 });
  expect(await fetchQuestionsMeta({ subject: 'mathematics', topic: 'geometry', mode: 'concept' })).toMatchObject({ total: 0 });
  expect(redisTracker.totalCommands()).toBe(0);

  // Unknown arbitrary topic expired after 5s negativeMs -> rechecks Redis.
  await fetchQuestionCounts({ subject: 'mathematics', topic: 'random-unknown-slug-xyz' });
  expect(redisTracker.totalCommands()).toBeGreaterThan(0);
  clock.mockRestore();

  // Rebuilding a non-empty subject snapshot must NOT acquire 25 per-topic Redis locks.
  await createQuestionsBulk([{ id: 'q1', subject: 'mathematics', topic: 'percentages', quizName: 'PYQ' }]);
  clearSharedLocalCaches();
  questionCountsCache.clear();
  redisTracker.resetAll();

  await db.collection('questionMetadata').deleteMany({ kind: 'topic-counts' });
  const rebuilt = await fetchTopicCountSnapshot('mathematics');
  expect(rebuilt.totals.percentages).toBe(1);
  expect(rebuilt.totals.geometry).toBe(0);
  // Only 1 snapshot-level get + 1 acquireLease eval + 1 writeWithLease eval = 3 Redis ops (zero MGETs, zero per-topic locks!).
  expect(redisTracker.counts.mGet).toBe(0);
  expect(redisTracker.counts.eval).toBe(2);
  expect(redisTracker.locks.size).toBe(0);
});

it('caches dashboard and empty/non-empty topic progress with longer TTLs, zero distributed lock EVALs, and zero dead Pub/Sub publishes while retaining shared question Pub/Sub', async () => {
  const baseNow = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(baseNow);

  const buildProgress = vi.fn(async () => []);
  expect(await cachedTopicProgress('empty-learner', buildProgress)).toEqual([]);
  // Cold miss: 1 GET + 1 SET, 0 EVAL lock scripts!
  expect(redisTracker.counts.eval).toBe(0);
  expect(redisTracker.counts.get).toBe(1);
  expect(redisTracker.counts.set).toBe(1);
  redisTracker.resetCounts();

  // Empty progress [] is NOT downgraded to 5s negativeMs; stays warm in L1 at +15s and +180s (< 300s).
  for (const offset of [15_000, 180_000]) {
    clock.mockReturnValue(baseNow + offset);
    expect(await cachedTopicProgress('empty-learner', buildProgress)).toEqual([]);
  }
  expect(buildProgress).toHaveBeenCalledTimes(1);
  expect(redisTracker.totalCommands()).toBe(0);

  // Advancing durable revision immediately invalidates despite 300s TTL, and progress invalidate() emits 0 dead Redis PUBLISHes.
  await advanceTopicProgressRevision('empty-learner', {});
  await invalidateTopicProgress().catch(() => {});
  await invalidateTrainingDashboard().catch(() => {});
  expect(redisTracker.counts.publish).toBe(0);

  const updatedProgress = vi.fn(async () => [{ topic: 'algebra', solvedCount: 1 }]);
  expect(await cachedTopicProgress('empty-learner', updatedProgress)).toEqual([{ topic: 'algebra', solvedCount: 1 }]);
  expect(updatedProgress).toHaveBeenCalledTimes(1);
  expect(redisTracker.counts.eval).toBe(0);

  // Dashboard cache uses 120s TTL, zero lock EVALs, and still honors active session deadlines.
  redisTracker.resetCounts();
  const buildDash = vi.fn(async () => ({ active: [], readiness: 50 }));
  expect(await cachedTrainingDashboard('u1', 'ssc-cgl', buildDash)).toEqual({ active: [], readiness: 50 });
  expect(redisTracker.counts.eval).toBe(0);
  redisTracker.resetCounts();

  clock.mockReturnValue(baseNow + 180_000 + 60_000); // +60s (< 120s TTL)
  expect(await cachedTrainingDashboard('u1', 'ssc-cgl', buildDash)).toEqual({ active: [], readiness: 50 });
  expect(buildDash).toHaveBeenCalledTimes(1);
  expect(redisTracker.totalCommands()).toBe(0);

  clock.mockReturnValue(baseNow + 180_000 + TRAINING_DASHBOARD_CACHE_TTL_SECONDS * 1000 + 100);
  expect(await cachedTrainingDashboard('u1', 'ssc-cgl', buildDash)).toEqual({ active: [], readiness: 50 });
  expect(buildDash).toHaveBeenCalledTimes(2);
  expect(TOPIC_PROGRESS_CACHE_TTL_SECONDS).toBe(300);
  expect(TRAINING_DASHBOARD_CACHE_TTL_SECONDS).toBe(120);
  clock.mockRestore();

  // Shared question invalidation MUST retain Redis Pub/Sub!
  redisTracker.resetCounts();
  await invalidateQuestionMetadata();
  expect(redisTracker.counts.publish).toBe(1);
});

