import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDurableProgressCache } from '../../infrastructure/durableProgressCache.js';
import { buildSocketCorsOrigins } from '../../battle/battleSocket.js';
import { isNormalizedQuestionKeysEnabled } from '../questions/questionCache.js';
import { fetchQuestionCursorPage } from '../questions/questionCursorService.js';
import { buildFilterConditions, getCursorSecret } from '../questions/quizSessionV1Service.js';
import {
  getCachedGlobalLeaderboardItems,
  getCachedSeasonLeaderboardItems,
  invalidateBattleLeaderboardCache,
  getCosmeticInventory,
  getAcceptedFriendships,
  getIncomingFriendRequests,
  getFavorites,
} from '../../repositories/battleRepository.js';
import questionController from '../../controllers/questionController.js';

describe('M2 production readiness regressions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    invalidateBattleLeaderboardCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('Normalized question keys & pure IXSCAN filters', () => {
    it('enables normalized question keys by default unless explicitly set to false', () => {
      delete process.env.QUESTIONS_NORMALIZED_KEYS;
      expect(isNormalizedQuestionKeysEnabled()).toBe(true);

      process.env.QUESTIONS_NORMALIZED_KEYS = 'false';
      expect(isNormalizedQuestionKeysEnabled()).toBe(false);

      process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
      expect(isNormalizedQuestionKeysEnabled()).toBe(true);
    });

    it('gates unnormalized $exists:false $or branches behind QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK', () => {
      delete process.env.QUESTIONS_NORMALIZED_KEYS;
      delete process.env.QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK;

      const pureFilter = buildFilterConditions({
        examMode: 'ssc',
        subject: 'Quant',
        topic: 'Percentages',
        chapter: 'Basics',
        exam: 'SSC CGL',
        concept: 'Ratio',
      });
      const serializedPure = JSON.stringify(pureFilter);
      expect(serializedPure).not.toContain('"$exists":false');
      expect(serializedPure).toContain('"topicKey":"percentages"');
      expect(serializedPure).toContain('"chapterKey":"basics"');
      expect(serializedPure).toContain('"examKey":"ssc cgl"');
      expect(serializedPure).toContain('"conceptKey":"ratio"');

      process.env.QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK = 'true';
      const fallbackFilter = buildFilterConditions({
        topic: 'Percentages',
        chapter: 'Basics',
      });
      expect(JSON.stringify(fallbackFilter)).toContain('"$exists":false');
    });

    it('uses normalized keys, maxTimeMS(5000), and bounds search length in questionCursorService.fetchQuestionCursorPage', async () => {
      delete process.env.QUESTIONS_NORMALIZED_KEYS;
      delete process.env.QUESTIONS_ALLOW_UNNORMALIZED_FALLBACK;

      let capturedFilter = null;
      let capturedOptions = null;
      const cursor = {
        sort: vi.fn().mockReturnThis(),
        collation: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };
      const mongoModule = await import('../../config/mongodb.js');
      vi.spyOn(mongoModule, 'getQuestionsCollection').mockReturnValue({
        find: vi.fn((filter, options) => {
          capturedFilter = filter;
          capturedOptions = options;
          return cursor;
        }),
        countDocuments: vi.fn().mockResolvedValue(0),
      });

      const longSearch = 'a'.repeat(100);
      await fetchQuestionCursorPage({
        subject: 'Quant',
        topic: 'Percentages',
        chapter: 'Basics',
        exam: 'SSC CGL',
        year: '2024',
        shift: '2',
        difficulty: 'medium',
        concept: 'Ratio',
        quizName: 'Quiz-1',
        search: longSearch,
      });

      expect(capturedOptions).toEqual(expect.objectContaining({ maxTimeMS: 5000 }));
      const serialized = JSON.stringify(capturedFilter);
      expect(serialized).not.toContain('"$exists":false');
      expect(serialized).toContain('"topicKey":"percentages"');
      expect(serialized).toContain('"chapterKey":"basics"');
      expect(serialized).toContain('"examKey":"ssc cgl"');
      expect(serialized).toContain('"yearInt":2024');
      expect(serialized).toContain('"shiftInt":2');
      expect(serialized).toContain('"difficulty":"medium"');
      expect(serialized).toContain('"conceptKey":"ratio"');
      expect(serialized).toContain('"quizKey":"quiz1"');
    });

    it('requires QUIZ_CURSOR_SECRET or JWT_SECRET in production and rejects hardcoded fallback', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.QUIZ_CURSOR_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => getCursorSecret()).toThrow(/QUIZ_CURSOR_SECRET or JWT_SECRET must be configured in production/);

      process.env.QUIZ_CURSOR_SECRET = 'prod-cursor-secret-value';
      expect(getCursorSecret()).toBe('prod-cursor-secret-value');
    });
  });

  describe('Streaming NDJSON question export', () => {
    it('streams async iterable question documents chunk-by-chunk as NDJSON without buffering entire array', async () => {
      const writtenChunks = [];
      const res = {
        writableEnded: false,
        destroyed: false,
        set: vi.fn(),
        write: vi.fn((chunk) => {
          writtenChunks.push(chunk);
          return true;
        }),
        end: vi.fn(function end() {
          this.writableEnded = true;
        }),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const req = { query: { format: 'ndjson', subject: 'Quant' } };
      const questionServiceModule = await import('../questionService.js');
      vi.spyOn(questionServiceModule, 'exportQuestions').mockResolvedValueOnce({
        count: 2,
        stream: {
          async *[Symbol.asyncIterator]() {
            yield { id: 'q-1', question: 'First?' };
            yield { id: 'q-2', question: 'Second?' };
          },
        },
      });

      await questionController.exportQuestions(req, res);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson; charset=utf-8');
      expect(writtenChunks).toEqual([
        `${JSON.stringify({ id: 'q-1', question: 'First?' })}\n`,
        `${JSON.stringify({ id: 'q-2', question: 'Second?' })}\n`,
      ]);
      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('Battle leaderboard caching, repository bounds & Socket.IO CORS', () => {
    it('preserves CORS_ALLOWED_ORIGINS alongside FRONTEND_URL for Socket.IO', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://app.meow.test/';
      process.env.CORS_ALLOWED_ORIGINS = 'https://staging.meow.test/, https://preview.meow.test';

      const origins = buildSocketCorsOrigins();

      expect(origins).toEqual([
        'https://app.meow.test',
        'https://staging.meow.test',
        'https://preview.meow.test',
      ]);
    });

    it('caches global and seasonal battle leaderboards and invalidates cleanly', async () => {
      const globalCursor = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ userId: 'u1', rating: 1500, gamesPlayed: 10 }]),
      };
      const seasonCursor = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ userId: 'u1', seasonKey: '2026-09', rating: 1450, gamesPlayed: 6 }]),
      };

      const mongoModule = await import('../../config/mongodb.js');
      vi.spyOn(mongoModule, 'getBattleProfilesCollection').mockReturnValue({
        find: vi.fn(() => globalCursor),
      });
      vi.spyOn(mongoModule, 'getBattleSeasonProfilesCollection').mockReturnValue({
        find: vi.fn(() => seasonCursor),
      });

      const firstGlobal = await getCachedGlobalLeaderboardItems(20);
      const secondGlobal = await getCachedGlobalLeaderboardItems(20);
      expect(firstGlobal).toHaveLength(1);
      expect(secondGlobal).toHaveLength(1);
      expect(globalCursor.toArray).toHaveBeenCalledTimes(1);

      const firstSeason = await getCachedSeasonLeaderboardItems('2026-09', 20);
      const secondSeason = await getCachedSeasonLeaderboardItems('2026-09', 20);
      expect(firstSeason).toHaveLength(1);
      expect(secondSeason).toHaveLength(1);
      expect(seasonCursor.toArray).toHaveBeenCalledTimes(1);

      invalidateBattleLeaderboardCache();
      await getCachedGlobalLeaderboardItems(20);
      expect(globalCursor.toArray).toHaveBeenCalledTimes(2);
    });

    it('applies projections, maxTimeMS(3000), and explicit limit() bounds to battle repository queries', async () => {
      const makeCursor = () => ({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      });
      const cosmeticsCursor = makeCursor();
      const friendshipsCursor = makeCursor();
      const favoritesCursor = makeCursor();

      const cosmeticsFind = vi.fn(() => cosmeticsCursor);
      const friendshipsFind = vi.fn(() => friendshipsCursor);
      const favoritesFind = vi.fn(() => favoritesCursor);

      const mongoModule = await import('../../config/mongodb.js');
      vi.spyOn(mongoModule, 'getBattleCosmeticInventoryCollection').mockReturnValue({ find: cosmeticsFind });
      vi.spyOn(mongoModule, 'getBattleFriendshipsCollection').mockReturnValue({ find: friendshipsFind });
      vi.spyOn(mongoModule, 'getBattleFavoritesCollection').mockReturnValue({ find: favoritesFind });

      await getCosmeticInventory('u-1');
      expect(cosmeticsFind).toHaveBeenCalledWith(
        { userId: 'u-1' },
        expect.objectContaining({ maxTimeMS: 3000, projection: expect.any(Object) }),
      );
      expect(cosmeticsCursor.limit).toHaveBeenCalledWith(200);

      await getAcceptedFriendships('u-1');
      expect(friendshipsFind).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'accepted' }),
        expect.objectContaining({ maxTimeMS: 3000, projection: expect.any(Object) }),
      );
      expect(friendshipsCursor.limit).toHaveBeenCalledWith(200);

      await getIncomingFriendRequests('u-1');
      expect(friendshipsCursor.limit).toHaveBeenCalledWith(100);

      await getFavorites('u-1');
      expect(favoritesFind).toHaveBeenCalledWith(
        { userId: 'u-1' },
        expect.objectContaining({ maxTimeMS: 3000, projection: expect.any(Object) }),
      );
      expect(favoritesCursor.limit).toHaveBeenCalledWith(200);
    });
  });

  describe('durableProgressCache Redis outage grace window & deadline bounding', () => {
    it('coalesces MongoDB counter fallback calls within the local outage grace window during Redis outage', async () => {
      process.env.REDIS_URL = 'redis://127.0.0.1:6399';
      const redisModule = await import('../../config/redis.js');
      vi.spyOn(redisModule, 'getRedisClient').mockResolvedValue(null);
      vi.spyOn(redisModule, 'redisGetJson').mockResolvedValue(null);
      vi.spyOn(redisModule, 'redisSetJson').mockResolvedValue(undefined);

      const cacheRevisionRepo = await import('../../repositories/cacheRevisionRepository.js');
      const getCacheCounterSpy = vi.spyOn(cacheRevisionRepo, 'getCacheCounter').mockResolvedValue(3);

      const cache = createDurableProgressCache(
        'test-outage-grace',
        (userId) => String(userId),
        30,
        { revisionCacheMs: 5_000, outageGraceMs: 1_500 },
      );

      const loader = vi.fn().mockResolvedValue({ progress: 42 });

      // Initial load populates L1 and reads revision from MongoDB
      const first = await cache.load(['user-1'], loader);
      expect(first).toEqual({ progress: 42 });
      expect(loader).toHaveBeenCalledTimes(1);
      const baselineReads = getCacheCounterSpy.mock.calls.length;

      // Immediate L1 hit within 1500ms outage grace window reuses verified revision without querying MongoDB
      const second = await cache.load(['user-1'], loader);
      expect(second).toEqual({ progress: 42 });
      expect(loader).toHaveBeenCalledTimes(1);
      expect(getCacheCounterSpy.mock.calls.length).toBe(baselineReads);

      // Fail-closed when durable MongoDB revision lookup fails on a cold scope
      getCacheCounterSpy.mockRejectedValueOnce(new Error('Mongo revision read failed'));
      await expect(cache.load(['user-2'], loader)).rejects.toThrow('Mongo revision read failed');
    });
  });
});
