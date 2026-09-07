import { getBattleSeasonsCollection, getBattleSeasonProfilesCollection, getBattleSeasonRewardsCollection } from "../config/mongodb.js";

const POLL_MS = Number(process.env.BATTLE_SEASON_WORKER_POLL_MS) || 60_000;
let timer = null;
let running = false;

function getSeasonReward({ rank, tier }) {
  if (rank === 1) return { code: "season-champion", label: "Season Champion" };
  if (rank <= 10) return { code: "season-top-10", label: "Top 10" };
  return { code: `season-${String(tier || "unranked").toLowerCase()}`, label: `${tier || "Unranked"} Season Badge` };
}

async function activateNextSeason(now) {
  const seasons = getBattleSeasonsCollection();
  const active = await seasons.findOne({ status: "active", startsAt: { $lte: now }, endsAt: { $gt: now } });
  if (active) return;
  await seasons.findOneAndUpdate({ status: "scheduled", startsAt: { $lte: now }, endsAt: { $gt: now } }, { $set: { status: "active", activatedAt: now, updatedAt: now } }, { sort: { startsAt: 1 }, returnDocument: "after" });
}

async function finalizeSeason(season, now) {
  const seasons = getBattleSeasonsCollection(), profiles = getBattleSeasonProfilesCollection(), rewards = getBattleSeasonRewardsCollection();
  const claim = await seasons.findOneAndUpdate({ key: season.key, status: "active" }, { $set: { status: "finalizing", finalizingAt: now, updatedAt: now } }, { returnDocument: "after" });
  if (!claim) return;
  const ranked = await profiles.find({ seasonKey: season.key, gamesPlayed: { $gte: 5 } }).sort({ rating: -1, wins: -1, gamesPlayed: -1 }).toArray();
  if (ranked.length) await rewards.bulkWrite(ranked.map((profile, index) => ({ updateOne: { filter: { seasonKey: season.key, userId: profile.userId }, update: { $set: { seasonKey: season.key, userId: profile.userId, displayName: profile.displayName, finalRank: index + 1, finalRating: profile.rating, finalTier: profile.tier, gamesPlayed: profile.gamesPlayed, wins: profile.wins, losses: profile.losses, draws: profile.draws, badge: getSeasonReward({ rank: index + 1, tier: profile.tier }), awardedAt: now } }, upsert: true } })), { ordered: false });
  await seasons.updateOne({ key: season.key, status: "finalizing" }, { $set: { status: "completed", completedAt: new Date(), playerCount: ranked.length, updatedAt: new Date() } });
}

export async function runBattleSeasonWorkerOnce() {
  if (running) return;
  running = true;
  try { const now = new Date(), seasons = getBattleSeasonsCollection(); const ended = await seasons.find({ status: "active", endsAt: { $lte: now } }).toArray(); for (const season of ended) await finalizeSeason(season, now); await activateNextSeason(now); }
  finally { running = false; }
}
export async function startBattleSeasonWorker() { if (timer) return; await runBattleSeasonWorkerOnce(); timer = setInterval(() => void runBattleSeasonWorkerOnce().catch(console.error), POLL_MS); }
export function stopBattleSeasonWorker() { if (timer) { clearInterval(timer); timer = null; } }
export async function waitForBattleSeasonWorkerIdle(timeoutMs = 10_000) { const deadline = Date.now() + timeoutMs; while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100)); return !running; }
