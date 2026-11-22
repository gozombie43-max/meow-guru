import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { randomUUID } from "node:crypto";
import * as mongoConfig from "../config/mongodb.js";
import { getRedisClient, redisKey, reportRedisFailure } from "../config/redis.js";
import { getBattleRealtimeServer } from "../battle/battleRealtime.js";
import { signBattleRematchToken } from "../auth/jwt.js";
import { sendPushToUser } from "./pushNotificationService.js";
import { settleBattleResult } from "../battle/battleResultService.js";
import { buildBattleReview } from "../battle/roomManager.js";

const POLL_MS = Number(process.env.BATTLE_PRESENCE_WORKER_POLL_MS) || 2_000;
const FINISHED_TTL_MS = 2 * 60 * 60 * 1000;
const BATCH_SIZE = 100;
const MAX_BATCHES_PER_TICK = 5;
const LEASE_TTL_MS = Math.max(6_000, POLL_MS * 3);
const RELEASE_LUA = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
let timer = null;
let running = false;

async function acquirePresenceWorkerLease() {
  const owner = randomUUID();
  const lockId = 'worker:battle-presence';
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

function scores(room) {
  return Object.fromEntries(room.players.map((player) => [player.userId, {
    name: player.name, score: player.score || 0, answered: Boolean(player.answered), connected: player.connected !== false,
  }]));
}

function buildPlayerStats(entry) {
  const answers = Array.isArray(entry?.answerLog) ? entry.answerLog : [];
  const answered = answers.filter((answer) => !answer.timedOut);
  const correct = answers.filter((answer) => answer.correct);
  const times = answered.map((answer) => answer.responseTimeMs).filter(Number.isFinite);
  return {
    correct: correct.length,
    total: answers.length,
    accuracy: answers.length ? Math.round((correct.length / answers.length) * 100) : 0,
    averageResponseMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
    timedOut: answers.filter((answer) => answer.timedOut).length,
  };
}

async function emitFinished(room, settlement = null) {
  const io = getBattleRealtimeServer();
  if (!io) return;
  const finalScores = scores(room);
  for (const player of room.players) {
    const opponent = room.players.find((candidate) => candidate.userId !== player.userId);
    const rematchToken = player.userId && opponent?.userId
      ? signBattleRematchToken({
          requesterUserId: player.userId,
          opponentUserId: opponent.userId,
          opponentName: opponent.name,
          subject: room.subject,
          topic: room.topic,
          questionCount: room.questionCount,
        })
      : null;
    const matchPlayer = settlement?.match?.players?.find((entry) => entry.userId === player.userId);
    const opponentMatchPlayer = settlement?.match?.players?.find((entry) => entry.userId === opponent?.userId);
    const review = buildBattleReview(room, player.userId);
    const targetRoom = player.userId ? `user:${player.userId}` : player.socketId;
    if (targetRoom) {
      io.to(targetRoom).emit("game:end", {
        scores: finalScores,
        finishReason: room.finishReason,
        winnerUserId: room.winnerUserId || null,
        loserUserId: room.loserUserId || null,
        rematchToken,
        opponentName: opponent?.name || "Opponent",
        matchStats: {
          me: buildPlayerStats(matchPlayer),
          opponent: buildPlayerStats(opponentMatchPlayer),
        },
        rating: matchPlayer && settlement?.match?.rated
          ? {
              lifetime: {
                before: matchPlayer.ratingBefore,
                after: matchPlayer.ratingAfter,
                delta: matchPlayer.ratingDelta,
              },
              season: matchPlayer.seasonRatingAfter !== null
                ? {
                    before: matchPlayer.seasonRatingBefore,
                    after: matchPlayer.seasonRatingAfter,
                    delta: matchPlayer.seasonRatingDelta,
                    tierBefore: matchPlayer.seasonTierBefore,
                    tierAfter: matchPlayer.seasonTierAfter,
                  }
                : null,
            }
          : null,
        review,
      });
    }
  }
}

async function notifyFinished(room) {
  await Promise.allSettled(room.players.map(async (player) => {
    if (!player.userId) return;
    const won = room.finishReason === "forfeit" && room.winnerUserId === player.userId;
    const result = room.finishReason === "abandoned" ? "abandoned" : won ? "win" : "loss";
    await sendPushToUser(player.userId, {
      title: room.finishReason === "abandoned" ? "Battle Ended" : won ? "You Win by Forfeit 🏆" : "Battle Lost",
      body: room.finishReason === "abandoned" ? "Both players disconnected before the battle could continue." : won ? "Your opponent did not reconnect in time." : "The reconnect grace period expired.",
      route: "/battle", category: "battleResults",
      data: { type: "battle_result", result, finishReason: room.finishReason, roomCode: room.code },
      centerKey: `battle-result:${room.code}:${player.userId}`,
    });
  }));
}

async function resolveRoom(candidate, now) {
  const rooms = mongoConfig.getBattleRoomsCollection();
  const room = await rooms.findOne({ _id: candidate._id, status: "active" });
  if (!room || room.players.length !== 2) return;
  const overdue = room.players.filter((player) => player.connected === false && player.reconnectDeadline && new Date(player.reconnectDeadline) <= now);
  if (!overdue.length) return;
  const connected = room.players.filter((player) => player.connected !== false);
  const finishReason = overdue.length === 1 && connected.length === 1 ? "forfeit" : connected.length === 0 && overdue.length === 2 ? "abandoned" : null;
  if (!finishReason) return;
  const nowDate = new Date(now);
  const update = {
    status: "finished", realtimeVersion: randomUUID(), finishReason, finishedAt: nowDate, updatedAt: nowDate,
    expiresAt: new Date(now.getTime() + FINISHED_TTL_MS),
    ...(finishReason === "forfeit" ? { winnerUserId: connected[0].userId, loserUserId: overdue[0].userId } : {}),
  };
  const finished = await rooms.findOneAndUpdate(
    { _id: room._id, status: "active", updatedAt: room.updatedAt },
    finishReason === "abandoned" ? { $set: update, $unset: { winnerUserId: "", loserUserId: "" } } : { $set: update },
    { returnDocument: "after" }
  );
  if (!finished) return;
  const settlement = await settleBattleResult(finished).catch((error) => {
    runtimeLog.error("Battle settlement failed:", error);
    return null;
  });
  await emitFinished(finished, settlement);
  await notifyFinished(finished);
}

export async function runBattlePresenceWorkerOnce() {
  if (running) return;
  running = true;
  let lease = null;
  try {
    lease = await acquirePresenceWorkerLease();
    if (!lease.acquired) return;
    const now = new Date();
    const seenKeys = new Set();
    const collection = mongoConfig.getBattleRoomsCollection();
    const baseFilter = { status: "active", "players.reconnectDeadline": { $lte: now } };
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const cursor = collection.find(baseFilter);
      if (!cursor || typeof cursor.sort !== 'function') break;
      const candidates = await cursor.sort({ updatedAt: 1 }).limit(BATCH_SIZE).toArray();
      const batchItems = (Array.isArray(candidates) ? candidates : []).filter((room) => {
        const idKey = String(room?._id ?? room?.code ?? '');
        if (!idKey || seenKeys.has(idKey)) return false;
        seenKeys.add(idKey);
        return true;
      });
      if (batchItems.length === 0) break;
      await Promise.allSettled(batchItems.map((room) => resolveRoom(room, now)));
      if (candidates.length < BATCH_SIZE) break;
    }
  } finally {
    await lease?.release?.().catch(() => {});
    running = false;
  }
}

export async function startBattlePresenceWorker() {
  if (timer) return;
  await runBattlePresenceWorkerOnce();
  timer = setInterval(() => { void runBattlePresenceWorkerOnce().catch((error) => runtimeLog.error("Battle presence worker failed:", error)); }, POLL_MS);
  runtimeLog.info(`Battle presence worker started (${POLL_MS}ms) ✅`);
}
export function stopBattlePresenceWorker() { if (timer) { clearInterval(timer); timer = null; } }
export async function waitForBattlePresenceWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return !running;
}
