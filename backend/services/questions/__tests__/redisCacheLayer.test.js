import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  redisStore: new Map(),
  redisTtls: new Map(),
  redisOnline: true,
  publishEvents: [],
  deletedKeys: [],
  questionRevision: 1,
  progressRevisions: new Map(),
  progressCounterCalls: 0,
  authFindCalls: 0,
  onAuthSessionFind: null,
  authUser: { id: 'u1', email: 'u1@test.local', name: 'Learner', role: 'student', status: 'active', authRevision: 0 },
  authSession: { _id: 'sid-1', userId: 'u1', revision: 0, expiresAt: new Date(Date.now() + 3600_000) },
  subscriberClients: [],
}));

vi.mock('redis', () => ({
  createClient: vi.fn(() => {
    const emitter = new EventEmitter();
    const client = Object.assign(emitter, {
      isOpen: false,
      isReady: false,
      connect: vi.fn(async () => {
        client.isOpen = true;
        client.isReady = true;
      }),
      subscribe: vi.fn(async (_channel, handler) => {
        client._onMessage = handler;
      }),
      destroy: vi.fn(() => {
        client.isOpen = false;
        client.isReady = false;
      }),
    });
    state.subscriberClients.push(client);
    return client;
  }),
}));

vi.mock('../../../config/redis.js', () => {
  const client = {
    isReady: true,
    eval: vi.fn(async () => 1),
    publish: vi.fn(async (channel, payload) => {
      state.publishEvents.push({ channel, payload: JSON.parse(payload) });
      return 1;
    }),
  };
  return {
    getRedisClient: vi.fn(async () => (state.redisOnline ? client : null)),
    redisKey: suffix => `test:v1:${suffix}`,
    reportRedisFailure: vi.fn(),
    redisGetJson: vi.fn(async key => {
      if (!state.redisOnline) return null;
      const raw = state.redisStore.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    }),
    redisGetJsonMany: vi.fn(async keys => {
      if (!state.redisOnline) return keys.map(() => null);
      return keys.map(key => {
        const raw = state.redisStore.get(key);
        return raw === undefined ? null : JSON.parse(raw);
      });
    }),
    redisSetJson: vi.fn(async (key, value, ttlSeconds) => {
      if (!state.redisOnline) return false;
      state.redisStore.set(key, JSON.stringify(value));
      state.redisTtls.set(key, ttlSeconds);
      return true;
    }),
    redisDelete: vi.fn(async (...keys) => {
      state.deletedKeys.push(...keys);
      if (!state.redisOnline) return;
      for (const key of keys) {
        state.redisStore.delete(key);
        state.redisTtls.delete(key);
      }
    }),
  };
});

vi.mock('../../../repositories/questionMetadataRepository.js', () => ({
  readQuestionRevision: vi.fn(async () => ({ revision: state.questionRevision })),
  advanceQuestionRevision: vi.fn(async () => {
    state.questionRevision += 1;
  }),
  findPersistedQuestionMetadata: vi.fn(async () => null),
  savePersistedQuestionMetadata: vi.fn(async () => {}),
}));

vi.mock('../../../repositories/cacheRevisionRepository.js', () => ({
  getCacheCounter: vi.fn(async scope => {
    state.progressCounterCalls += 1;
    return state.progressRevisions.get(scope) ?? 0;
  }),
  advanceCacheCounter: vi.fn(async scope => {
    state.progressRevisions.set(scope, (state.progressRevisions.get(scope) ?? 0) + 1);
  }),
}));

vi.mock('../../../config/mongodb.js', () => ({
  getUsersCollection: () => ({
    findOne: vi.fn(async () => {
      state.authFindCalls += 1;
      return { ...state.authUser };
    }),
    updateOne: vi.fn(async () => {
      state.authUser.authRevision += 1;
      return { modifiedCount: 1 };
    }),
  }),
  getMongoDB: () => ({
    collection: () => ({
      findOne: vi.fn(async () => {
        state.authFindCalls += 1;
        const result = state.authSession.revokedAt || state.authSession.expiresAt <= new Date()
          ? null
          : { ...state.authSession };
        if (state.onAuthSessionFind) await state.onAuthSessionFind(state.authFindCalls, result);
        return result;
      }),
      updateOne: vi.fn(async (_filter, update) => {
        if (update?.$set) Object.assign(state.authSession, update.$set);
        if (update?.$inc?.revision) state.authSession.revision += update.$inc.revision;
        return { modifiedCount: 1 };
      }),
      updateMany: vi.fn(async (_filter, update) => {
        if (update?.$set) Object.assign(state.authSession, update.$set);
        if (update?.$inc?.revision) state.authSession.revision += update.$inc.revision;
        return { modifiedCount: 1 };
      }),
      find: () => ({ toArray: async () => [{ ...state.authSession }] }),
    }),
  }),
}));

