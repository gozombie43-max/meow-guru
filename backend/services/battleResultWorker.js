import { randomUUID } from 'node:crypto';
import { runtimeLog } from '../infrastructure/runtimeLog.js';
import * as mongoConfig from "../config/mongodb.js";
import { getRedisClient, redisKey, reportRedisFailure } from "../config/redis.js";
import { settleBattleResult } from "../battle/battleResultService.js";

const POLL_MS = Number(process.env.BATTLE_RESULT_WORKER_POLL_MS) || 2_000;
const BATCH_SIZE = 100;
const MAX_BATCHES_PER_TICK = 5;
const LEASE_TTL_MS = Math.max(6_000, POLL_MS * 3);
const RELEASE_LUA = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
let timer = null;
let running = false;

async function acquireResultWorkerLease() {
  const owner = randomUUID();
  const lockId = 'worker:battle-result';
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

export async function runBattleResultWorkerOnce() {
  if (running) return;
  running = true;
  let lease = null;
  try {
    lease = await acquireResultWorkerLease();
    if (!lease.acquired) return;
    const seenKeys = new Set();
    const collection = mongoConfig.getBattleRoomsCollection();
    const baseFilter = { status: "finished", resultRecordedAt: { $exists: false } };
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const cursor = collection.find(baseFilter);
      if (!cursor || typeof cursor.sort !== 'function') break;
      const rooms = await cursor
        .sort({ finishedAt: 1 })
        .limit(BATCH_SIZE)
        .toArray();
      const batchItems = (Array.isArray(rooms) ? rooms : []).filter((room) => {
        const idKey = String(room?._id ?? room?.code ?? '');
        if (!idKey || seenKeys.has(idKey)) return false;
        seenKeys.add(idKey);
        return true;
      });
      if (batchItems.length === 0) break;
      await Promise.allSettled(batchItems.map((room) => settleBattleResult(room)));
      if (rooms.length < BATCH_SIZE) break;
    }
  } finally {
    await lease?.release?.().catch(() => {});
    running = false;
  }
}

export async function startBattleResultWorker() {
  if (timer) return;
  await runBattleResultWorkerOnce();
  timer = setInterval(() => void runBattleResultWorkerOnce().catch((error) => runtimeLog.error("Battle result worker failed:", error)), POLL_MS);
  runtimeLog.info(`Battle result worker started (${POLL_MS}ms) ✅`);
}

export function stopBattleResultWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}

export async function waitForBattleResultWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return !running;
}
