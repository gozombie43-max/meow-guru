import { randomUUID } from 'node:crypto';
import { getBattleSeasonsCollection, getBattleSeasonProfilesCollection, getBattleSeasonRewardsCollection, withMongoTransaction } from "../config/mongodb.js";

const POLL_MS = Number(process.env.BATTLE_SEASON_WORKER_POLL_MS) || 60_000;
const FINALIZATION_LEASE_MS = 120_000;
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
  const owner = randomUUID();
  const claim = await seasons.findOneAndUpdate({ key: season.key, ...finalizable(now) }, { $set: { status: "finalizing", finalizingAt: now, finalizationOwner: owner, finalizationLeaseUntil: new Date(now.getTime() + FINALIZATION_LEASE_MS), updatedAt: now } }, { returnDocument: "after" });
  if (!claim) return;
  // Rewards and completion commit together. Recovered/new owners conflict on
  // the season document, and an expired owner cannot commit partial rewards.
  await withMongoTransaction(async ({ session }) => {
    const owned = { _id: claim._id, status: 'finalizing', finalizationOwner: owner, finalizationLeaseUntil: { $gt: new Date() } };
    if (!await seasons.findOne(owned, { session })) throw new Error('Season finalization lease lost');
    const ranked = await profiles.find({ seasonKey: season.key, gamesPlayed: { $gte: 5 } }, { session, maxTimeMS: 10000 }).sort({ rating: -1, wins: -1, gamesPlayed: -1, userId: 1 }).toArray();
    const operations = ranked.map((profile, index) => ({ updateOne: { filter: { seasonKey: season.key, userId: profile.userId }, update: { $set: { seasonKey: season.key, userId: profile.userId, displayName: profile.displayName, finalRank: index + 1, finalRating: profile.rating, finalTier: profile.tier, gamesPlayed: profile.gamesPlayed, wins: profile.wins, losses: profile.losses, draws: profile.draws, badge: getSeasonReward({ rank: index + 1, tier: profile.tier }), awardedAt: now } }, upsert: true } }));
    for (let index = 0; index < operations.length; index += 500) await rewards.bulkWrite(operations.slice(index, index + 500), { ordered: false, session });
    const finishedAt = new Date();
    const completed = await seasons.updateOne({ ...owned, finalizationLeaseUntil: { $gt: finishedAt } }, { $set: { status: "completed", completedAt: finishedAt, playerCount: ranked.length, updatedAt: finishedAt }, $unset: { finalizationOwner: '', finalizationLeaseUntil: '' } }, { session });
    if (!completed.matchedCount) throw new Error('Season finalization lease lost');
  });
}

function finalizable(now) {
  return { $or: [
    { status: 'active' },
    { status: 'finalizing', finalizationLeaseUntil: { $lte: now } },
    // Upgrade recovery for workers that crashed before leases were introduced.
    { status: 'finalizing', finalizationLeaseUntil: { $exists: false }, $or: [{ finalizingAt: { $lte: new Date(now.getTime() - FINALIZATION_LEASE_MS) } }, { finalizingAt: { $exists: false } }] },
  ] };
}

export async function runBattleSeasonWorkerOnce() {
  if (running) return;
  running = true;
  try { const now = new Date(), seasons = getBattleSeasonsCollection(); const ended = await seasons.find({ ...finalizable(now), endsAt: { $lte: now } }, { maxTimeMS: 5000 }).toArray(); for (const season of ended) await finalizeSeason(season, now); await activateNextSeason(now); }
  finally { running = false; }
}
export async function startBattleSeasonWorker() { if (timer) return; await runBattleSeasonWorkerOnce(); timer = setInterval(() => void runBattleSeasonWorkerOnce().catch(console.error), POLL_MS); }
export function stopBattleSeasonWorker() { if (timer) { clearInterval(timer); timer = null; } }
export async function waitForBattleSeasonWorkerIdle(timeoutMs = 10_000) { const deadline = Date.now() + timeoutMs; while (running && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100)); return !running; }