vi.mock('../../../battle/battleRealtime.js', () => ({
  getBattleRealtimeServer: () => null,
}));

import { createTieredCache, clearSharedLocalCaches } from '../../../infrastructure/tieredCache.js';
import {
  getCacheHitSummary,
  observeQuestionDelivery,
  registry,
  resetCacheHitSummary,
} from '../../../infrastructure/metrics.js';
import { createDurableProgressCache } from '../../../infrastructure/durableProgressCache.js';
import {
  CACHE_TTLS,
  cachedExamConfig,
  cachedPublicStats,
  cachedQuestionAnswerKey,
  cachedQuestionById,
  cachedQuestionPage,
  cachedQuizSession,
  cachedTopicMetadata,
  cachedTopicPool,
  invalidateQuestionCacheRevision,
  invalidateQuestionCaches,
  invalidateQuizSessionCache,
  isHighCardinalityFilter,
  isNormalizedKeysEnabled,
  isNormalizedQuestionKeysEnabled,
} from '../questionCache.js';
import { redisDelete, redisGetJson, redisSetJson } from '../../../config/redis.js';

beforeEach(() => {
  state.redisStore.clear();
  state.redisTtls.clear();
  state.redisOnline = true;
  state.publishEvents = [];
  state.deletedKeys = [];
  state.questionRevision = 1;
  state.progressRevisions.clear();
  state.progressCounterCalls = 0;
  state.authFindCalls = 0;
  state.onAuthSessionFind = null;
  state.authUser = { id: 'u1', email: 'u1@test.local', name: 'Learner', role: 'student', status: 'active', authRevision: 0 };
  state.authSession = { _id: 'sid-1', userId: 'u1', revision: 0, expiresAt: new Date(Date.now() + 3600_000) };
  state.subscriberClients = [];
  clearSharedLocalCaches();
  invalidateQuestionCacheRevision();
  resetCacheHitSummary();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Phase 3 Redis cache metrics & >80% hit-ratio verification', () => {
  it('tracks L1 hits, Redis hits, misses, and delivery histograms achieving >80% Redis hit ratio', async () => {
    const loader = vi.fn(async id => ({ questionUid: id, text: `Question ${id}` }));

    // Cold populate 5 distinct questions (5 misses).
    for (let i = 0; i < 5; i++) {
      await cachedQuestionById(`q_${i}`, () => loader(`q_${i}`));
    }
    expect(loader).toHaveBeenCalledTimes(5);

    // Simulate 30 cross-instance reads hitting shared Redis (clear L1 before each read).
    for (let i = 0; i < 30; i++) {
      clearSharedLocalCaches();
      const id = `q_${i % 5}`;
      const result = await cachedQuestionById(id, () => loader(id));
      expect(result.questionUid).toBe(id);
    }
    expect(loader).toHaveBeenCalledTimes(5);

    // Simulate 25 warm L1 reads.
    for (let i = 0; i < 25; i++) {
      const id = `q_${i % 5}`;
      await cachedQuestionById(id, () => loader(id));
    }

    const summary = getCacheHitSummary('question-item');
    // 30 cleared-L1 reads + 4 cold-L1 reads for q_0..q_3 at the start of the warm loop = 34 Redis hits; 21 L1 hits.
    expect(summary.redisHits).toBe(34);
    expect(summary.l1Hits).toBe(21);
    expect(summary.redisMisses).toBe(5);
    expect(summary.sourceMisses).toBe(5);
    expect(summary.totalReads).toBe(60);
    expect(summary.redisHitRatio).toBeGreaterThan(0.8);
    expect(summary.hitRatio).toBeGreaterThan(0.9);

    observeQuestionDelivery({
      endpoint: '/api/v1/quiz/sessions/:id/questions',
      mode: 'practice',
      payloadBytes: 24576,
      batchSize: 25,
      duplicatesPrevented: 2,
      surface: 'session-batch',
    });

    const promText = await registry.metrics();
    expect(promText).toContain('meow_cache_operations_total');
    expect(promText).toContain('cache="question-item"');
    expect(promText).toContain('meow_question_delivery_payload_bytes');
    expect(promText).toContain('meow_question_delivery_batch_size');
    expect(promText).toContain('meow_question_delivery_duplicates_prevented_total');
  });
});

