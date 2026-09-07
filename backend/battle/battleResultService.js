import { getBattleMatchesCollection, getBattleProfilesCollection, getBattleRoomsCollection, getBattleSeasonProfilesCollection, withMongoTransaction } from "../config/mongodb.js";
import { calculateElo, DEFAULT_BATTLE_RATING } from "./battleRatingService.js";
import { getBattleTier } from "./battleTierService.js";
import { analyzeSettledBattle } from "./battleIntegrityService.js";
import { evaluateBattleAchievements } from "./battleAchievementService.js";
import { processBattleMissionProgress } from "./battleProgressionService.js";

function getOutcome(room, a, b) {
  if (room.finishReason === "abandoned") return { a: "abandoned", b: "abandoned", rated: false };
  if (room.finishReason === "forfeit") return room.winnerUserId === a.userId ? { a: "win", b: "loss", rated: true } : { a: "loss", b: "win", rated: true };
  if ((a.score || 0) === (b.score || 0)) return { a: "draw", b: "draw", rated: true };
  return (a.score || 0) > (b.score || 0) ? { a: "win", b: "loss", rated: true } : { a: "loss", b: "win", rated: true };
}
function defaultProfile(player) { return { userId: player.userId, displayName: player.name || "Player", rating: DEFAULT_BATTLE_RATING, peakRating: DEFAULT_BATTLE_RATING, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, currentWinStreak: 0, bestWinStreak: 0 }; }
function defaultSeasonProfile(seasonKey, player) { return { ...defaultProfile(player), seasonKey, tier: "Unranked" }; }
function nextStats(profile, result, rating) {
  if (result === "abandoned") return { rating };
  const won = result === "win"; const streak = won ? (profile.currentWinStreak || 0) + 1 : 0;
  return { rating, peakRating: Math.max(profile.peakRating || DEFAULT_BATTLE_RATING, rating), gamesPlayed: (profile.gamesPlayed || 0) + 1, wins: (profile.wins || 0) + (won ? 1 : 0), losses: (profile.losses || 0) + (result === "loss" ? 1 : 0), draws: (profile.draws || 0) + (result === "draw" ? 1 : 0), currentWinStreak: streak, bestWinStreak: Math.max(profile.bestWinStreak || 0, streak) };
}
function calculatePair(a, b, resultA, rated) { return rated ? calculateElo({ ratingA: a.rating ?? DEFAULT_BATTLE_RATING, ratingB: b.rating ?? DEFAULT_BATTLE_RATING, resultA: resultA === "win" ? 1 : resultA === "draw" ? .5 : 0 }) : { newRatingA: a.rating, newRatingB: b.rating, deltaA: 0, deltaB: 0 }; }

