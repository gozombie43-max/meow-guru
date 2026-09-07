import { runMatchmakingPass, emitMatchFound } from "../battle/matchmakingService.js";
const POLL_MS = Number(process.env.BATTLE_MATCHMAKING_POLL_MS) || 1_000;
let timer = null; let running = false;
export async function runBattleMatchmakingWorkerOnce() { if (running) return; running = true; try { for (const match of await runMatchmakingPass()) emitMatchFound(match); } finally { running = false; } }
export async function startBattleMatchmakingWorker() { if (timer) return; await runBattleMatchmakingWorkerOnce(); timer = setInterval(() => void runBattleMatchmakingWorkerOnce().catch((error) => console.error("Battle matchmaking worker:", error)), POLL_MS); console.log(`Battle matchmaking worker started (${POLL_MS}ms) ✅`); }
export function stopBattleMatchmakingWorker() { if (timer) { clearInterval(timer); timer = null; } }
export async function waitForBattleMatchmakingWorkerIdle(timeoutMs = 10_000) { const deadline = Date.now() + timeoutMs; while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100)); return !running; }
