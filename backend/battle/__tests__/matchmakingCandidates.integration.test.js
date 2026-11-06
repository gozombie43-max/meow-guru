import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';

const redisState = vi.hoisted(() => ({
  owner: null,
  getClientCalls: 0,
  setCalls: 0,
  evalCalls: 0,
}));

vi.mock('../../config/redis.js', () => ({
  redisKey: key => `test:${key}`,
  reportRedisFailure: vi.fn(),
  getRedisClient: vi.fn(async () => {
    redisState.getClientCalls++;
    return {
      set: vi.fn(async (_key, owner) => {
        redisState.setCalls++;
        if (redisState.owner) return null;
        redisState.owner = owner;
        return 'OK';
      }),
      eval: vi.fn(async (_script, { arguments: [owner] }) => {
        redisState.evalCalls++;
        if (redisState.owner !== owner) return 0;
        redisState.owner = null;
        return 1;
      }),
    };
  }),
}));

import { joinMatchmakingQueue, hasMatchmakingCandidates } from '../matchmakingService.js';
import { runBattleMatchmakingWorkerOnce, stopBattleMatchmakingWorker } from '../../services/battleMatchmakingWorker.js';

let mongo, db;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'battle_matchmaking_candidates_test');
  db = await connectMongoDB();
}, 90000);

beforeEach(async () => {
  redisState.owner = null;
  redisState.getClientCalls = 0;
  redisState.setCalls = 0;
  redisState.evalCalls = 0;
  stopBattleMatchmakingWorker();
  for (const name of ['battleMatchmakingQueue', 'battleRooms', 'battleProfiles', 'battlePlayerState', 'battleSeasons']) {
    await db.collection(name).deleteMany({});
  }
});

afterEach(() => {
  stopBattleMatchmakingWorker();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await disconnectMongoDB();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

it('executes zero Redis lock commands when the matchmaking queue is empty or has one player', async () => {
  for (let i = 0; i < 5; i++) await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);
  expect(redisState.setCalls).toBe(0);

  await joinMatchmakingQueue({ userId: 'solo-player', displayName: 'Solo', subject: 'mathematics', topic: 'algebra', questionCount: 10 });
  expect(await hasMatchmakingCandidates()).toBe(false);
  for (let i = 0; i < 3; i++) await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);
  expect(redisState.setCalls).toBe(0);
});

it('skips Redis locks for incompatible players until rating expansion makes them matchable', async () => {
  await db.collection('battleProfiles').insertMany([
    { userId: 'p1', rating: 1000 },
    { userId: 'p2', rating: 1350 },
    { userId: 'p3', rating: 1000 },
  ]);
  await joinMatchmakingQueue({ userId: 'p1', displayName: 'P1', subject: 'mathematics', topic: 'algebra', questionCount: 10 });
  await joinMatchmakingQueue({ userId: 'p3', displayName: 'P3', subject: 'english', topic: 'tenses', questionCount: 10 });
  await joinMatchmakingQueue({ userId: 'p2', displayName: 'P2', subject: 'mathematics', topic: 'algebra', questionCount: 10 });

  // p1 vs p3 differ by subject; p1 vs p2 have a 350 rating gap vs initial 100 allowed range.
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);

  // Age p1's ticket by 75s -> allowed range expands to 100 + 5 * 50 = 350.
  const aged = new Date(Date.now() - 75_000);
  await db.collection('battleMatchmakingQueue').updateOne({ userId: 'p1' }, { $set: { queuedAt: aged } });

  await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(1);
  expect(redisState.setCalls).toBe(1);
  expect(await db.collection('battleRooms').countDocuments()).toBe(1);

  // Subsequent ticks with only p3 remaining return to zero Redis operations.
  redisState.getClientCalls = 0;
  redisState.setCalls = 0;
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);
  expect(redisState.setCalls).toBe(0);
});

it('acquires the lock and pairs a match beyond the first 25 incompatible waiting tickets', async () => {
  const baseTime = Date.now() - 5_000;
  const docs = Array.from({ length: 25 }, (_, i) => ({
    userId: `u-${i}`,
    displayName: `U${i}`,
    rating: 1200,
    subject: 'mathematics',
    topic: `distinct-topic-${i}`,
    questionCount: 10,
    status: 'waiting',
    queuedAt: new Date(baseTime + i),
    updatedAt: new Date(baseTime + i),
    expiresAt: new Date(baseTime + 600_000),
  }));
  docs.push({
    userId: 'u-match',
    displayName: 'Match',
    rating: 1200,
    subject: 'mathematics',
    topic: 'distinct-topic-0',
    questionCount: 10,
    status: 'waiting',
    queuedAt: new Date(baseTime + 100),
    updatedAt: new Date(baseTime + 100),
    expiresAt: new Date(baseTime + 600_000),
  });
  await db.collection('battleMatchmakingQueue').insertMany(docs);
  for (const doc of docs) {
    await db.collection('battlePlayerState').insertOne({
      userId: doc.userId,
      kind: 'queue',
      resourceId: doc.userId,
      expiresAt: doc.expiresAt,
      updatedAt: new Date(),
    });
  }

  expect(await hasMatchmakingCandidates()).toBe(true);
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.setCalls).toBe(1);
  expect(await db.collection('battleRooms').countDocuments()).toBe(1);
});