describe('Phase 3 TTL jitter variance', () => {
  it('applies +/-15% jitter to both freshUntil and staleUntil (and Redis EX) even when freshMs === staleMs', async () => {
    const ttls = [];
    const envelopes = [];
    const samples = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
    let idx = 0;
    const cache = createTieredCache({
      name: 'jitter-test',
      freshMs: 300_000,
      staleMs: 300_000,
      strictMaxTtl: false,
      distributedLock: false,
      now: () => 1_000_000,
      random: () => samples[idx++],
      setShared: async (_key, entry, ttlSeconds) => {
        envelopes.push(entry);
        ttls.push(ttlSeconds);
        return true;
      },
    });

    for (let i = 0; i < samples.length; i++) {
      await cache.read(`k${i}`, async () => ({ v: i }));
    }

    // Never clamped at 50%: upper half extends cleanly up to +15% (345s), lower half to -15% (255s).
    expect(Math.min(...ttls)).toBe(255);
    expect(Math.max(...ttls)).toBe(345);
    expect(new Set(ttls).size).toBe(samples.length);
    // For freshMs === staleMs, freshUntil tracks staleUntil smoothly across the full range.
    expect(envelopes[0].freshUntil).toBe(1_255_000);
    expect(envelopes[3].freshUntil).toBe(1_300_000);
    expect(envelopes[6].freshUntil).toBe(1_345_000);
    expect(envelopes[6].staleUntil).toBe(1_345_000);
  });

  it('caps strictMaxTtl caches at 100% while still spreading expirations downward', async () => {
    const ttls = [];
    const samples = [0.0, 0.5, 1.0];
    let idx = 0;
    const cache = createTieredCache({
      name: 'strict-jitter-test',
      freshMs: 120_000,
      staleMs: 120_000,
      strictMaxTtl: true,
      distributedLock: false,
      now: () => 1_000_000,
      random: () => samples[idx++],
      setShared: async (_key, _entry, ttlSeconds) => {
        ttls.push(ttlSeconds);
        return true;
      },
    });

    for (let i = 0; i < samples.length; i++) {
      await cache.read(`s${i}`, async () => ({ v: i }));
    }
    expect(ttls).toEqual([102, 111, 120]);
  });
});

