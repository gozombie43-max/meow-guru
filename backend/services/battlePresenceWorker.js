import { randomUUID } from "node:crypto";
import { getBattleRoomsCollection } from "../config/mongodb.js";
import { getBattleRealtimeServer } from "../battle/battleRealtime.js";
import { signBattleRematchToken } from "../auth/jwt.js";
import { sendPushToUser } from "./pushNotificationService.js";
import { settleBattleResult } from "../battle/battleResultService.js";
import { buildBattleReview } from "../battle/roomManager.js";

const POLL_MS = Number(process.env.BATTLE_PRESENCE_WORKER_POLL_MS) || 2_000;
const FINISHED_TTL_MS = 2 * 60 * 60 * 1000;
let timer = null;
let running = false;

function scores(room) {
  return Object.fromEntries(room.players.map((player) => [player.userId, {
    name: player.name, score: player.score || 0, answered: Boolean(player.answered), connected: player.connected !== false,
  }]));
}

async function emitFinished(room) {
  const io = getBattleRealtimeServer();
  if (!io) return;
  const finalScores = scores(room);
  for (const player of room.players) {
    const opponent = room.players.find((candidate) => candidate.userId !== player.userId);
    const rematchToken = opponent ? signBattleRematchToken({ requesterUserId: player.userId, opponentUserId: opponent.userId, opponentName: opponent.name, subject: room.subject, topic: room.topic, questionCount: room.questionCount }) : null;
    const review = buildBattleReview(room, player.userId);
    if (player.socketId) io.to(player.socketId).emit("game:end", {
      scores: finalScores, finishReason: room.finishReason, winnerUserId: room.winnerUserId || null,
      loserUserId: room.loserUserId || null, rematchToken, opponentName: opponent?.name || "Opponent",
      review,
    });
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
  const rooms = getBattleRoomsCollection();
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
  await settleBattleResult(finished).catch((error) => console.error("Battle settlement failed:", error));
  await emitFinished(finished);
  await notifyFinished(finished);
}

export async function runBattlePresenceWorkerOnce() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const candidates = await getBattleRoomsCollection().find({ status: "active", "players.reconnectDeadline": { $lte: now } }).sort({ updatedAt: 1 }).limit(20).toArray();
    await Promise.allSettled(candidates.map((room) => resolveRoom(room, now)));
  } finally { running = false; }
}

export async function startBattlePresenceWorker() {
  if (timer) return;
  await runBattlePresenceWorkerOnce();
  timer = setInterval(() => { void runBattlePresenceWorkerOnce().catch((error) => console.error("Battle presence worker failed:", error)); }, POLL_MS);
  console.log(`Battle presence worker started (${POLL_MS}ms) ✅`);
}
export function stopBattlePresenceWorker() { if (timer) { clearInterval(timer); timer = null; } }
export async function waitForBattlePresenceWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return !running;
}
