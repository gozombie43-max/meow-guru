import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const state = vi.hoisted(() => ({
  redisStore: new Map(),
  mgetCalls: 0,
  redisFail: false,
  withTxUseSession: true,
  sessionDoc: null,
  sessionUpdateCalls: [],
  idempotencyInserts: [],
  idempotencyUpdates: [],
  idempotencyDeletes: [],
  collectionOrder: [],
  deferredQuizHistoryResolve: null,
  authSession: { _id: 'sid-1', userId: 'u1', revision: 0, expiresAt: new Date(Date.now() + 3600_000) },
  authUser: { id: 'u1', email: 'u1@test.local', name: 'Learner', role: 'student', status: 'active', authRevision: 0 },
}));

vi.mock('../../../config/redis.js', () => {
  const client = {
    isReady: true,
    eval: vi.fn(async () => 1),
    publish: vi.fn(async () => 1),
  };
  return {
    getRedisClient: vi.fn(async () => (state.redisFail ? null : client)),
    getRateLimitRedisClient: vi.fn(async () => (state.redisFail ? null : client)),
    redisKey: (key) => `test:v1:${key}`,
    reportRedisFailure: vi.fn(),
    redisGetJson: vi.fn(async (key) => {
      if (state.redisFail) return null;
      const raw = state.redisStore.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    }),
    redisGetJsonMany: vi.fn(async (keys) => {
      state.mgetCalls += 1;
      if (state.redisFail) throw new Error('Simulated MGET failure');
      return keys.map((key) => {
        const raw = state.redisStore.get(key);
        return raw === undefined ? null : JSON.parse(raw);
      });
    }),
    redisSetJson: vi.fn(async (key, value) => {
      if (state.redisFail) return false;
      state.redisStore.set(key, JSON.stringify(value));
      return true;
    }),
    redisDelete: vi.fn(async (...keys) => {
      for (const k of keys) state.redisStore.delete(k);
    }),
  };
});

vi.mock('../../../config/mongodb.js', () => {
  const makeCursor = (rows) => ({
    sort: () => makeCursor(rows),
    limit: () => makeCursor(rows),
    toArray: async () => rows,
  });

  const dbObj = {
    collection: (name) => {
      state.collectionOrder.push(name);
      if (name === 'userQuizHistory') {
        return {
          find: () => ({
            sort: () => ({
              limit: () => ({
                toArray: () =>
                  new Promise((resolve) => {
                    if (state.deferredQuizHistoryResolve) {
                      state.deferredQuizHistoryResolve = () => resolve([{ quizKey: 'q1', score: 1 }]);
                    } else {
                      resolve([{ quizKey: 'q1', score: 1 }]);
                    }
                  }),
              }),
            }),
          }),
        };
      }
      if (name === 'aiConversations') {
        return { find: () => makeCursor([{ id: 'c1', title: 'Chat 1' }]) };
      }
      if (name === 'aiMessages') {
        return { find: () => makeCursor([{ conversationId: 'c1', message: { text: 'hi' } }]) };
      }
      if (name === 'userBookmarks') {
        return { find: () => makeCursor([{ questionId: 'qb-1' }]) };
      }
      if (name === 'userAnalytics') {
        return { findOne: vi.fn(async () => ({ failureMap: { algebra: 2 } })) };
      }
      if (name === 'quizSessions') {
        return {
          findOne: vi.fn(async () => state.sessionDoc),
          updateOne: vi.fn(async (filter, update) => {
            state.sessionUpdateCalls.push({ filter, update });
            return { matchedCount: 1, modifiedCount: 1 };
          }),
        };
      }
      if (name === 'idempotencyRecords') {
        return {
          findOne: vi.fn(async () => null),
          insertOne: vi.fn(async (doc) => {
            state.idempotencyInserts.push(doc);
            return { acknowledged: true, insertedId: doc._id };
          }),
          updateOne: vi.fn(async (filter, update) => {
            state.idempotencyUpdates.push({ filter, update });
            return { matchedCount: 1, modifiedCount: 1 };
          }),
          deleteOne: vi.fn(async (filter) => {
            state.idempotencyDeletes.push(filter);
            return { deletedCount: 1 };
          }),
        };
      }
      if (name === 'authSessions') {
        return {
          findOne: vi.fn(async () => ({ ...state.authSession })),
        };
      }
      return {
        find: () => makeCursor([]),
        findOne: vi.fn(async () => null),
      };
    },
  };

  return {
    getMongoDB: () => dbObj,
    withMongoTransaction: async (work) =>
      work({
        db: dbObj,
        session: state.withTxUseSession ? { id: 'tx-session-1' } : undefined,
      }),
    getUsersCollection: () => ({
      findOne: vi.fn(async (query) => {
        if (query?.id === 'u1') {
          return {
            id: 'u1',
            email: 'u1@test.local',
            name: 'Learner',
            role: 'student',
            status: 'active',
            authRevision: 0,
            historyStorageVersion: 1,
          };
        }
        return { ...state.authUser };
      }),
    }),
    getQuestionsCollection: () => ({}),
    getStudyActivityDailyCollection: () => ({}),
  };
});

