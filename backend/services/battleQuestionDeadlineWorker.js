import { randomUUID } from 'node:crypto';
import { runtimeLog } from '../infrastructure/runtimeLog.js';
import * as mongoConfig from "../config/mongodb.js";
import { getRedisClient, redisKey, reportRedisFailure } from "../config/redis.js";
import { getBattleRealtimeServer } from "../battle/battleRealtime.js";
import {
  advanceQuestion,
  resolveExpiredQuestion,
  getRoom, buildBattleReveal, claimBattleReveal, buildPublicQuestion,
} from "../battle/roomManager.js";
import { finishBattle } from "../battle/battleCompletion.js";

const POLL_MS = Number(process.env.BATTLE_QUESTION_DEADLINE_WORKER_POLL_MS) || 1_000;
const BATCH_SIZE = 100;
const MAX_BATCHES_PER_TICK = 5;
const LEASE_TTL_MS = Math.max(5_000, POLL_MS * 4);
const RELEASE_LUA = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
let timer = null;
let running = false;

async function acquireDeadlineWorkerLease() {
  const owner = randomUUID();
  const lockId = 'worker:battle-question-deadline';
  const key = redisKey(`battle:${lockId}`);
  let redis = null;
  let ownsRedis = false;
  try {
    redis = await getRedisClient();
    if (redis) {
      ownsRedis = Boolean(await redis.set(key, owner, { NX: true, PX: LEASE_TTL_MS }));
      if (!ownsRedis) return { acquired: false, release: async () => {} };
    }
  } catch {
    reportRedisFailure();
  }

  const releaseRedis = async () => {
    if (ownsRedis && redis) {
      try {
        await redis.eval(RELEASE_LUA, { keys: [key], arguments: [owner] });
      } catch {
        reportRedisFailure();
      }
    }
  };

  let locks = null;
  let ownsMongo = false;
  try {
    const db = typeof mongoConfig.getMongoDB === 'function' ? mongoConfig.getMongoDB() : null;
    locks = db && typeof db.collection === 'function' ? db.collection('battleMatchmakingLocks') : null;
  } catch {
    locks = null;
  }

  if (locks && typeof locks.findOneAndUpdate === 'function') {
    try {
      const now = new Date();
      const doc = await locks.findOneAndUpdate(
        { _id: lockId, expiresAt: { $lte: now } },
        { $set: { owner, expiresAt: new Date(now.getTime() + LEASE_TTL_MS) } },
        { upsert: true, returnDocument: 'after', timeoutMS: 2000 },
      );
      ownsMongo = doc?.owner === owner;
      if (!ownsMongo) {
        await releaseRedis();
        return { acquired: false, release: async () => {} };
      }
    } catch (error) {
      if (error?.code === 11000) {
        await releaseRedis();
        return { acquired: false, release: async () => {} };
      }
      if (!/not been initialized/i.test(error?.message || '')) {
        await releaseRedis();
        throw error;
      }
    }
  }

  return {
    acquired: true,
    release: async () => {
      try {
        if (ownsMongo && locks && typeof locks.deleteOne === 'function') {
          await locks.deleteOne({ _id: lockId, owner }, { timeoutMS: 2000 }).catch(() => {});
        }
      } finally {
        await releaseRedis();
      }
    },
  };
}

async function resolveCandidate(candidate, now) {
  let resolution;
  if (candidate.questionAdvanceAt) {
    const room = await getRoom(candidate.code);
    if (!room || room.status !== 'active' || room.currentIndex !== candidate.currentIndex) return;
    resolution = { resolved: true, room, readyToAdvance: new Date(room.questionAdvanceAt) <= now };
  } else if (candidate.players?.length === 2 && candidate.players.every(player => player.answered)) {
    const room = await claimBattleReveal(candidate.code, candidate.currentIndex, now);
    if (!room) return;
    resolution = { resolved: true, room, readyToAdvance: false };
  } else {
    resolution = await resolveExpiredQuestion(candidate.code, candidate.currentIndex, now);
  }
  if (!resolution.resolved || !resolution.room) return;

  const io = getBattleRealtimeServer();
  if (resolution.room.questionResolvedAt && new Date(resolution.room.questionResolvedAt).getTime() === now.getTime()) {
    const reveal = buildBattleReveal(resolution.room);
    if (io && reveal) io.to(resolution.room.code).emit('game:reveal', reveal);
  }

  if (!resolution.readyToAdvance) return;
  const transition = await advanceQuestion(resolution.room.code, resolution.room.currentIndex);
  if (!transition.advanced) return;
  if (transition.finished) {
    await finishBattle(io, transition.room);
    return;
  }

  if (io) io.to(transition.room.code).emit('game:question', buildPublicQuestion(transition.room));
}

export async function runBattleQuestionDeadlineWorkerOnce() {
  if (running) return;
  running = true;
  let lease = null;
  try {
    lease = await acquireDeadlineWorkerLease();
    if (!lease.acquired) return;
    const now = new Date();
    const seenKeys = new Set();
    const baseFilter = {
      status: "active",
      $or: [
        { questionDeadline: { $lte: now } },
        { questionAdvanceAt: { $lte: now } },
        { questionAdvanceAt: { $exists: false }, players: { $not: { $elemMatch: { answered: { $ne: true } } } } },
      ],
    };
    const collection = mongoConfig.getBattleRoomsCollection();
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const cursor = collection.find(baseFilter);
      if (!cursor || typeof cursor.sort !== 'function') break;
      const candidates = await cursor
        .sort({ questionDeadline: 1 })
        .limit(BATCH_SIZE)
        .toArray();
      const batchItems = (Array.isArray(candidates) ? candidates : []).filter((candidate) => {
        const idKey = String(candidate?._id ?? candidate?.code ?? '');
        if (!idKey || seenKeys.has(idKey)) return false;
        seenKeys.add(idKey);
        return true;
      });
      if (batchItems.length === 0) break;
      await Promise.allSettled(batchItems.map((candidate) => resolveCandidate(candidate, now)));
      if (candidates.length < BATCH_SIZE) break;
    }
  } finally {
    await lease?.release?.().catch(() => {});
    running = false;
  }
}

export async function startBattleQuestionDeadlineWorker() {
  if (timer) return;
  await runBattleQuestionDeadlineWorkerOnce();
  timer = setInterval(() => void runBattleQuestionDeadlineWorkerOnce().catch((error) => runtimeLog.error("Battle question deadline worker failed:", error)), POLL_MS);
  runtimeLog.info(`Battle question deadline worker started (${POLL_MS}ms) ✅`);
}

export function stopBattleQuestionDeadlineWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}

export async function waitForBattleQuestionDeadlineWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return !running;
}
