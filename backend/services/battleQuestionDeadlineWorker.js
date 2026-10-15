import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { getBattleRoomsCollection } from "../config/mongodb.js";
import { getBattleRealtimeServer } from "../battle/battleRealtime.js";
import {
  advanceQuestion,
  resolveExpiredQuestion,
  getRoom, buildBattleReveal, claimBattleReveal, buildPublicQuestion,
} from "../battle/roomManager.js";
import { finishBattle } from "../battle/battleCompletion.js";

const POLL_MS = Number(process.env.BATTLE_QUESTION_DEADLINE_WORKER_POLL_MS) || 1_000;
let timer = null;
let running = false;

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
  try {
    const now = new Date();
    const candidates = await getBattleRoomsCollection()
      .find({ status: "active", $or: [{ questionDeadline: { $lte: now } }, { questionAdvanceAt: { $lte: now } },
        { questionAdvanceAt: { $exists: false }, players: { $not: { $elemMatch: { answered: { $ne: true } } } } }] })
      .sort({ questionDeadline: 1 })
      .limit(50)
      .toArray();
    await Promise.allSettled(candidates.map((candidate) => resolveCandidate(candidate, now)));
  } finally {
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
