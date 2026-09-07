import express from "express";
import { ObjectId } from "mongodb";
import { protect } from "../middleware/protect.js";
import { requireRole } from "../middleware/requireRole.js";
import { getAuditLogCollection, getBattleAchievementsCollection, getBattleCosmeticInventoryCollection, getBattleFavoritesCollection, getBattleFriendshipsCollection, getBattleIntegrityEventsCollection, getBattleMatchesCollection, getBattleProfilesCollection, getBattleProgressionProfilesCollection, getBattleSeasonProfilesCollection, getBattleSeasonRewardsCollection, getBattleSeasonsCollection } from "../config/mongodb.js";
import { getActiveBattleSeason } from "../battle/battleSeasonService.js";
import { getOnlineBattleUsers } from "../battle/battlePresenceService.js";
import { getBattleRivalry, getRecentBattleOpponents, removeBattleFriend, respondToBattleFriendRequest, sendBattleFriendRequest, setBattleFavorite } from "../battle/battleSocialService.js";
import { claimBattleMission, getBattleMissionOverview } from "../battle/battleProgressionService.js";
import { getBattleCosmetic } from "../battle/battleCosmeticCatalog.js";
import { claimBattleSeasonReward, DEFAULT_BATTLE_REWARD_TRACK, getBattleSeasonRewardTrack } from "../battle/battleSeasonRewardService.js";
import { getBattleCompetitiveHealth } from "../battle/battleAnalyticsService.js";
import { getBattleFeatures, isUserInBattleRollout } from "../config/battleFeatures.js";
import { battleReadLimiter } from "../middleware/battleRateLimits.js";

const router = express.Router();

const defaultLifetime = { rating: 1200, peakRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, currentWinStreak: 0, bestWinStreak: 0 };
const defaultSeason = { rating: 1200, peakRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, tier: "Unranked" };
router.get("/capabilities", protect, battleReadLimiter, (req, res) => { const features = getBattleFeatures(), eligible = isUserInBattleRollout(req.user.id); return res.json({ available: eligible, newMatches: eligible && features.newMatchesEnabled, matchmaking: eligible && features.newMatchesEnabled && features.matchmakingEnabled, ranked: eligible && features.rankedEnabled, socialChallenges: eligible && features.newMatchesEnabled && features.socialChallengesEnabled, missions: eligible && features.missionsEnabled, rewards: eligible && features.rewardsEnabled }); });

router.get("/missions", protect, async (req, res, next) => { try { return res.json(await getBattleMissionOverview(req.user.id)); } catch (error) { next(error); } });
router.post("/missions/:id/claim", protect, async (req, res, next) => { try { return res.json({ ok: true, ...(await claimBattleMission({ userId: req.user.id, missionProgressId: req.params.id })) }); } catch (error) { if (["MISSION_NOT_CLAIMABLE", "MISSION_ALREADY_CLAIMED", "INVALID_MISSION"].includes(error.message)) return res.status(409).json({ message: error.message }); next(error); } });
router.get("/admin/analytics/competitive-health", protect, requireRole("admin", "superadmin"), async (req, res, next) => { try { return res.json(await getBattleCompetitiveHealth(req.query.days)); } catch (error) { next(error); } });
router.get("/season/reward-track", protect, async (req, res, next) => { try { return res.json(await getBattleSeasonRewardTrack(req.user.id)); } catch (error) { next(error); } });
router.post("/season/reward-track/:level/claim", protect, async (req, res, next) => { try { const season = await getActiveBattleSeason(); if (!season) return res.status(409).json({ message: "NO_ACTIVE_SEASON" }); return res.json({ ok: true, ...(await claimBattleSeasonReward({ userId: req.user.id, seasonKey: season.key, milestoneLevel: Number(req.params.level) })) }); } catch (error) { if (["INVALID_REWARD_LEVEL", "REWARD_TRACK_CLOSED", "REWARD_NOT_FOUND", "INVALID_REWARD", "REWARD_LOCKED", "REWARD_ALREADY_CLAIMED"].includes(error.message)) return res.status(409).json({ message: error.message }); next(error); } });
router.get("/cosmetics", protect, async (req, res, next) => { try { const [items, profile] = await Promise.all([getBattleCosmeticInventoryCollection().find({ userId: req.user.id }).sort({ unlockedAt: -1 }).toArray(), getBattleProgressionProfilesCollection().findOne({ userId: req.user.id })]); return res.json({ equipped: { title: profile?.equippedTitle || null, badge: profile?.equippedBadge || null, frame: profile?.equippedFrame || null }, items: items.map((item) => ({ cosmeticCode: item.cosmeticCode, type: item.type, name: item.name, unlockedAt: item.unlockedAt })) }); } catch (error) { next(error); } });
router.put("/cosmetics/equip", protect, async (req, res, next) => { try { const cosmeticCode = String(req.body?.cosmeticCode || ""), cosmetic = getBattleCosmetic(cosmeticCode); if (!cosmetic) return res.status(400).json({ message: "INVALID_COSMETIC" }); const owned = await getBattleCosmeticInventoryCollection().findOne({ userId: req.user.id, cosmeticCode }); if (!owned) return res.status(403).json({ message: "COSMETIC_NOT_OWNED" }); const field = cosmetic.type === "title" ? "equippedTitle" : cosmetic.type === "badge" ? "equippedBadge" : "equippedFrame"; await getBattleProgressionProfilesCollection().updateOne({ userId: req.user.id }, { $set: { [field]: cosmeticCode, updatedAt: new Date() }, $setOnInsert: { userId: req.user.id, totalXp: 0, level: 1, createdAt: new Date() } }, { upsert: true }); return res.json({ ok: true, type: cosmetic.type, cosmeticCode }); } catch (error) { next(error); } });