export async function settleBattleResult(room) {
  if (!room || room.status !== "finished" || room.players?.length !== 2) return null;
  const [a, b] = room.players;
  if (!a.userId || !b.userId || a.userId === b.userId) return null;
  const settlement = await withMongoTransaction(async ({ session }) => {
    const matches = getBattleMatchesCollection(), profiles = getBattleProfilesCollection(), seasonProfiles = getBattleSeasonProfilesCollection();
    const existing = await matches.findOne({ roomCode: room.code }, { session });
    if (existing) return { alreadyRecorded: true, match: existing };
    const lifeADoc = await profiles.findOne({ userId: a.userId }, { session });
    const lifeBDoc = await profiles.findOne({ userId: b.userId }, { session });
    const seasonADoc = room.seasonKey ? await seasonProfiles.findOne({ seasonKey: room.seasonKey, userId: a.userId }, { session }) : null;
    const seasonBDoc = room.seasonKey ? await seasonProfiles.findOne({ seasonKey: room.seasonKey, userId: b.userId }, { session }) : null;
    const lifeA = lifeADoc || defaultProfile(a), lifeB = lifeBDoc || defaultProfile(b), result = getOutcome(room, a, b), lifeElo = calculatePair(lifeA, lifeB, result.a, result.rated);
    const seasonA = room.seasonKey ? (seasonADoc || defaultSeasonProfile(room.seasonKey, a)) : null, seasonB = room.seasonKey ? (seasonBDoc || defaultSeasonProfile(room.seasonKey, b)) : null, seasonElo = room.seasonKey ? calculatePair(seasonA, seasonB, result.a, result.rated) : null;
    const tierBeforeA = seasonA ? getBattleTier({ rating: seasonA.rating, gamesPlayed: seasonA.gamesPlayed }) : null, tierBeforeB = seasonB ? getBattleTier({ rating: seasonB.rating, gamesPlayed: seasonB.gamesPlayed }) : null;
    const lifeStatsA = nextStats(lifeA, result.a, lifeElo.newRatingA), lifeStatsB = nextStats(lifeB, result.b, lifeElo.newRatingB), seasonStatsA = seasonA ? nextStats(seasonA, result.a, seasonElo.newRatingA) : null, seasonStatsB = seasonB ? nextStats(seasonB, result.b, seasonElo.newRatingB) : null;
    const tierA = seasonStatsA ? getBattleTier({ rating: seasonElo.newRatingA, gamesPlayed: seasonStatsA.gamesPlayed }) : null, tierB = seasonStatsB ? getBattleTier({ rating: seasonElo.newRatingB, gamesPlayed: seasonStatsB.gamesPlayed }) : null, now = new Date();
    const playerRecord = (player, outcomeValue, life, lifeChange, season, seasonChange, tierBefore, tier) => ({ userId: player.userId, name: player.name, score: player.score || 0, result: outcomeValue, ratingBefore: life.rating, ratingAfter: lifeChange.newRatingA, ratingDelta: lifeChange.deltaA, seasonRatingBefore: season?.rating ?? null, seasonRatingAfter: seasonChange?.newRatingA ?? null, seasonRatingDelta: seasonChange?.deltaA ?? null, seasonTierBefore: tierBefore?.name ?? null, seasonTierAfter: tier?.name ?? null, answerLog: Array.isArray(player.answerLog) ? player.answerLog.map((entry) => ({ questionIndex: entry.questionIndex, selectedIndex: entry.selectedIndex ?? null, correct: Boolean(entry.correct), timedOut: Boolean(entry.timedOut), responseTimeMs: Number.isFinite(entry.responseTimeMs) ? entry.responseTimeMs : null })) : [] });
    const match = { roomCode: room.code, matchmakingId: room.matchmakingId || null, seasonKey: room.seasonKey || null, subject: room.subject, topic: room.topic, questionCount: room.questionCount, finishReason: room.finishReason || "completed", rated: result.rated, players: [playerRecord(a, result.a, lifeA, lifeElo, seasonA, seasonElo, tierBeforeA, tierA), playerRecord(b, result.b, lifeB, { newRatingA: lifeElo.newRatingB, deltaA: lifeElo.deltaB }, seasonB, seasonElo && { newRatingA: seasonElo.newRatingB, deltaA: seasonElo.deltaB }, tierBeforeB, tierB)], createdAt: room.createdAt ? new Date(room.createdAt) : now, finishedAt: room.finishedAt ? new Date(room.finishedAt) : now, recordedAt: now };
    const inserted = await matches.insertOne(match, { session });
    await profiles.updateOne({ userId: a.userId }, { $set: { displayName: a.name, ...lifeStatsA, updatedAt: now }, $setOnInsert: { userId: a.userId, createdAt: now } }, { session, upsert: true });
    await profiles.updateOne({ userId: b.userId }, { $set: { displayName: b.name, ...lifeStatsB, updatedAt: now }, $setOnInsert: { userId: b.userId, createdAt: now } }, { session, upsert: true });
    if (room.seasonKey && result.a !== "abandoned") {
      await seasonProfiles.updateOne({ seasonKey: room.seasonKey, userId: a.userId }, { $set: { displayName: a.name, ...seasonStatsA, tier: tierA.name, updatedAt: now }, $setOnInsert: { seasonKey: room.seasonKey, userId: a.userId, createdAt: now } }, { session, upsert: true });
      await seasonProfiles.updateOne({ seasonKey: room.seasonKey, userId: b.userId }, { $set: { displayName: b.name, ...seasonStatsB, tier: tierB.name, updatedAt: now }, $setOnInsert: { seasonKey: room.seasonKey, userId: b.userId, createdAt: now } }, { session, upsert: true });
    }
    return { alreadyRecorded: false, match: { ...match, _id: inserted.insertedId }, achievementProfiles: { [a.userId]: { lifetime: { ...lifeA, ...lifeStatsA }, season: seasonStatsA ? { ...seasonA, ...seasonStatsA, tier: tierA.name } : null }, [b.userId]: { lifetime: { ...lifeB, ...lifeStatsB }, season: seasonStatsB ? { ...seasonB, ...seasonStatsB, tier: tierB.name } : null } } };
  });
  if (settlement?.match) await getBattleRoomsCollection().updateOne({ code: room.code }, { $set: { resultRecordedAt: new Date(), battleMatchId: settlement.match._id } }).catch(console.error);
  if (settlement?.match && !settlement.alreadyRecorded) void analyzeSettledBattle(settlement.match).catch((error) => console.error("Battle integrity analysis failed:", error));
  if (settlement?.match && !settlement.alreadyRecorded) void processBattleMissionProgress(settlement.match).catch((error) => console.error("Battle mission progress failed:", error));
  if (settlement?.match && !settlement.alreadyRecorded) for (const player of settlement.match.players) {
    const source = player.userId === a.userId ? a : b, profiles = settlement.achievementProfiles?.[player.userId];
    void evaluateBattleAchievements({ match: settlement.match, player: source, lifetimeProfile: profiles?.lifetime, seasonProfile: profiles?.season }).catch((error) => console.error("Battle achievement evaluation failed:", error));
  }
  return settlement;
}