import { createTieredCache, clearSharedLocalCaches } from '../../../infrastructure/tieredCache.js';
import { signToken } from '../../../auth/jwt.js';
import { getVerifiedBearerToken, tryGetVerifiedBearerToken } from '../../../auth/requestBearer.js';
import { userKeyGenerator } from '../../../middleware/rateLimiter.js';
import { protect } from '../../../middleware/protect.js';
import { getUser } from '../../../repositories/userRepository.js';
import { commitQuizSessionAnswerAtomic } from '../../../repositories/quizSessionRepository.js';

beforeEach(() => {
  state.redisStore.clear();
  state.mgetCalls = 0;
  state.redisFail = false;
  state.withTxUseSession = true;
  state.sessionDoc = {
    sessionId: 'sess-dot-1',
    userId: 'u1',
    mode: 'practice',
    status: 'in_progress',
    revision: 0,
    answers: { q_existing: { questionUid: 'q_existing', isCorrect: true } },
    answeredCount: 1,
  };
  state.sessionUpdateCalls = [];
  state.idempotencyInserts = [];
  state.idempotencyUpdates = [];
  state.idempotencyDeletes = [];
  state.collectionOrder = [];
  state.deferredQuizHistoryResolve = null;
  clearSharedLocalCaches();
  vi.restoreAllMocks();
});