describe('Phase 3 versioned question cache wrappers & scoped invalidation', () => {
  it('exposes standard TTL constants, normalized-key helpers, and SWR / session cache wrappers', async () => {
    expect(CACHE_TTLS).toEqual({
      QUESTION_MS: 30 * 60 * 1000,
      TOPIC_METADATA_MS: 6 * 60 * 60 * 1000,
      EXAM_CONFIG_MS: 6 * 60 * 60 * 1000,
      PUBLIC_STATS_MS: 5 * 60 * 1000,
      SESSION_META_MS: 30 * 60 * 1000,
    });

    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', '');
    expect(isNormalizedQuestionKeysEnabled()).toBe(true);
    expect(isNormalizedKeysEnabled()).toBe(true);
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'false');
    expect(isNormalizedQuestionKeysEnabled()).toBe(false);
    expect(isNormalizedKeysEnabled()).toBe(false);
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
    expect(isNormalizedQuestionKeysEnabled()).toBe(true);
    expect(isNormalizedKeysEnabled()).toBe(true);

    const keyLoader = vi.fn(async () => ({ correctIndex: 2, solution: 'Because...' }));
    expect(await cachedQuestionAnswerKey('q_uid_1', keyLoader)).toEqual({ correctIndex: 2, solution: 'Because...' });
    expect(await cachedQuestionAnswerKey('q_uid_1', keyLoader)).toEqual({ correctIndex: 2, solution: 'Because...' });
    expect(keyLoader).toHaveBeenCalledTimes(1);

    const metaLoader = vi.fn(async () => ({ total: 500, exams: ['SSC CGL'] }));
    expect(await cachedTopicMetadata({ subject: 'mathematics', topic: 'algebra' }, metaLoader)).toEqual({ total: 500, exams: ['SSC CGL'] });
    expect(await cachedTopicMetadata({ subject: 'mathematics', topic: 'algebra' }, metaLoader)).toEqual({ total: 500, exams: ['SSC CGL'] });
    expect(metaLoader).toHaveBeenCalledTimes(1);

    const examLoader = vi.fn(async () => ({ examSlug: 'ssc-cgl', totalDurationMin: 60 }));
    expect(await cachedExamConfig('ssc-cgl', examLoader)).toEqual({ examSlug: 'ssc-cgl', totalDurationMin: 60 });
    expect(await cachedExamConfig('ssc-cgl', examLoader)).toEqual({ examSlug: 'ssc-cgl', totalDurationMin: 60 });
    expect(examLoader).toHaveBeenCalledTimes(1);

    const statsLoader = vi.fn(async () => ({ totalQuestions: 105000 }));
    expect(await cachedPublicStats('global', statsLoader)).toEqual({ totalQuestions: 105000 });
    expect(await cachedPublicStats('global', statsLoader)).toEqual({ totalQuestions: 105000 });
    expect(statsLoader).toHaveBeenCalledTimes(1);

    // Session cache + targeted invalidation deletes both L1 and Redis key.
    let sessionVersion = 1;
    const sessionLoader = vi.fn(async () => ({ sessionId: 'sess-1', revision: sessionVersion }));
    expect(await cachedQuizSession('sess-1', sessionLoader)).toEqual({ sessionId: 'sess-1', revision: 1 });
    expect(await cachedQuizSession('sess-1', sessionLoader)).toEqual({ sessionId: 'sess-1', revision: 1 });
    expect(sessionLoader).toHaveBeenCalledTimes(1);

    sessionVersion = 2;
    await invalidateQuizSessionCache('sess-1');
    expect(redisDelete).toHaveBeenCalledWith('tiered:v2:meow:v1:quiz-session:sess-1');
    expect(await cachedQuizSession('sess-1', sessionLoader)).toEqual({ sessionId: 'sess-1', revision: 2 });
    expect(sessionLoader).toHaveBeenCalledTimes(2);
  });

  it('evicts only matching topic/questionUid keys on scoped invalidation, preserving unrelated warm L1 caches', async () => {
    const algPool = vi.fn(async () => [{ id: 'alg-1' }]);
    const geoPool = vi.fn(async () => [{ id: 'geo-1' }]);
    const algItem = vi.fn(async () => ({ id: 'alg-1', questionUid: 'q_alg_1' }));
    const geoItem = vi.fn(async () => ({ id: 'geo-1', questionUid: 'q_geo_1' }));

    await cachedTopicPool({ subject: 'mathematics', topic: 'algebra' }, algPool);
    await cachedTopicPool({ subject: 'mathematics', topic: 'geometry' }, geoPool);
    await cachedQuestionById('q_alg_1', algItem);
    await cachedQuestionById('q_geo_1', geoItem);

    // Scoped invalidation for algebra + q_alg_1 (without bumping global revision for pure L1 isolation check).
    await invalidateQuestionCaches({ topic: 'algebra', questionUids: ['q_alg_1'], bumpRevision: false });

    // Published scoped payload to Redis Pub/Sub.
    expect(state.publishEvents).toHaveLength(1);
    expect(state.publishEvents[0].payload).toMatchObject({
      version: 1,
      type: 'question.changed',
      topic: 'algebra',
      questionUids: ['q_alg_1'],
    });

    // Clear Redis store so any L1 eviction must invoke the source loader.
    state.redisStore.clear();

    // Geometry pool & q_geo_1 MUST remain warm in L1 (loader still called once).
    await cachedTopicPool({ subject: 'mathematics', topic: 'geometry' }, geoPool);
    await cachedQuestionById('q_geo_1', geoItem);
    expect(geoPool).toHaveBeenCalledTimes(1);
    expect(geoItem).toHaveBeenCalledTimes(1);

    // Algebra pool & q_alg_1 WERE evicted and rebuild from source.
    await cachedTopicPool({ subject: 'mathematics', topic: 'algebra' }, algPool);
    await cachedQuestionById('q_alg_1', algItem);
    expect(algPool).toHaveBeenCalledTimes(2);
    expect(algItem).toHaveBeenCalledTimes(2);
  });
});

describe('Phase 3 Redis failure graceful fallback & high-cardinality poisoning guard', () => {
  it('falls back seamlessly to source loader when Redis is offline and resumes caching upon recovery', async () => {
    state.redisOnline = false;
    const loader = vi.fn(async () => ({ id: 'q_fallback', question: '2+2?' }));

    expect(await cachedQuestionById('q_fallback', loader)).toEqual({ id: 'q_fallback', question: '2+2?' });
    expect(loader).toHaveBeenCalledTimes(1);

    // L1 still serves warm entry while Redis is offline.
    expect(await cachedQuestionById('q_fallback', loader)).toEqual({ id: 'q_fallback', question: '2+2?' });
    expect(loader).toHaveBeenCalledTimes(1);

    // When Redis recovers and L1 is cleared, writes populate Redis again.
    state.redisOnline = true;
    clearSharedLocalCaches();
    expect(await cachedQuestionById('q_fallback', loader)).toEqual({ id: 'q_fallback', question: '2+2?' });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(state.redisStore.size).toBeGreaterThan(0);
  });

  it('detects high-cardinality filters and bypasses shared Redis in cachedQuestionPage', async () => {
    expect(isHighCardinalityFilter({ topic: 'algebra', exam: 'SSC CGL,SSC CHSL' })).toBe(false);
    expect(isHighCardinalityFilter({ topic: 'algebra', exam: 'SSC CGL,SSC CHSL,RRB NTPC,MTS' })).toBe(true);
    expect(isHighCardinalityFilter({ topic: 'algebra', concept: ['a', 'b', 'c', 'd'] })).toBe(true);
    expect(isHighCardinalityFilter({ topic: 'algebra', search: 'pythagoras' })).toBe(true);
    expect(isHighCardinalityFilter({ topic: 'algebra', filterBlob: 'x'.repeat(520) })).toBe(true);

    const build = vi.fn(async () => ({ questions: [{ id: '1' }], hasMore: false }));
    vi.mocked(redisSetJson).mockClear();
    vi.mocked(redisGetJson).mockClear();

    const result = await cachedQuestionPage('session', { topic: 'algebra', search: 'arbitrary.*regex' }, build);
    expect(result.questions).toHaveLength(1);
    expect(redisGetJson).not.toHaveBeenCalled();
    expect(redisSetJson).not.toHaveBeenCalled();
    expect(getCacheHitSummary('question-page').bypasses).toBe(1);
  });
});

