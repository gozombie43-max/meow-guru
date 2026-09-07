import { getBattleRoomsCollection } from "../config/mongodb.js";
import { settleBattleResult } from "../battle/battleResultService.js";

const POLL_MS = Number(process.env.BATTLE_RESULT_WORKER_POLL_MS) || 5_000;
const BATCH_SIZE = 25;

let timer = null;
let running = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processUnsettledBattleRoom(room) {
  if (!room || room.status !== "finished" || room.resultRecordedAt) {
    return null;
  }

  return settleBattleResult(room);
}

export async function runBattleResultWorkerOnce() {
  if (running) return false;
  running = true;

  try {
    const rooms = await getBattleRoomsCollection()
      .find({
        status: "finished",
        resultRecordedAt: { $exists: false },
      })
      .sort({ finishedAt: 1 })
      .limit(BATCH_SIZE)
      .toArray();

    const results = await Promise.allSettled(
      rooms.map((room) => processUnsettledBattleRoom(room))
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Battle result recovery failed:", result.reason);
      }
    }

    return true;
  } finally {
    running = false;
  }
}

export async function startBattleResultWorker() {
  if (timer) return;

  await runBattleResultWorkerOnce();
  timer = setInterval(() => {
    void runBattleResultWorkerOnce().catch((error) => {
      console.error("Battle result worker failed:", error);
    });
  }, POLL_MS);

  console.log(`Battle result worker started (${POLL_MS}ms) ✅`);
}

export function stopBattleResultWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export async function waitForBattleResultWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) {
    await sleep(100);
  }
  return !running;
}