describe('R2 Load Readiness Engineering Hardening', () => {
  it('tieredCache.readMany uses a single MGET for L1 misses, gracefully falls back on Redis error, and respects maxPending > 256', async () => {
    const cache = createTieredCache({
      name: 'r2-batch-test',
      freshMs: 300_000,
      staleMs: 600_000,
      distributedLock: false,
      maxPending: 2048,
      now: () => 1_000_000,
      random: () => 0.5,
    });

    // 1. Cold batch loads q1, q2 in a single batchBuild call and populates L1 + Redis.
    const batchBuild = vi.fn(async (missingKeys) => {
      const m = new Map();
      for (const k of missingKeys) m.set(k, { id: k });
      return m;
    });
    const res1 = await cache.readMany(['q1', 'q2', 'q1'], batchBuild);
    expect(res1.get('q1')).toEqual({ id: 'q1' });
    expect(res1.get('q2')).toEqual({ id: 'q2' });
    expect(state.mgetCalls).toBe(1);
    expect(batchBuild).toHaveBeenCalledTimes(1);
    expect(batchBuild).toHaveBeenCalledWith(['q1', 'q2']);

    // 2. Clear L1 only and ask for [q1, q2, q3]: ONE MGET gets q1+q2 from Redis and batchBuild loads only q3!
    cache.clear();
    const res2 = await cache.readMany(['q1', 'q2', 'q3'], batchBuild);
    expect(res2.get('q1')).toEqual({ id: 'q1' });
    expect(res2.get('q2')).toEqual({ id: 'q2' });
    expect(res2.get('q3')).toEqual({ id: 'q3' });
    expect(state.mgetCalls).toBe(2);
    expect(batchBuild).toHaveBeenCalledTimes(2);
    expect(batchBuild).toHaveBeenLastCalledWith(['q3']);

    // 3. Redis failure falls back gracefully to source without rejecting.
    cache.clear();
    state.redisFail = true;
    const res3 = await cache.readMany(['q1', 'q4'], batchBuild);
    expect(res3.get('q1')).toEqual({ id: 'q1' });
    expect(res3.get('q4')).toEqual({ id: 'q4' });
    state.redisFail = false;

    // 4. >256 concurrent cold pending reads succeed when maxPending is 2048 (no 503 stampede error).
    let releaseGate;
    const gate = new Promise((resolve) => {
      releaseGate = resolve;
    });
    const concurrentReads = Array.from({ length: 320 }, (_, i) =>
      cache.read(`cold-key-${i}`, async () => {
        await gate;
        return { i };
      }),
    );
    await new Promise((r) => setTimeout(r, 15));
    releaseGate();
    const settled = await Promise.all(concurrentReads);
    expect(settled).toHaveLength(320);
    expect(settled[319]).toEqual({ i: 319 });
  });

  it('verifies Bearer JWT once per request across rate limiter keying and protect middleware', async () => {
    const verifySpy = vi.spyOn(jwt, 'verify');
    const token1 = signToken({ id: 'u1', sid: 'sid-1', role: 'student' });
    const token2 = signToken({ id: 'u1', sid: 'sid-1', role: 'student' });

    const req = {
      ip: '127.0.0.1',
      headers: { authorization: `Bearer ${token1}` },
    };

    expect(userKeyGenerator(req)).toBe('u1');
    expect(userKeyGenerator(req)).toBe('u1');
    expect(tryGetVerifiedBearerToken(req)?.id).toBe('u1');
    expect(getVerifiedBearerToken(req)?.id).toBe('u1');

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await protect(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.id).toBe('u1');
    expect(verifySpy).toHaveBeenCalledTimes(1);

    // Changing header invalidates request cache and triggers fresh verification.
    req.headers.authorization = `Bearer ${token2}`;
    expect(getVerifiedBearerToken(req)?.jti).not.toBeUndefined();
    expect(verifySpy).toHaveBeenCalledTimes(2);
  });

  it('userRepository.getUser fetches separated history collections and userAnalytics in parallel', async () => {
    state.deferredQuizHistoryResolve = true;
    const promise = getUser('u1', {
      recentQuizzes: 1,
      aiChats: 1,
      bookmarkEntries: 1,
      failureMap: 1,
    });

    // Give microtasks a chance to initiate all parallel reads before resolving the deferred first read.
    await new Promise((r) => setTimeout(r, 15));
    expect(state.collectionOrder).toEqual(
      expect.arrayContaining(['userQuizHistory', 'aiConversations', 'userBookmarks', 'userAnalytics']),
    );
    expect(typeof state.deferredQuizHistoryResolve).toBe('function');
    state.deferredQuizHistoryResolve();

    const user = await promise;
    expect(user.recentQuizzes).toHaveLength(1);
    expect(user.aiChats).toHaveLength(1);
    expect(user.bookmarkEntries).toHaveLength(1);
    expect(user.failureMap).toEqual({ algebra: 2 });
  });

  it('commitQuizSessionAnswerAtomic uses dot-path answers.<uid> updates and single completed insert inside transactions', async () => {
    const result = await commitQuizSessionAnswerAtomic({
      sessionId: 'sess-dot-1',
      userId: 'u1',
      idempotencyId: 'idem-dot-1',
      fingerprint: 'fp-1',
      questionUid: 'q_new_999',
      buildAnswerOutcome: async () => ({
        skipMutation: false,
        answerEntry: { questionUid: 'q_new_999', isCorrect: true, answer: 1 },
        response: { sessionId: 'sess-dot-1', questionUid: 'q_new_999', accepted: true },
      }),
    });

    expect(result.replayed).toBe(false);
    expect(result.response.answeredCount).toBe(2);
    expect(result.response.revision).toBe(1);

    expect(state.sessionUpdateCalls).toHaveLength(1);
    const setPayload = state.sessionUpdateCalls[0].update.$set;
    expect(setPayload['answers.q_new_999']).toMatchObject({ questionUid: 'q_new_999', isCorrect: true });
    expect(setPayload.answers).toBeUndefined();

    // Replica-set transaction inserts completed idempotency record once (never pending->update).
    expect(state.idempotencyInserts).toHaveLength(1);
    expect(state.idempotencyInserts[0].status).toBe('completed');
    expect(state.idempotencyUpdates).toHaveLength(0);
  });
});
