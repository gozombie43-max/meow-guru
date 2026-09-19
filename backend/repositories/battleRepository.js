import { ObjectId } from "mongodb";
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

// Cosmetics
export async function getCosmeticInventory(userId) {
  return getBattleCosmeticInventoryCollection().find({ userId }).sort({ unlockedAt: -1 }).toArray();
}

export async function getProgressionProfile(userId) {
  return getBattleProgressionProfilesCollection().findOne({ userId });
}

export async function getOwnedCosmetic(userId, cosmeticCode) {
  return getBattleCosmeticInventoryCollection().findOne({ userId, cosmeticCode });
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
  return getBattleProfilesCollection().findOne({ userId });
}

export async function getSeasonProfile(seasonKey, userId) {
  return getBattleSeasonProfilesCollection().findOne({ seasonKey, userId });
}

export async function getAchievements(userId, limit = 20) {
  return getBattleAchievementsCollection().find({ userId }).sort({ unlockedAt: -1 }).limit(limit).toArray();
}

export async function getRecentMatches(userId, limit = 5) {
  return getBattleMatchesCollection().find({ "players.userId": userId }).sort({ finishedAt: -1 }).limit(limit).toArray();
}

export async function getSeasonRewards(userId, limit = 10) {
  return getBattleSeasonRewardsCollection().find({ userId }).sort({ awardedAt: -1 }).limit(limit).toArray();
}

export async function getProfilesByIds(userIds) {
  return getBattleProfilesCollection().find({ userId: { $in: userIds } }).toArray();
}

export async function getSeasonProfilesByIds(seasonKey, userIds) {
  return getBattleSeasonProfilesCollection().find({ seasonKey, userId: { $in: userIds } }).toArray();
}

// Social
export async function getAcceptedFriendships(userId) {
  return getBattleFriendshipsCollection().find({ users: userId, status: "accepted" }).toArray();
}

export async function getIncomingFriendRequests(userId) {
  return getBattleFriendshipsCollection().find({ requestedToUserId: userId, status: "pending" }).sort({ createdAt: -1 }).toArray();
}

export async function getFavorites(userId) {
  return getBattleFavoritesCollection().find({ userId }).sort({ createdAt: -1 }).toArray();
}

// Seasons
export async function insertSeason(seasonDoc) {
  return getBattleSeasonsCollection().insertOne(seasonDoc);
}

export async function getSeasonLeaderboardItems(seasonKey, minGames = 5, limit = 100) {
  return getBattleSeasonProfilesCollection().find({ seasonKey, gamesPlayed: { $gte: minGames } }).sort({ rating: -1, wins: -1, gamesPlayed: -1 }).limit(limit).toArray();
}

export async function getSeasonRewardsList(userId, limit = 20) {
  return getBattleSeasonRewardsCollection().find({ userId }).sort({ awardedAt: -1 }).limit(limit).toArray();
}

// Global Leaderboard
export async function getGlobalLeaderboardItems(minGames = 1, limit = 100) {
  return getBattleProfilesCollection().find({ gamesPlayed: { $gte: minGames } }).sort({ rating: -1, wins: -1, gamesPlayed: -1 }).limit(limit).toArray();
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