it('executes zero Redis lock commands even when 30+ incompatible solo tickets are waiting', async () => {
  const baseTime = Date.now() - 5_000;
  const docs = Array.from({ length: 30 }, (_, i) => ({
    userId: `solo-${i}`,
    displayName: `Solo${i}`,
    rating: 1200,
    subject: 'mathematics',
    topic: `distinct-solo-topic-${i}`,
    questionCount: 10,
    status: 'waiting',
    queuedAt: new Date(baseTime + i),
    updatedAt: new Date(baseTime + i),
    expiresAt: new Date(baseTime + 600_000),
  }));
  await db.collection('battleMatchmakingQueue').insertMany(docs);

  expect(await hasMatchmakingCandidates()).toBe(false);
  for (let i = 0; i < 3; i++) await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);
  expect(redisState.setCalls).toBe(0);
});

it('pairs two compatible players queued behind 25 incompatible tickets and stops locking afterward', async () => {
  const baseTime = Date.now() - 5_000;
  const docs = Array.from({ length: 25 }, (_, i) => ({
    userId: `head-${i}`,
    displayName: `Head${i}`,
    rating: 1200,
    subject: 'mathematics',
    topic: `head-topic-${i}`,
    questionCount: 10,
    status: 'waiting',
    queuedAt: new Date(baseTime + i),
    updatedAt: new Date(baseTime + i),
    expiresAt: new Date(baseTime + 600_000),
  }));
  docs.push(
    {
      userId: 'tail-a',
      displayName: 'TailA',
      rating: 1200,
      subject: 'english',
      topic: 'tenses',
      questionCount: 10,
      status: 'waiting',
      queuedAt: new Date(baseTime + 100),
      updatedAt: new Date(baseTime + 100),
      expiresAt: new Date(baseTime + 600_000),
    },
    {
      userId: 'tail-b',
      displayName: 'TailB',
      rating: 1220,
      subject: 'english',
      topic: 'tenses',
      questionCount: 10,
      status: 'waiting',
      queuedAt: new Date(baseTime + 101),
      updatedAt: new Date(baseTime + 101),
      expiresAt: new Date(baseTime + 600_000),
    },
  );
  await db.collection('battleMatchmakingQueue').insertMany(docs);
  for (const doc of docs) {
    await db.collection('battlePlayerState').insertOne({
      userId: doc.userId,
      kind: 'queue',
      resourceId: doc.userId,
      expiresAt: doc.expiresAt,
      updatedAt: new Date(),
    });
  }

  expect(await hasMatchmakingCandidates()).toBe(true);
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.setCalls).toBe(1);
  const room = await db.collection('battleRooms').findOne({});
  expect(room.players.map(p => p.userId).sort()).toEqual(['tail-a', 'tail-b']);

  // Remaining 25 incompatible tickets must NOT cause 1-second Redis lock spin.
  redisState.getClientCalls = 0;
  redisState.setCalls = 0;
  expect(await hasMatchmakingCandidates()).toBe(false);
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);
  expect(redisState.setCalls).toBe(0);
});

it('skips rollout-ineligible head-of-line tickets and pairs eligible players cleanly', async () => {
  const { isUserInBattleRollout } = await import('../../config/battleFeatures.js');
  vi.stubEnv('BATTLE_ROLLOUT_PERCENT', '50');
  let disabledUser = null;
  const enabledUsers = [];
  for (let i = 0; i < 200 && (!disabledUser || enabledUsers.length < 2); i++) {
    const candidate = `rollout-candidate-${i}`;
    if (!isUserInBattleRollout(candidate) && !disabledUser) disabledUser = candidate;
    else if (isUserInBattleRollout(candidate) && enabledUsers.length < 2) enabledUsers.push(candidate);
  }
  expect(disabledUser).toBeTruthy();
  expect(enabledUsers).toHaveLength(2);

  const baseTime = Date.now() - 5_000;
  const tickets = [disabledUser, ...enabledUsers].map((userId, idx) => ({
    userId,
    displayName: userId,
    rating: 1200,
    subject: 'mathematics',
    topic: 'algebra',
    questionCount: 10,
    status: 'waiting',
    queuedAt: new Date(baseTime + idx),
    updatedAt: new Date(baseTime + idx),
    expiresAt: new Date(baseTime + 600_000),
  }));
  await db.collection('battleMatchmakingQueue').insertMany(tickets);
  for (const doc of tickets) {
    await db.collection('battlePlayerState').insertOne({
      userId: doc.userId,
      kind: 'queue',
      resourceId: doc.userId,
      expiresAt: doc.expiresAt,
      updatedAt: new Date(),
    });
  }

  expect(await hasMatchmakingCandidates()).toBe(true);
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.setCalls).toBe(1);
  const room = await db.collection('battleRooms').findOne({});
  expect(room.players.map(p => p.userId).sort()).toEqual([...enabledUsers].sort());

  // Only the rollout-disabled ticket remains -> 0 Redis lock commands on next tick.
  redisState.getClientCalls = 0;
  redisState.setCalls = 0;
  expect(await hasMatchmakingCandidates()).toBe(false);
  await runBattleMatchmakingWorkerOnce();
  expect(redisState.getClientCalls).toBe(0);
  vi.stubEnv('BATTLE_ROLLOUT_PERCENT', '100');
});

