import { getBattleRoomsCollection } from "../config/mongodb.js";
import { getBattleRealtimeServer } from "../battle/battleRealtime.js";
import {
  advanceQuestion,
  getScores,
  resolveExpiredQuestion,
} from "../battle/roomManager.js";
import { finishBattle } from "../battle/battleCompletion.js";

const POLL_MS = Number(process.env.BATTLE_QUESTION_DEADLINE_WORKER_POLL_MS) || 1_000;
let timer = null;
let running = false;

async function resolveCandidate(candidate, now) {
  const resolution = await resolveExpiredQuestion(candidate.code, candidate.currentIndex, now);
  if (!resolution.resolved || !resolution.room) return;

  const io = getBattleRealtimeServer();
  if (resolution.room.questionResolvedAt && new Date(resolution.room.questionResolvedAt).getTime() === now.getTime()) {
    const question = resolution.room.questions?.[resolution.room.currentIndex];
    if (io && question) {
      io.to(resolution.room.code).emit("game:scores", { scores: await getScores(resolution.room.code) });
      io.to(resolution.room.code).emit("game:reveal", {
        questionIndex: resolution.room.currentIndex,
        correctIndex: Number(question.correctAnswer),
        selections: Object.fromEntries(resolution.room.players.map((player) => [player.userId, player.selectedIndex ?? null])),
      });
    }
  }

  if (!resolution.readyToAdvance) return;
  const transition = await advanceQuestion(resolution.room.code, resolution.room.currentIndex);
  if (!transition.advanced) return;
  if (transition.finished) {
    await finishBattle(io, transition.room);
    return;
  }

  const question = transition.room.questions[transition.room.currentIndex];
  if (io) io.to(transition.room.code).emit("game:question", {
    question: question.question,
    options: question.options,
    questionIndex: transition.room.currentIndex,
    total: transition.room.questions.length,
    deadline: transition.room.questionDeadline,
  });
}

export async function runBattleQuestionDeadlineWorkerOnce() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const candidates = await getBattleRoomsCollection()
      .find({ status: "active", questionDeadline: { $lte: now } })
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
  timer = setInterval(() => void runBattleQuestionDeadlineWorkerOnce().catch((error) => console.error("Battle question deadline worker failed:", error)), POLL_MS);
  console.log(`Battle question deadline worker started (${POLL_MS}ms) ✅`);
}

export function stopBattleQuestionDeadlineWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}

export async function waitForBattleQuestionDeadlineWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return !running;
}
