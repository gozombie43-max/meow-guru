import { ObjectId } from "mongodb";
import { getActiveBattleSeason } from "../battle/battleSeasonService.js";
import { getOnlineBattleUsers } from "../battle/battlePresenceService.js";
import { getBattleRivalry, getRecentBattleOpponents, removeBattleFriend, respondToBattleFriendRequest, sendBattleFriendRequest, setBattleFavorite } from "../battle/battleSocialService.js";
import { claimBattleMission, getBattleMissionOverview } from "../battle/battleProgressionService.js";
import { getBattleCosmetic } from "../battle/battleCosmeticCatalog.js";
import { claimBattleSeasonReward, DEFAULT_BATTLE_REWARD_TRACK, getBattleSeasonRewardTrack } from "../battle/battleSeasonRewardService.js";
import { getBattleCompetitiveHealth } from "../battle/battleAnalyticsService.js";
import { getBattleFeatures, isUserInBattleRollout } from "../config/battleFeatures.js";
import * as repo from "../repositories/battleRepository.js";

const defaultLifetime = { rating: 1200, peakRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, currentWinStreak: 0, bestWinStreak: 0 };
const defaultSeason = { rating: 1200, peakRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, tier: "Unranked" };

export const getCapabilities = (req, res) => {
  const features = getBattleFeatures();
  const eligible = isUserInBattleRollout(req.user.id);
  return res.json({
    available: eligible,
    newMatches: eligible && features.newMatchesEnabled,
    matchmaking: eligible && features.newMatchesEnabled && features.matchmakingEnabled,
    ranked: eligible && features.rankedEnabled,
    socialChallenges: eligible && features.newMatchesEnabled && features.socialChallengesEnabled,
    missions: eligible && features.missionsEnabled,
    rewards: eligible && features.rewardsEnabled
  });
};

