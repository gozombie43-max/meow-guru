import {
  startScheduledNotificationWorker,
  stopScheduledNotificationWorker,
  waitForScheduledNotificationWorkerIdle,
} from '../services/scheduledNotificationWorker.js';

import {
  startDailyPracticeReminderWorker,
  stopDailyPracticeReminderWorker,
  waitForDailyPracticeReminderWorkerIdle,
} from '../services/dailyPracticeReminderWorker.js';

import {
  startStreakProtectionWorker,
  stopStreakProtectionWorker,
  waitForStreakProtectionWorkerIdle,
} from '../services/streakProtectionWorker.js';

import {
  startBattlePresenceWorker,
  stopBattlePresenceWorker,
  waitForBattlePresenceWorkerIdle,
} from '../services/battlePresenceWorker.js';
import {
  startBattleMatchmakingWorker,
  stopBattleMatchmakingWorker,
  waitForBattleMatchmakingWorkerIdle,
} from '../services/battleMatchmakingWorker.js';
import {
  startBattleSeasonWorker,
  stopBattleSeasonWorker,
  waitForBattleSeasonWorkerIdle,
} from '../services/battleSeasonWorker.js';
import {
  startBattleQuestionDeadlineWorker,
  stopBattleQuestionDeadlineWorker,
  waitForBattleQuestionDeadlineWorkerIdle,
} from '../services/battleQuestionDeadlineWorker.js';
import {
  startBattleResultWorker,
  stopBattleResultWorker,
  waitForBattleResultWorkerIdle,
} from '../services/battleResultWorker.js';


import { startConceptGroupingWorker, stopConceptGroupingWorker, waitForConceptGroupingWorkerIdle } from '../services/conceptGroupingWorker.js';
import { startMaintenanceQueue } from './maintenanceQueue.js';
import { runScheduledNotificationWorkerOnce } from '../services/scheduledNotificationWorker.js';
import { runDailyPracticeReminderWorkerOnce } from '../services/dailyPracticeReminderWorker.js';
import { runStreakProtectionWorkerOnce } from '../services/streakProtectionWorker.js';
import { runBattleSeasonWorkerOnce } from '../services/battleSeasonWorker.js';
import { processConceptGroupingJob } from '../services/conceptGroupingWorker.js';

let queuedWorkers;
const scheduledNames = new Set(['ConceptGrouping', 'ScheduledNotification', 'DailyPracticeReminder', 'StreakProtection', 'BattleSeason']);
const pollInterval = (name, fallback) => { const value = Number(process.env[name]); return Number.isFinite(value) && value > 0 ? value : fallback; };

const workers = [
  { name: "ConceptGrouping", start: startConceptGroupingWorker, stop: stopConceptGroupingWorker, idle: waitForConceptGroupingWorkerIdle },
  { name: "ScheduledNotification", start: startScheduledNotificationWorker, stop: stopScheduledNotificationWorker, idle: waitForScheduledNotificationWorkerIdle },
  { name: "DailyPracticeReminder", start: startDailyPracticeReminderWorker, stop: stopDailyPracticeReminderWorker, idle: waitForDailyPracticeReminderWorkerIdle },
  { name: "StreakProtection", start: startStreakProtectionWorker, stop: stopStreakProtectionWorker, idle: waitForStreakProtectionWorkerIdle },
  { name: "BattlePresence", start: startBattlePresenceWorker, stop: stopBattlePresenceWorker, idle: waitForBattlePresenceWorkerIdle },
  { name: "BattleMatchmaking", start: startBattleMatchmakingWorker, stop: stopBattleMatchmakingWorker, idle: waitForBattleMatchmakingWorkerIdle },
  { name: "BattleSeason", start: startBattleSeasonWorker, stop: stopBattleSeasonWorker, idle: waitForBattleSeasonWorkerIdle },
  { name: "BattleQuestionDeadline", start: startBattleQuestionDeadlineWorker, stop: stopBattleQuestionDeadlineWorker, idle: waitForBattleQuestionDeadlineWorkerIdle },
  { name: "BattleResult", start: startBattleResultWorker, stop: stopBattleResultWorker, idle: waitForBattleResultWorkerIdle },
];
let stopping = false;
export async function startWorkers() {
  stopping = false;
  queuedWorkers = await startMaintenanceQueue([
    { name: 'ConceptGrouping', intervalMs: 5000, run: processConceptGroupingJob },
    { name: 'ScheduledNotification', intervalMs: pollInterval('NOTIFICATION_WORKER_POLL_MS', 30000), run: runScheduledNotificationWorkerOnce },
    { name: 'DailyPracticeReminder', intervalMs: pollInterval('DAILY_REMINDER_WORKER_POLL_MS', 60000), run: runDailyPracticeReminderWorkerOnce },
    { name: 'StreakProtection', intervalMs: pollInterval('STREAK_PROTECTION_WORKER_POLL_MS', 60000), run: runStreakProtectionWorkerOnce },
    { name: 'BattleSeason', intervalMs: pollInterval('BATTLE_SEASON_WORKER_POLL_MS', 60000), run: runBattleSeasonWorkerOnce },
  ]);
  for (const worker of workers) { if (stopping) return; if (queuedWorkers && scheduledNames.has(worker.name)) continue; await worker.start(); if (stopping) worker.stop(); }
}
export async function stopWorkers() {
  stopping = true;
  await queuedWorkers?.close();
  queuedWorkers = null;
  for (const worker of workers) worker.stop();
  const states = await Promise.all(workers.map(async worker => ({ name: worker.name, idle: await worker.idle(12000) })));
  if (states.some(state => !state.idle)) throw new Error('Workers failed to drain');
  return states;
}
