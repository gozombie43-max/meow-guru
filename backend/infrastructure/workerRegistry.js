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


const workers = [
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
  for (const worker of workers) { if (stopping) return; await worker.start(); if (stopping) worker.stop(); }
}
export async function stopWorkers() {
  stopping = true;
  for (const worker of workers) worker.stop();
  const states = await Promise.all(workers.map(async worker => ({ name: worker.name, idle: await worker.idle(12000) })));
  if (states.some(state => !state.idle)) throw new Error('Workers failed to drain');
  return states;
}
