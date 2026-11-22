import { ObjectId } from "mongodb";
import { createTieredCache } from "../infrastructure/tieredCache.js";
import {
  getAuditLogCollection,
  getBattleAchievementsCollection,
  getBattleCosmeticInventoryCollection,
  getBattleFavoritesCollection,
  getBattleFriendshipsCollection,
  getBattleIntegrityEventsCollection,
  getBattleMatchesCollection,
  getBattleProfilesCollection,
  getBattleProgressionProfilesCollection,
  getBattleSeasonProfilesCollection,
  getBattleSeasonRewardsCollection,
  getBattleSeasonsCollection
} from "../config/mongodb.js";

const QUERY_MAX_TIME_MS = 3000;

export const GLOBAL_LEADERBOARD_PROJECTION = Object.freeze({
  _id: 0,
  userId: 1,
  displayName: 1,
  rating: 1,
  gamesPlayed: 1,
  wins: 1,
  losses: 1,
  draws: 1,
  currentWinStreak: 1,
  updatedAt: 1,
});

export const SEASON_LEADERBOARD_PROJECTION = Object.freeze({
  _id: 0,
  seasonKey: 1,
  userId: 1,
  displayName: 1,
  rating: 1,
  tier: 1,
  gamesPlayed: 1,
  wins: 1,
  losses: 1,
  draws: 1,
  currentWinStreak: 1,
  updatedAt: 1,
});

const battleLeaderboardCache = createTieredCache({
  name: "battle-leaderboard",
  freshMs: 30_000,
  staleMs: 60_000,
  localMs: 10_000,
});

export function invalidateBattleLeaderboardCache(seasonKey = null) {
  if (seasonKey) {
    const prefix = `meow:v1:battle-leaderboard:season:${String(seasonKey).trim()}:`;
    battleLeaderboardCache.deleteWhere((key) => String(key || "").startsWith(prefix));
    return;
  }
  battleLeaderboardCache.clear();
}

function clampLimit(limit, fallback, max = 500) {
  const num = Math.floor(Number(limit));
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(max, num);
}