router.get("/profile", protect, async (req, res, next) => {
  try {
    const userId = req.user.id, season = await getActiveBattleSeason();
    const [lifetime, seasonProfile, achievements, recentMatches, rewards] = await Promise.all([getBattleProfilesCollection().findOne({ userId }), season ? getBattleSeasonProfilesCollection().findOne({ seasonKey: season.key, userId }) : null, getBattleAchievementsCollection().find({ userId }).sort({ unlockedAt: -1 }).limit(20).toArray(), getBattleMatchesCollection().find({ "players.userId": userId }).sort({ finishedAt: -1 }).limit(5).toArray(), getBattleSeasonRewardsCollection().find({ userId }).sort({ awardedAt: -1 }).limit(10).toArray()]);
    const safeRecentMatches = recentMatches.map((match) => { const me = match.players.find((player) => player.userId === userId), opponent = match.players.find((player) => player.userId !== userId); return { id: String(match._id), roomCode: match.roomCode, subject: match.subject, topic: match.topic, finishReason: match.finishReason, finishedAt: match.finishedAt, myScore: me?.score ?? 0, opponentScore: opponent?.score ?? 0, result: me?.result || "unknown", ratingDelta: me?.ratingDelta ?? 0, seasonRatingDelta: me?.seasonRatingDelta ?? null, opponent: { userId: opponent?.userId || null, name: opponent?.name || "Opponent" } }; });
    return res.json({ lifetime: lifetime || defaultLifetime, season: season ? { info: { key: season.key, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt }, profile: seasonProfile || defaultSeason } : null, achievements, rewards, recentMatches: safeRecentMatches });
  } catch (error) { next(error); }
});

router.get("/players/:userId/summary", protect, async (req, res, next) => {
  try { const userId = String(req.params.userId), season = await getActiveBattleSeason(), [lifetime, seasonal] = await Promise.all([getBattleProfilesCollection().findOne({ userId }), season ? getBattleSeasonProfilesCollection().findOne({ seasonKey: season.key, userId }) : null]); return res.json({ userId, displayName: seasonal?.displayName || lifetime?.displayName || "Player", lifetime: { rating: lifetime?.rating ?? 1200, gamesPlayed: lifetime?.gamesPlayed ?? 0, wins: lifetime?.wins ?? 0, losses: lifetime?.losses ?? 0, currentWinStreak: lifetime?.currentWinStreak ?? 0 }, season: seasonal ? { rating: seasonal.rating, tier: seasonal.tier, gamesPlayed: seasonal.gamesPlayed, wins: seasonal.wins } : null }); }
  catch (error) { next(error); }
});

