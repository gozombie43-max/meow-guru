import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { runMatchmakingPass, emitMatchFound } from '../battle/matchmakingService.js';
import { acquireMatchmakingPass } from '../battle/matchmakingLock.js';
const POLL_MS = Math.max(250, Number(process.env.BATTLE_MATCHMAKING_POLL_MS) || 1_000);
const DEGRADED_POLL_MS = Math.max(5_000, POLL_MS * 5);
let timer = null, running = false, nextAttemptAt = 0;
export async function runBattleMatchmakingWorkerOnce() {
  if (running || Date.now() < nextAttemptAt) return;
  running = true;
  let lease;
  try {
    lease = await acquireMatchmakingPass();
    if (lease.degraded) nextAttemptAt = Date.now() + DEGRADED_POLL_MS + Math.floor(Math.random() * 500);
    if (!lease.acquired) return;
    for (const match of await runMatchmakingPass({ limit: lease.degraded ? 4 : 25, canContinue: lease.renew })) emitMatchFound(match);
  } catch (error) { nextAttemptAt = Date.now() + DEGRADED_POLL_MS; throw error; }
  finally {
    try { await lease?.release(); }
    catch (error) { nextAttemptAt = Date.now() + DEGRADED_POLL_MS; runtimeLog.error('Battle matchmaking lease release:', error); }
    finally { running = false; }
  }
}
export async function startBattleMatchmakingWorker() {
  if (timer) return;
  await runBattleMatchmakingWorkerOnce().catch(error => runtimeLog.error('Battle matchmaking worker:', error));
  timer = setInterval(() => void runBattleMatchmakingWorkerOnce().catch(error => runtimeLog.error('Battle matchmaking worker:', error)), POLL_MS);
  runtimeLog.info(`Battle matchmaking worker started (${POLL_MS}ms)`);
}
export function stopBattleMatchmakingWorker() { if (timer) clearInterval(timer); timer = null; nextAttemptAt = 0; }
export async function waitForBattleMatchmakingWorkerIdle(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (running && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  return !running;
}