export const getMissions = async (req, res, next) => {
  try {
    return res.json(await getBattleMissionOverview(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const claimMission = async (req, res, next) => {
  try {
    return res.json({ ok: true, ...(await claimBattleMission({ userId: req.user.id, missionProgressId: req.params.id })) });
  } catch (error) {
    if (["MISSION_NOT_CLAIMABLE", "MISSION_ALREADY_CLAIMED", "INVALID_MISSION"].includes(error.message)) return res.status(409).json({ message: error.message });
    next(error);
  }
};

export const getCompetitiveHealth = async (req, res, next) => {
  try {
    return res.json(await getBattleCompetitiveHealth(req.query.days));
  } catch (error) {
    next(error);
  }
};

export const getSeasonRewardTrackHandler = async (req, res, next) => {
  try {
    return res.json(await getBattleSeasonRewardTrack(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const claimSeasonRewardHandler = async (req, res, next) => {
  try {
    const season = await getActiveBattleSeason();
    if (!season) return res.status(409).json({ message: "NO_ACTIVE_SEASON" });
    return res.json({ ok: true, ...(await claimBattleSeasonReward({ userId: req.user.id, seasonKey: season.key, milestoneLevel: Number(req.params.level) })) });
  } catch (error) {
    if (["INVALID_REWARD_LEVEL", "REWARD_TRACK_CLOSED", "REWARD_NOT_FOUND", "INVALID_REWARD", "REWARD_LOCKED", "REWARD_ALREADY_CLAIMED"].includes(error.message)) return res.status(409).json({ message: error.message });
    next(error);
  }
};

export const getCosmetics = async (req, res, next) => {
  try {
    const [items, profile] = await Promise.all([
      repo.getCosmeticInventory(req.user.id),
      repo.getProgressionProfile(req.user.id)
    ]);
    return res.json({
      equipped: { title: profile?.equippedTitle || null, badge: profile?.equippedBadge || null, frame: profile?.equippedFrame || null },
      items: items.map((item) => ({ cosmeticCode: item.cosmeticCode, type: item.type, name: item.name, unlockedAt: item.unlockedAt }))
    });
  } catch (error) {
    next(error);
  }
};

export const equipCosmetic = async (req, res, next) => {
  try {
    const cosmeticCode = String(req.body?.cosmeticCode || "");
    const cosmetic = getBattleCosmetic(cosmeticCode);
    if (!cosmetic) return res.status(400).json({ message: "INVALID_COSMETIC" });
    
    const owned = await repo.getOwnedCosmetic(req.user.id, cosmeticCode);
    if (!owned) return res.status(403).json({ message: "COSMETIC_NOT_OWNED" });
    
    const field = cosmetic.type === "title" ? "equippedTitle" : cosmetic.type === "badge" ? "equippedBadge" : "equippedFrame";
    await repo.upsertProgressionProfileCosmetic(req.user.id, field, cosmeticCode);
    
    return res.json({ ok: true, type: cosmetic.type, cosmeticCode });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const season = await getActiveBattleSeason();
    const [lifetime, seasonProfile, achievements, recentMatches, rewards] = await Promise.all([
      repo.getProfile(userId),
      season ? repo.getSeasonProfile(season.key, userId) : null,
      repo.getAchievements(userId, 20),
      repo.getRecentMatches(userId, 5),
      repo.getSeasonRewards(userId, 10)
    ]);
    const safeRecentMatches = recentMatches.map((match) => {
      const me = match.players.find((player) => player.userId === userId);
      const opponent = match.players.find((player) => player.userId !== userId);
      return {
        id: String(match._id), roomCode: match.roomCode, subject: match.subject, topic: match.topic, finishReason: match.finishReason, finishedAt: match.finishedAt,
        myScore: me?.score ?? 0, opponentScore: opponent?.score ?? 0, result: me?.result || "unknown", ratingDelta: me?.ratingDelta ?? 0, seasonRatingDelta: me?.seasonRatingDelta ?? null,
        opponent: { userId: opponent?.userId || null, name: opponent?.name || "Opponent" }
      };
    });
    return res.json({
      lifetime: lifetime || defaultLifetime,
      season: season ? { info: { key: season.key, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt }, profile: seasonProfile || defaultSeason } : null,
      achievements, rewards, recentMatches: safeRecentMatches
    });
  } catch (error) {
    next(error);
  }
};

export const getPlayerSummary = async (req, res, next) => {
  try {
    const userId = String(req.params.userId);
    const season = await getActiveBattleSeason();
    const [lifetime, seasonal] = await Promise.all([
      repo.getProfile(userId),
      season ? repo.getSeasonProfile(season.key, userId) : null
    ]);
    return res.json({
      userId, displayName: seasonal?.displayName || lifetime?.displayName || "Player",
      lifetime: { rating: lifetime?.rating ?? 1200, gamesPlayed: lifetime?.gamesPlayed ?? 0, wins: lifetime?.wins ?? 0, losses: lifetime?.losses ?? 0, currentWinStreak: lifetime?.currentWinStreak ?? 0 },
      season: seasonal ? { rating: seasonal.rating, tier: seasonal.tier, gamesPlayed: seasonal.gamesPlayed, wins: seasonal.wins } : null
    });
  } catch (error) {
    next(error);
  }
};

export const getSocial = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const [accepted, incoming, favoriteDocs, recent, season] = await Promise.all([
      repo.getAcceptedFriendships(userId),
      repo.getIncomingFriendRequests(userId),
      repo.getFavorites(userId),
      getRecentBattleOpponents(userId),
      getActiveBattleSeason()
    ]);
    
    const friendIds = accepted.map((item) => item.users.find((id) => id !== userId));
    const incomingIds = incoming.map((item) => item.requestedByUserId);
    const favoriteIds = favoriteDocs.map((item) => item.targetUserId);
    const all = [...new Set([...friendIds, ...incomingIds, ...favoriteIds, ...recent.map((item) => item.userId)])];
    
    const [life, seasonal, online] = await Promise.all([
      repo.getProfilesByIds(all),
      season ? repo.getSeasonProfilesByIds(season.key, all) : [],
      getOnlineBattleUsers(all)
    ]);
    
    const lifeMap = new Map(life.map((item) => [item.userId, item]));
    const seasonMap = new Map(seasonal.map((item) => [item.userId, item]));
    
    const decorate = (id, name = "Player") => {
      const l = lifeMap.get(id);
      const s = seasonMap.get(id);
      return {
        userId: id, displayName: s?.displayName || l?.displayName || name, online: Boolean(online[id]), lifetimeRating: l?.rating ?? 1200,
        season: s ? { rating: s.rating, tier: s.tier, wins: s.wins } : null, favorite: favoriteIds.includes(id)
      };
    };
    
    return res.json({
      friends: friendIds.map((id) => decorate(id)), requests: incomingIds.map((id) => decorate(id)), favorites: favoriteIds.map((id) => decorate(id)),
      recentOpponents: recent.map((item) => ({ ...decorate(item.userId, item.name), lastPlayedAt: item.lastPlayedAt }))
    });
  } catch (error) {
    next(error);
  }
};

export const sendFriendRequestRoute = async (req, res, next) => {
  try {
    return res.json({ friendship: await sendBattleFriendRequest(req.user.id, req.params.userId) });
  } catch (error) {
    next(error);
  }
};

export const respondFriendRequestRoute = async (req, res, next) => {
  try {
    const action = String(req.body?.action || "");
    if (!["accept", "decline"].includes(action)) return res.status(400).json({ message: "Invalid action." });
    return res.json({ friendship: await respondToBattleFriendRequest({ userId: req.user.id, requesterUserId: req.params.userId, action }) });
  } catch (error) {
    next(error);
  }
};

export const removeFriendRoute = async (req, res, next) => {
  try {
    await removeBattleFriend(req.user.id, req.params.userId);
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const setFavoriteRoute = async (req, res, next) => {
  try {
    await setBattleFavorite({ userId: req.user.id, targetUserId: req.params.userId, favorite: Boolean(req.body?.favorite) });
    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const getPlayerRivalryRoute = async (req, res, next) => {
  try {
    return res.json(await getBattleRivalry(req.user.id, req.params.userId));
  } catch (error) {
    next(error);
  }
};

export const createSeason = async (req, res, next) => {
  try {
    const { key, name, startsAt, endsAt } = req.body || {};
    const start = new Date(startsAt), end = new Date(endsAt);
    if (!key || !name || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return res.status(400).json({ message: "Invalid season configuration." });
    const now = new Date();
    await repo.insertSeason({ key: String(key).trim(), name: String(name).trim(), startsAt: start, endsAt: end, status: start <= now && end > now ? "active" : "scheduled", rewardTrack: DEFAULT_BATTLE_REWARD_TRACK, createdAt: now, createdByUserId: req.user.id, updatedAt: now });
    return res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSeason = async (_req, res, next) => {
  try {
    const season = await getActiveBattleSeason();
    return res.json({ season: season ? { key: season.key, name: season.name, startsAt: season.startsAt, endsAt: season.endsAt } : null });
  } catch (error) {
    next(error);
  }
};

export const getMySeason = async (req, res, next) => {
  try {
    const season = await getActiveBattleSeason();
    if (!season) return res.json({ season: null, profile: null });
    const profile = await repo.getSeasonProfile(season.key, req.user.id);
    const fallback = { seasonKey: season.key, userId: req.user.id, rating: 1200, peakRating: 1200, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, currentWinStreak: 0, bestWinStreak: 0, tier: "Unranked" };
    return res.json({ season, profile: profile || fallback });
  } catch (error) {
    next(error);
  }
};

export const getSeasonLeaderboardRoute = async (_req, res, next) => {
  try {
    const season = await getActiveBattleSeason();
    if (!season) return res.json({ season: null, items: [] });
    const profiles = await repo.getSeasonLeaderboardItems(season.key, 5, 100);
    return res.json({ season, items: profiles.map((profile, index) => ({ rank: index + 1, userId: profile.userId, displayName: profile.displayName, rating: profile.rating, tier: profile.tier, gamesPlayed: profile.gamesPlayed, wins: profile.wins, losses: profile.losses, draws: profile.draws, streak: profile.currentWinStreak })) });
  } catch (error) {
    next(error);
  }
};

export const getSeasonRewardsListRoute = async (req, res, next) => {
  try {
    const items = await repo.getSeasonRewardsList(req.user.id, 20);
    return res.json({ items });
  } catch (error) {
    next(error);
  }
};

export const getLeaderboardRoute = async (_req, res, next) => {
  try {
    const profiles = await repo.getGlobalLeaderboardItems(1, 100);
    return res.json({ items: profiles.map((profile, index) => ({ rank: index + 1, userId: profile.userId, displayName: profile.displayName, rating: profile.rating, gamesPlayed: profile.gamesPlayed, wins: profile.wins, losses: profile.losses, draws: profile.draws, streak: profile.currentWinStreak })) });
  } catch (error) {
    next(error);
  }
};

export const getIntegritySummary = async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const since = new Date(Date.now() - days * 86_400_000);
    const [openSignals, highSeverity, flaggedPlayers, byType] = await Promise.all([
      repo.getOpenIntegrityEventsCount(since),
      repo.getHighSeverityOpenIntegrityEventsCount(since),
      repo.getFlaggedPlayersCount(since),
      repo.getOpenIntegrityEventsByType(since)
    ]);
    return res.json({ days, openSignals, highSeverity, flaggedPlayers, byType: byType.map((entry) => ({ signalType: entry._id, count: entry.count })) });
  } catch (error) {
    next(error);
  }
};

export const getIntegrityEventsList = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.severity) filter.severity = String(req.query.severity);
    if (req.query.userId) filter.userId = String(req.query.userId);
    
    const [items, total] = await Promise.all([
      repo.getIntegrityEvents(filter, { severity: -1, lastSeenAt: -1 }, (page - 1) * limit, limit),
      repo.countIntegrityEvents(filter)
    ]);
    return res.json({ items, total, page, limit, hasMore: page * limit < total });
  } catch (error) {
    next(error);
  }
};

export const updateIntegrityEvent = async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid event ID." });
    const status = String(req.body?.status || "");
    const allowed = new Set(["reviewed", "dismissed", "escalated"]);
    if (!allowed.has(status)) return res.status(400).json({ message: "Invalid review status." });
    
    const now = new Date();
    const reviewNote = String(req.body?.note || "").trim().slice(0, 1000);
    const result = await repo.updateIntegrityEventStatus(req.params.id, { status, reviewNote, reviewedByUserId: req.user.id, reviewedByEmail: req.user.email, reviewedAt: now });
    
    if (!result) return res.status(404).json({ message: "Integrity event not found." });
    await repo.logIntegrityReviewAudit({ action: "battle_integrity_review", targetUserId: result.userId, adminId: req.user.id, adminEmail: req.user.email, details: { eventId: String(result._id), status, signalType: result.signalType }, createdAt: now });
    
    return res.json(result);
  } catch (error) {
    next(error);
  }
};