router.get("/social", protect, async (req, res, next) => {
  try { const userId = String(req.user.id), friendships = getBattleFriendshipsCollection(), favorites = getBattleFavoritesCollection(), [accepted, incoming, favoriteDocs, recent, season] = await Promise.all([friendships.find({ users: userId, status: "accepted" }).toArray(), friendships.find({ requestedToUserId: userId, status: "pending" }).sort({ createdAt: -1 }).toArray(), favorites.find({ userId }).sort({ createdAt: -1 }).toArray(), getRecentBattleOpponents(userId), getActiveBattleSeason()]); const friendIds = accepted.map((item) => item.users.find((id) => id !== userId)), incomingIds = incoming.map((item) => item.requestedByUserId), favoriteIds = favoriteDocs.map((item) => item.targetUserId), all = [...new Set([...friendIds, ...incomingIds, ...favoriteIds, ...recent.map((item) => item.userId)])]; const [life, seasonal, online] = await Promise.all([getBattleProfilesCollection().find({ userId: { $in: all } }).toArray(), season ? getBattleSeasonProfilesCollection().find({ seasonKey: season.key, userId: { $in: all } }).toArray() : [], getOnlineBattleUsers(all)]); const lifeMap = new Map(life.map((item) => [item.userId, item])), seasonMap = new Map(seasonal.map((item) => [item.userId, item])); const decorate = (id, name = "Player") => { const l = lifeMap.get(id), s = seasonMap.get(id); return { userId: id, displayName: s?.displayName || l?.displayName || name, online: Boolean(online[id]), lifetimeRating: l?.rating ?? 1200, season: s ? { rating: s.rating, tier: s.tier, wins: s.wins } : null, favorite: favoriteIds.includes(id) }; }; return res.json({ friends: friendIds.map((id) => decorate(id)), requests: incomingIds.map((id) => decorate(id)), favorites: favoriteIds.map((id) => decorate(id)), recentOpponents: recent.map((item) => ({ ...decorate(item.userId, item.name), lastPlayedAt: item.lastPlayedAt })) }); }
  catch (error) { next(error); }
});
router.post("/social/friends/:userId", protect, async (req, res, next) => { try { return res.json({ friendship: await sendBattleFriendRequest(req.user.id, req.params.userId) }); } catch (error) { next(error); } });
router.post("/social/friends/:userId/respond", protect, async (req, res, next) => { try { const action = String(req.body?.action || ""); if (!["accept", "decline"].includes(action)) return res.status(400).json({ message: "Invalid action." }); return res.json({ friendship: await respondToBattleFriendRequest({ userId: req.user.id, requesterUserId: req.params.userId, action }) }); } catch (error) { next(error); } });
router.delete("/social/friends/:userId", protect, async (req, res, next) => { try { await removeBattleFriend(req.user.id, req.params.userId); return res.json({ ok: true }); } catch (error) { next(error); } });
router.put("/social/favorites/:userId", protect, async (req, res, next) => { try { await setBattleFavorite({ userId: req.user.id, targetUserId: req.params.userId, favorite: Boolean(req.body?.favorite) }); return res.json({ ok: true }); } catch (error) { next(error); } });
router.get("/players/:userId/rivalry", protect, async (req, res, next) => { try { return res.json(await getBattleRivalry(req.user.id, req.params.userId)); } catch (error) { next(error); } });