// Cosmetics
export async function getCosmeticInventory(userId, limit = 200) {
  const boundedLimit = clampLimit(limit, 200, 500);
  return getBattleCosmeticInventoryCollection()
    .find(
      { userId },
      {
        projection: { _id: 0, userId: 1, cosmeticCode: 1, type: 1, name: 1, unlockedAt: 1 },
        maxTimeMS: QUERY_MAX_TIME_MS,
      },
    )
    .sort({ unlockedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getProgressionProfile(userId) {
  return getBattleProgressionProfilesCollection().findOne({ userId }, { maxTimeMS: QUERY_MAX_TIME_MS });
}

export async function getOwnedCosmetic(userId, cosmeticCode) {
  return getBattleCosmeticInventoryCollection().findOne({ userId, cosmeticCode }, { maxTimeMS: QUERY_MAX_TIME_MS });
}

export async function upsertProgressionProfileCosmetic(userId, field, cosmeticCode) {
  return getBattleProgressionProfilesCollection().updateOne(
    { userId },
    {
      $set: { [field]: cosmeticCode, updatedAt: new Date() },
      $setOnInsert: { userId, totalXp: 0, level: 1, createdAt: new Date() }
    },
    { upsert: true }
  );
}

// Profiles
export async function getProfile(userId) {
  return getBattleProfilesCollection().findOne({ userId }, { maxTimeMS: QUERY_MAX_TIME_MS });
}

export async function getSeasonProfile(seasonKey, userId) {
  return getBattleSeasonProfilesCollection().findOne({ seasonKey, userId }, { maxTimeMS: QUERY_MAX_TIME_MS });
}

export async function getAchievements(userId, limit = 20) {
  const boundedLimit = clampLimit(limit, 20, 100);
  return getBattleAchievementsCollection()
    .find({ userId }, { maxTimeMS: QUERY_MAX_TIME_MS })
    .sort({ unlockedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getRecentMatches(userId, limit = 5) {
  const boundedLimit = clampLimit(limit, 5, 50);
  return getBattleMatchesCollection()
    .find({ "players.userId": userId }, { maxTimeMS: QUERY_MAX_TIME_MS })
    .sort({ finishedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getSeasonRewards(userId, limit = 10) {
  const boundedLimit = clampLimit(limit, 10, 100);
  return getBattleSeasonRewardsCollection()
    .find({ userId }, { maxTimeMS: QUERY_MAX_TIME_MS })
    .sort({ awardedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getProfilesByIds(userIds, limit = 500) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const boundedLimit = clampLimit(limit, 500, 1000);
  return getBattleProfilesCollection()
    .find(
      { userId: { $in: userIds.slice(0, boundedLimit) } },
      {
        projection: { _id: 0, userId: 1, displayName: 1, rating: 1, gamesPlayed: 1, wins: 1, losses: 1 },
        maxTimeMS: QUERY_MAX_TIME_MS,
      },
    )
    .limit(boundedLimit)
    .toArray();
}

export async function getSeasonProfilesByIds(seasonKey, userIds, limit = 500) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const boundedLimit = clampLimit(limit, 500, 1000);
  return getBattleSeasonProfilesCollection()
    .find(
      { seasonKey, userId: { $in: userIds.slice(0, boundedLimit) } },
      {
        projection: { _id: 0, seasonKey: 1, userId: 1, displayName: 1, rating: 1, tier: 1, wins: 1, gamesPlayed: 1 },
        maxTimeMS: QUERY_MAX_TIME_MS,
      },
    )
    .limit(boundedLimit)
    .toArray();
}

// Social
export async function getAcceptedFriendships(userId, limit = 200) {
  const boundedLimit = clampLimit(limit, 200, 500);
  return getBattleFriendshipsCollection()
    .find(
      { users: userId, status: "accepted" },
      {
        projection: { _id: 0, users: 1, status: 1, createdAt: 1, updatedAt: 1 },
        maxTimeMS: QUERY_MAX_TIME_MS,
      },
    )
    .limit(boundedLimit)
    .toArray();
}

export async function getIncomingFriendRequests(userId, limit = 100) {
  const boundedLimit = clampLimit(limit, 100, 500);
  return getBattleFriendshipsCollection()
    .find(
      { requestedToUserId: userId, status: "pending" },
      {
        projection: { _id: 0, requestedByUserId: 1, requestedToUserId: 1, status: 1, createdAt: 1 },
        maxTimeMS: QUERY_MAX_TIME_MS,
      },
    )
    .sort({ createdAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getFavorites(userId, limit = 200) {
  const boundedLimit = clampLimit(limit, 200, 500);
  return getBattleFavoritesCollection()
    .find(
      { userId },
      {
        projection: { _id: 0, userId: 1, targetUserId: 1, createdAt: 1 },
        maxTimeMS: QUERY_MAX_TIME_MS,
      },
    )
    .sort({ createdAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

// Seasons
export async function insertSeason(seasonDoc) {
  return getBattleSeasonsCollection().insertOne(seasonDoc);
}

export async function getSeasonLeaderboardItems(seasonKey, minGames = 5, limit = 100) {
  const boundedLimit = clampLimit(limit, 100, 200);
  return getBattleSeasonProfilesCollection()
    .find(
      { seasonKey, gamesPlayed: { $gte: minGames } },
      { projection: SEASON_LEADERBOARD_PROJECTION, maxTimeMS: QUERY_MAX_TIME_MS },
    )
    .sort({ rating: -1, wins: -1, updatedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getCachedSeasonLeaderboardItems(seasonKey, minGames = 5, limit = 100) {
  const cleanKey = String(seasonKey || "").trim();
  const boundedLimit = clampLimit(limit, 100, 200);
  return battleLeaderboardCache.read(
    `meow:v1:battle-leaderboard:season:${cleanKey}:${minGames}:${boundedLimit}`,
    () => getSeasonLeaderboardItems(cleanKey, minGames, boundedLimit),
    { allowStale: true },
  );
}

export async function getSeasonRewardsList(userId, limit = 20) {
  const boundedLimit = clampLimit(limit, 20, 100);
  return getBattleSeasonRewardsCollection()
    .find({ userId }, { maxTimeMS: QUERY_MAX_TIME_MS })
    .sort({ awardedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

// Global Leaderboard
export async function getGlobalLeaderboardItems(minGames = 1, limit = 100) {
  const boundedLimit = clampLimit(limit, 100, 200);
  return getBattleProfilesCollection()
    .find(
      { gamesPlayed: { $gte: minGames } },
      { projection: GLOBAL_LEADERBOARD_PROJECTION, maxTimeMS: QUERY_MAX_TIME_MS },
    )
    .sort({ rating: -1, wins: -1, updatedAt: -1 })
    .limit(boundedLimit)
    .toArray();
}

export async function getCachedGlobalLeaderboardItems(minGames = 1, limit = 100) {
  const boundedLimit = clampLimit(limit, 100, 200);
  return battleLeaderboardCache.read(
    `meow:v1:battle-leaderboard:global:${minGames}:${boundedLimit}`,
    () => getGlobalLeaderboardItems(minGames, boundedLimit),
    { allowStale: true },
  );
}

// Integrity
export async function getOpenIntegrityEventsCount(since) {
  return getBattleIntegrityEventsCollection().countDocuments({ status: "open", lastSeenAt: { $gte: since } });
}

export async function getHighSeverityOpenIntegrityEventsCount(since) {
  return getBattleIntegrityEventsCollection().countDocuments({ status: "open", severity: "high", lastSeenAt: { $gte: since } });
}

export async function getFlaggedPlayersCount(since) {
  const players = await getBattleIntegrityEventsCollection().distinct("userId", { status: "open", lastSeenAt: { $gte: since } });
  return players.length;
}

export async function getOpenIntegrityEventsByType(since) {
  return getBattleIntegrityEventsCollection().aggregate([
    { $match: { status: "open", lastSeenAt: { $gte: since } } },
    { $group: { _id: "$signalType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
}

export async function getIntegrityEvents(filter, sort, skip, limit) {
  return getBattleIntegrityEventsCollection().find(filter).sort(sort).skip(skip).limit(limit).toArray();
}

export async function countIntegrityEvents(filter) {
  return getBattleIntegrityEventsCollection().countDocuments(filter);
}

export async function updateIntegrityEventStatus(eventId, updateObj) {
  return getBattleIntegrityEventsCollection().findOneAndUpdate(
    { _id: new ObjectId(eventId) },
    { $set: updateObj },
    { returnDocument: "after" }
  );
}

export async function logIntegrityReviewAudit(auditDoc) {
  return getAuditLogCollection().insertOne(auditDoc);
}
