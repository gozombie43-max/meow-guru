import { getBattleRoomsCollection } from "../config/mongodb.js";
import { settleBattleResult } from "../battle/battleResultService.js";

const POLL_MS = Number(process.env.BATTLE_RESULT_WORKER_POLL_MS) || 2_000;
let timer = null;
let running = false;

export async function runBattleResultWorkerOnce() {
  if (running) return;
  running = true;
  try {
    const rooms = await getBattleRoomsCollection()
      .find({ status: "finished", resultRecordedAt: { $exists: false } })
      .sort({ finishedAt: 1 })
      .limit(50)
      .toArray();
    await Promise.allSettled(rooms.map((room) => settleBattleResult(room)));
  } finally {
    running = false;
  }
}

export async function startBattleResultWorker() {
  if (timer) return;
  await runBattleResultWorkerOnce();
  timer = setInterval(() => void runBattleResultWorkerOnce().catch((error) => console.error("Battle result worker failed:", error)), POLL_MS);
  console.log(`Battle result worker started (${POLL_MS}ms) ✅`);
}

export function stopBattleResultWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}

export async function waitForBattleResultWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  return !running;
}