describe('Phase 3 Auth & Durable Progress MongoDB amplification reduction', () => {
  it('serves warm auth sessions from L1 and Redis with zero MongoDB queries when Pub/Sub subscriber is healthy, and deletes live v2 keys on logout', async () => {
    vi.stubEnv('REDIS_URL', 'redis://isolated-unit');
    vi.resetModules();
    const sessions = await import('../../../auth/sessions.js');
    await sessions.startSessionInvalidationSubscriber();
    expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(true);

    const decoded = { sid: 'sid-1', id: 'u1', role: 'student' };

    // Cold call populates L1 + Redis auth-session:v2 key via MongoDB.
    expect((await sessions.assertSession(decoded)).role).toBe('student');
    const mongoAfterCold = state.authFindCalls;
    expect(mongoAfterCold).toBeGreaterThan(0);

    // 50 warm requests hit L1 with ZERO additional MongoDB queries.
    for (let i = 0; i < 50; i++) {
      expect((await sessions.assertSession(decoded)).role).toBe('student');
    }
    expect(state.authFindCalls).toBe(mongoAfterCold);

    // Simulate a second API instance with cold L1 and healthy Pub/Sub subscriber:
    // serves directly from Redis auth-session:v2 key with ZERO MongoDB queries!
    const liveKeys = [...state.redisStore.keys()];
    expect(liveKeys.some(k => k.startsWith('auth-session:v2:'))).toBe(true);
    await sessions.closeSessionInvalidationSubscriber();
    vi.resetModules();
    const secondInstance = await import('../../../auth/sessions.js');
    await secondInstance.startSessionInvalidationSubscriber();
    expect(secondInstance.isSessionInvalidationSubscriberHealthy()).toBe(true);
    const mongoBeforeSecond = state.authFindCalls;
    expect((await secondInstance.assertSession(decoded)).role).toBe('student');
    expect(state.authFindCalls).toBe(mongoBeforeSecond);

    // Verify forceFresh bypasses L1/Redis and hits MongoDB.
    await secondInstance.assertSession(decoded, { forceFresh: true });
    expect(state.authFindCalls).toBeGreaterThan(mongoBeforeSecond);

    // Revoke session: deletes the EXACT live auth-session:v2 key from Redis and writes a short-lived revocation marker!
    state.deletedKeys = [];
    await secondInstance.revokeSession(decoded);
    expect(state.deletedKeys.some(k => k.startsWith('auth-session:v2:'))).toBe(true);
    expect([...state.redisStore.keys()].some(k => k.startsWith('auth-session:v2:'))).toBe(false);
    expect([...state.redisStore.keys()].some(k => k.startsWith('auth-revoked:v2:sid:'))).toBe(true);
    await expect(secondInstance.assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });

    // Subscriber disconnect immediately reverts to strict MongoDB verification.
    state.subscriberClients.at(-1).emit('error', new Error('dropped'));
    expect(secondInstance.isSessionInvalidationSubscriberHealthy()).toBe(false);
    await secondInstance.closeSessionInvalidationSubscriber();
  });

  it('caches progress revision counters in L1 for 5s to eliminate double MongoDB reads on warm hits, and invalidates immediately on advance', async () => {
    const progressCache = createDurableProgressCache('test-progress', userId => String(userId), 300, {
      revisionCacheMs: 5_000,
    });

    const build = vi.fn(async () => [{ topic: 'algebra', solvedCount: 5 }]);
    expect(await progressCache.load(['u1'], build)).toEqual([{ topic: 'algebra', solvedCount: 5 }]);
    expect(state.progressCounterCalls).toBe(2); // Cold miss: pre + post consistency check.

    // 50 subsequent warm reads within 5s perform ZERO MongoDB getCacheCounter queries!
    for (let i = 0; i < 50; i++) {
      expect(await progressCache.load(['u1'], build)).toEqual([{ topic: 'algebra', solvedCount: 5 }]);
    }
    expect(build).toHaveBeenCalledTimes(1);
    expect(state.progressCounterCalls).toBe(2);

    // Advancing the revision immediately evicts the L1 revision counter so writes are visible right away.
    await progressCache.advance(['u1'], {});
    const updatedBuild = vi.fn(async () => [{ topic: 'algebra', solvedCount: 6 }]);
    expect(await progressCache.load(['u1'], updatedBuild)).toEqual([{ topic: 'algebra', solvedCount: 6 }]);
    expect(updatedBuild).toHaveBeenCalledTimes(1);
    expect(state.progressCounterCalls).toBe(4);
  });
});

