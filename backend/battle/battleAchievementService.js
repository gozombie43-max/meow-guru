import { getBattleAchievementsCollection } from "../config/mongodb.js";

export const ACHIEVEMENTS = {
  first_win: { title: "First Victory", description: "Win your first battle.", icon: "trophy" },
  streak_3: { title: "On Fire", description: "Win 3 battles in a row.", icon: "flame" },
  streak_5: { title: "Unstoppable", description: "Win 5 battles in a row.", icon: "zap" },
  veteran_25: { title: "Battle Veteran", description: "Complete 25 battles.", icon: "shield" },
  veteran_100: { title: "Centurion", description: "Complete 100 battles.", icon: "crown" },
  perfect_battle: { title: "Perfect Battle", description: "Answer every question correctly in a completed battle.", icon: "sparkles" },
  diamond: { title: "Diamond Rank", description: "Reach Diamond in a competitive season.", icon: "gem" },
};

async function unlock(userId, achievementCode, roomCode) {
  const definition = ACHIEVEMENTS[achievementCode]; if (!definition) return false;
  try { await getBattleAchievementsCollection().insertOne({ userId: String(userId), achievementCode, ...definition, firstRoomCode: roomCode || null, unlockedAt: new Date() }); return true; }
  catch (error) { if (error?.code === 11000) return false; throw error; }
}
export async function evaluateBattleAchievements({ match, player, lifetimeProfile, seasonProfile }) {
  const jobs = [], userId = player.userId, roomCode = match.roomCode;
  if (lifetimeProfile?.wins >= 1) jobs.push(unlock(userId, "first_win", roomCode));
  if (lifetimeProfile?.currentWinStreak >= 3) jobs.push(unlock(userId, "streak_3", roomCode));
  if (lifetimeProfile?.currentWinStreak >= 5) jobs.push(unlock(userId, "streak_5", roomCode));
  if (lifetimeProfile?.gamesPlayed >= 25) jobs.push(unlock(userId, "veteran_25", roomCode));
  if (lifetimeProfile?.gamesPlayed >= 100) jobs.push(unlock(userId, "veteran_100", roomCode));
  if (seasonProfile?.tier === "Diamond") jobs.push(unlock(userId, "diamond", roomCode));
  const answers = Array.isArray(player.answerLog) ? player.answerLog : [];
  if (match.finishReason === "completed" && answers.length && answers.every((entry) => entry.correct === true && entry.timedOut !== true)) jobs.push(unlock(userId, "perfect_battle", roomCode));
  await Promise.allSettled(jobs);
}