router.post("/admin/seasons", protect, requireRole("admin", "superadmin"), async (req, res, next) => {
  try {
    const { key, name, startsAt, endsAt } = req.body || {};
    const start = new Date(startsAt), end = new Date(endsAt);
    if (!key || !name || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return res.status(400).json({ message: "Invalid season configuration." });
    const now = new Date();
    await getBattleSeasonsCollection().insertOne({ key: String(key).trim(), name: String(name).trim(), startsAt: start, endsAt: end, status: start <= now && end > now ? "active" : "scheduled", rewardTrack: DEFAULT_BATTLE_REWARD_TRACK, createdAt: now, createdByUserId: req.user.id, updatedAt: now });
    return res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

router.get("/season/current", protect, async (_req, res, next) => {
  try { const season = await getActiveBattleSeason(); return res.json({ season: season ? { key: season.key, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt } : null }); }
  catch (error) { next(error); }
});

router.get("/season/me", protect, async (req, res, next) => {
  try {
    const season = await getActiveBattleSeason();
    if (!season) return res.json({ season: null, profile: null });
    const profile = await getBattleSeasonProfilesCollection().findOne({ seasonKey: season.key, userId: req.user.id });
    const fallback = { seasonKey: season.key, userId: req.user.id, rating: 1200, peakRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, currentWinStreak: 0, bestWinStreak: 0, tier: "Unranked" };
    return res.json({ season, profile: profile || fallback });
  } catch (error) { next(error); }
});

router.get("/season/leaderboard", protect, async (_req, res, next) => {
  try {
    const season = await getActiveBattleSeason();
    if (!season) return res.json({ season: null, items: [] });
    const profiles = await getBattleSeasonProfilesCollection().find({ seasonKey: season.key, gamesPlayed: { $gte: 5 } }).sort({ rating: -1, wins: -1, gamesPlayed: -1 }).limit(100).toArray();
    return res.json({ season, items: profiles.map((profile, index) => ({ rank: index + 1, userId: profile.userId, displayName: profile.displayName, rating: profile.rating, tier: profile.tier, gamesPlayed: profile.gamesPlayed, wins: profile.wins, losses: profile.losses, draws: profile.draws, streak: profile.currentWinStreak })) });
  } catch (error) { next(error); }
});

router.get("/season/rewards", protect, async (req, res, next) => {
  try { const items = await getBattleSeasonRewardsCollection().find({ userId: req.user.id }).sort({ awardedAt: -1 }).limit(20).toArray(); return res.json({ items }); }
  catch (error) { next(error); }
});

router.get("/leaderboard", protect, async (_req, res, next) => {
  try {
    const profiles = await getBattleProfilesCollection().find({ gamesPlayed: { $gt: 0 } }).sort({ rating: -1, wins: -1, gamesPlayed: -1 }).limit(100).toArray();
    return res.json({ items: profiles.map((profile, index) => ({ rank: index + 1, userId: profile.userId, displayName: profile.displayName, rating: profile.rating, gamesPlayed: profile.gamesPlayed, wins: profile.wins, losses: profile.losses, draws: profile.draws, streak: profile.currentWinStreak })) });
  } catch (error) { next(error); }
});

router.get("/admin/integrity/summary", protect, requireRole("admin", "superadmin"), async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7)), since = new Date(Date.now() - days * 86_400_000), events = getBattleIntegrityEventsCollection();
    const [openSignals, highSeverity, players, byType] = await Promise.all([events.countDocuments({ status: "open", lastSeenAt: { $gte: since } }), events.countDocuments({ status: "open", severity: "high", lastSeenAt: { $gte: since } }), events.distinct("userId", { status: "open", lastSeenAt: { $gte: since } }), events.aggregate([{ $match: { status: "open", lastSeenAt: { $gte: since } } }, { $group: { _id: "$signalType", count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray()]);
    return res.json({ days, openSignals, highSeverity, flaggedPlayers: players.length, byType: byType.map((entry) => ({ signalType: entry._id, count: entry.count })) });
  } catch (error) { next(error); }
});

router.get("/admin/integrity/events", protect, requireRole("admin", "superadmin"), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20)), filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.severity) filter.severity = String(req.query.severity);
    if (req.query.userId) filter.userId = String(req.query.userId);
    const events = getBattleIntegrityEventsCollection(), [items, total] = await Promise.all([events.find(filter).sort({ severity: -1, lastSeenAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(), events.countDocuments(filter)]);
    return res.json({ items, total, page, limit, hasMore: page * limit < total });
  } catch (error) { next(error); }
});

router.patch("/admin/integrity/events/:id", protect, requireRole("admin", "superadmin"), async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid event ID." });
    const status = String(req.body?.status || ""), allowed = new Set(["reviewed", "dismissed", "escalated"]);
    if (!allowed.has(status)) return res.status(400).json({ message: "Invalid review status." });
    const now = new Date(), reviewNote = String(req.body?.note || "").trim().slice(0, 1000);
    const result = await getBattleIntegrityEventsCollection().findOneAndUpdate({ _id: new ObjectId(req.params.id) }, { $set: { status, reviewNote, reviewedByUserId: req.user.id, reviewedByEmail: req.user.email, reviewedAt: now } }, { returnDocument: "after" });
    if (!result) return res.status(404).json({ message: "Integrity event not found." });
    await getAuditLogCollection().insertOne({ action: "battle_integrity_review", targetUserId: result.userId, adminId: req.user.id, adminEmail: req.user.email, details: { eventId: String(result._id), status, signalType: result.signalType }, createdAt: now });
    return res.json(result);
  } catch (error) { next(error); }
});

export default router;