describe('Phase 3 Verifier #19 hardening regressions', () => {
  it('fences in-flight auth write-backs against concurrent revocation even when subscriberHealthy is true', async () => {
    vi.stubEnv('REDIS_URL', 'redis://isolated-unit');
    vi.resetModules();
    const sessions = await import('../../../auth/sessions.js');
    await sessions.startSessionInvalidationSubscriber();
    expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(true);

    const decoded = { sid: 'sid-1', id: 'u1', role: 'student' };
    let sessionFindCount = 0;
    let revokedDuringFlight = false;
    state.onAuthSessionFind = async () => {
      sessionFindCount += 1;
      // Trigger logout right as the second authorizationState (`after`) completes,
      // inside the exact race window before L1/Redis write-back.
      if (sessionFindCount >= 1 && !revokedDuringFlight) {
        revokedDuringFlight = true;
        await sessions.revokeSession(decoded);
      }
    };

    await expect(sessions.assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
    expect([...state.redisStore.keys()].some(k => k.startsWith('auth-session:v2:'))).toBe(false);
    expect([...state.redisStore.keys()].some(k => k.startsWith('auth-revoked:v2:sid:'))).toBe(true);
    await expect(sessions.assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
    await sessions.closeSessionInvalidationSubscriber();
  });

  it('always verifies privileged roles against MongoDB and validates strict sessionExpiresAt & subscriber startup deduplication', async () => {
    vi.stubEnv('REDIS_URL', 'redis://isolated-unit');
    vi.resetModules();
    const sessions = await import('../../../auth/sessions.js');
    const { createClient } = await import('redis');

    // Concurrent startup calls must deduplicate to a single Redis subscriber client.
    await Promise.all([
      sessions.startSessionInvalidationSubscriber(),
      sessions.startSessionInvalidationSubscriber(),
      sessions.startSessionInvalidationSubscriber(),
    ]);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(true);

    // Strict sessionExpiresAt validation rejects partial/legacy entries missing numeric sessionExpiresAt.
    expect(sessions.isFreshTrustedEntry({ payload: { role: 'student' }, validUntil: Date.now() + 10_000 }, Date.now())).toBe(false);
    expect(sessions.isFreshTrustedEntry({ payload: { role: 'student' }, validUntil: Date.now() + 10_000, sessionExpiresAt: Date.now() + 60_000 }, Date.now())).toBe(true);

    // Admin role MUST verify live MongoDB state on every call even with a healthy subscriber.
    state.authUser = { id: 'u1', email: 'admin@test.local', name: 'Admin', role: 'admin', status: 'active', authRevision: 0 };
    const adminDecoded = { sid: 'sid-1', id: 'u1', role: 'admin' };
    await sessions.assertSession(adminDecoded);
    const afterFirst = state.authFindCalls;
    await sessions.assertSession(adminDecoded);
    expect(state.authFindCalls).toBeGreaterThan(afterFirst);

    // After 'error' -> 'ready', subscriber must re-subscribe before becoming healthy again.
    const subClient = state.subscriberClients.at(-1);
    let resolveResub;
    subClient.subscribe.mockImplementationOnce(() => new Promise(resolve => { resolveResub = resolve; }));
    subClient.emit('error', new Error('reset'));
    expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(false);
    subClient.emit('ready');
    expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(false);
    resolveResub();
    await vi.waitFor(() => expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(true));

    // Silent revocation failure must degrade subscriberHealthy rather than leaving stale trust enabled.
    vi.mocked(redisSetJson).mockResolvedValueOnce(false);
    await sessions.evictSessionCache('sid-1', 'u1');
    expect(sessions.isSessionInvalidationSubscriberHealthy()).toBe(false);

    await sessions.closeSessionInvalidationSubscriber();
  });

  it('propagates quiz-session invalidation cross-instance, survives questionMetadataCache listener, falls back on >200 UIDs, and matches JSON-array UID keys & partial scopes', async () => {
    // Importing questionMetadataCache registers its unscoped onCacheInvalidation listener calling invalidateQuestionCacheRevision().
    await import('../questionMetadataCache.js');
    const { startCacheInvalidationSubscriber, closeCacheInvalidationSubscriber } = await import('../../../infrastructure/cacheInvalidation.js');

    vi.stubEnv('REDIS_URL', 'redis://isolated-unit');
    await startCacheInvalidationSubscriber();
    const cacheSub = state.subscriberClients.at(-1);

    // 1. Cross-instance quiz-session invalidation via Pub/Sub evicts only the targeted session.
    const sess1Loader = vi.fn(async () => ({ sessionId: 'sess-1', v: 1 }));
    const sess2Loader = vi.fn(async () => ({ sessionId: 'sess-2', v: 1 }));
    await cachedQuizSession('sess-1', sess1Loader);
    await cachedQuizSession('sess-2', sess2Loader);
    state.publishEvents = [];
    await invalidateQuizSessionCache('sess-1');
    expect(state.publishEvents.some(e => e.payload.type === 'quiz-session.changed' && e.payload.sessionId === 'sess-1')).toBe(true);
    state.redisStore.clear();
    // Simulate remote instance receiving quiz-session.changed for sess-1 while sess-2 remains warm.
    cacheSub._onMessage(JSON.stringify({ version: 1, type: 'quiz-session.changed', sessionId: 'sess-1' }));
    await cachedQuizSession('sess-2', sess2Loader);
    expect(sess2Loader).toHaveBeenCalledTimes(1);

    // 2. Scoped invalidation with questionMetadataCache imported MUST still keep geometry warm,
    //    while evicting JSON-array fetchQuestionById keys, publicStats, subject-only pools, and :all: pages!
    const algPool = vi.fn(async () => [{ id: 'alg-1' }]);
    const geoPool = vi.fn(async () => [{ id: 'geo-1' }]);
    const subjectOnlyPool = vi.fn(async () => [{ id: 'math-all' }]);
    const allPage = vi.fn(async () => ({ questions: [{ id: 'all-1' }] }));
    const statsLoader = vi.fn(async () => ({ totalQuestions: 100 }));
    const jsonKeyAlg1 = vi.fn(async () => ({ id: 'q_alg_1' }));
    const jsonKeyAlg10 = vi.fn(async () => ({ id: 'q_alg_10' }));

    await cachedTopicPool({ subject: 'mathematics', topic: 'algebra' }, algPool);
    await cachedTopicPool({ subject: 'mathematics', topic: 'geometry' }, geoPool);
    await cachedTopicPool({ subject: 'mathematics' }, subjectOnlyPool);
    await cachedQuestionPage('list', { page: 1 }, allPage);
    await cachedPublicStats('overview', statsLoader);
    await cachedQuestionById(JSON.stringify(['q_alg_1', 'algebra', '']), jsonKeyAlg1);
    await cachedQuestionById(JSON.stringify(['q_alg_10', 'algebra', '']), jsonKeyAlg10);

    await invalidateQuestionCaches({ topic: 'algebra', questionUids: ['q_alg_1'], bumpRevision: false });
    state.redisStore.clear();

    // Unrelated geometry pool & q_alg_10 MUST remain warm in L1 despite questionMetadataCache listener.
    await cachedTopicPool({ subject: 'mathematics', topic: 'geometry' }, geoPool);
    await cachedQuestionById(JSON.stringify(['q_alg_10', 'algebra', '']), jsonKeyAlg10);
    expect(geoPool).toHaveBeenCalledTimes(1);
    expect(jsonKeyAlg10).toHaveBeenCalledTimes(1);

    // Affected algebra pool, subject-only math pool, :all: page, publicStats, and JSON-array q_alg_1 WERE evicted.
    await cachedTopicPool({ subject: 'mathematics', topic: 'algebra' }, algPool);
    await cachedTopicPool({ subject: 'mathematics' }, subjectOnlyPool);
    await cachedQuestionPage('list', { page: 1 }, allPage);
    await cachedPublicStats('overview', statsLoader);
    await cachedQuestionById(JSON.stringify(['q_alg_1', 'algebra', '']), jsonKeyAlg1);
    expect(algPool).toHaveBeenCalledTimes(2);
    expect(subjectOnlyPool).toHaveBeenCalledTimes(2);
    expect(allPage).toHaveBeenCalledTimes(2);
    expect(statsLoader).toHaveBeenCalledTimes(2);
    expect(jsonKeyAlg1).toHaveBeenCalledTimes(2);

    // 3. Bulk questionUids (>200) must fall back to full unscoped invalidation (never silently truncate).
    const uids205 = Array.from({ length: 205 }, (_, i) => `bulk_q_${i}`);
    await invalidateQuestionCaches({ topic: 'algebra', questionUids: uids205, bumpRevision: false });
    state.redisStore.clear();
    await cachedTopicPool({ subject: 'mathematics', topic: 'geometry' }, geoPool);
    expect(geoPool).toHaveBeenCalledTimes(2);

    await closeCacheInvalidationSubscriber();
  });

  it('fences durableProgressCache against same-instance races, propagates cross-instance bumps via Redis, and ignores empty env strings', async () => {
    // 1. Empty/whitespace PROGRESS_REVISION_CACHE_MS falls back to default 5000ms (not 0).
    vi.stubEnv('PROGRESS_REVISION_CACHE_MS', '   ');
    const envCache = createDurableProgressCache('env-progress', id => String(id), 300);
    const envBuild = vi.fn(async () => ({ solved: 1 }));
    await envCache.load(['u1'], envBuild);
    const callsAfterCold = state.progressCounterCalls;
    await envCache.load(['u1'], envBuild);
    expect(state.progressCounterCalls).toBe(callsAfterCold);

    // 2. Cross-instance read-your-own-writes (<5s) when REDIS_URL is configured.
    vi.stubEnv('REDIS_URL', 'redis://isolated-unit');
    vi.stubEnv('PROGRESS_REVISION_CACHE_MS', '5000');
    const instanceA = createDurableProgressCache('cross-progress', id => String(id), 300);
    const instanceB = createDurableProgressCache('cross-progress', id => String(id), 300);

    let version = 1;
    const readFromDb = vi.fn(async () => ({ solved: version }));
    expect(await instanceB.load(['u1'], readFromDb)).toEqual({ solved: 1 });
    const counterAfterWarm = state.progressCounterCalls;
    // Unbumped warm read on Instance B uses 0 MongoDB counter calls.
    expect(await instanceB.load(['u1'], readFromDb)).toEqual({ solved: 1 });
    expect(state.progressCounterCalls).toBe(counterAfterWarm);

    // Instance A mutates progress and advances durable counter -> Instance B sees it immediately!
    version = 2;
    await instanceA.advance(['u1'], {});
    expect(await instanceB.load(['u1'], readFromDb)).toEqual({ solved: 2 });

    // 3. Same-instance advance() racing right after build/post-check must never populate stale revisionCache.
    const raceCache = createDurableProgressCache('race-progress', id => String(id), 300, { revisionCacheMs: 5000 });
    const { getCacheCounter } = await import('../../../repositories/cacheRevisionRepository.js');
    const originalCounterImpl = vi.mocked(getCacheCounter).getMockImplementation();
    let raceScopeCalls = 0;
    try {
      vi.mocked(getCacheCounter).mockImplementation(async scope => {
        state.progressCounterCalls += 1;
        const rev = state.progressRevisions.get(scope) ?? 0;
        if (scope.startsWith('race-progress:')) {
          raceScopeCalls += 1;
          // On the post-build check (2nd call), advance concurrently right before returning the pre-write rev!
          if (raceScopeCalls === 2) {
            await raceCache.advance(['u1'], {});
          }
        }
        return rev;
      });
      let raceVersion = 10;
      const raceBuild = vi.fn(async () => ({ solved: raceVersion++ }));
      const res = await raceCache.load(['u1'], raceBuild);
      expect(res).toEqual({ solved: 11 });
    } finally {
      vi.mocked(getCacheCounter).mockImplementation(originalCounterImpl);
    }
  });

  it('bounds observeQuestionDelivery metric labels to prevent Prometheus cardinality explosion', async () => {
    observeQuestionDelivery({
      endpoint: '/api/v1/quiz/sessions/550e8400-e29b-41d4-a716-446655440000/questions',
      mode: 'attacker_mode_' + 'x'.repeat(20),
      payloadBytes: 4096,
      batchSize: 10,
      duplicatesPrevented: 1,
      surface: 'arbitrary_surface_999',
    });

    const promText = await registry.metrics();
    expect(promText).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(promText).not.toContain('attacker_mode_');
    expect(promText).not.toContain('arbitrary_surface_999');
    expect(promText).toContain('endpoint="other"');
    expect(promText).toContain('mode="other"');
    expect(promText).toContain('surface="other"');
  });
});
