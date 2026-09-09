import dns from "node:dns";
import { MongoClient } from "mongodb";
import { observeMongo } from '../infrastructure/logger.js';

const dnsServers = process.env.MONGODB_DNS_SERVERS;

if (dnsServers) {
  dns.setServers(
    dnsServers
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
}

let client = null;
let db = null;
let connecting = null;

export async function connectMongoDB() {
  if (db) return db;
  if (!connecting) connecting = openMongoDB().finally(() => { connecting = null; });
  return connecting;
}

async function openMongoDB() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  const connectingClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000,
    maxPoolSize: 30, minPoolSize: 0, maxIdleTimeMS: 60000, waitQueueTimeoutMS: 5000,
    monitorCommands: true,
  });
  connectingClient.on('commandSucceeded', event => observeMongo(event));
  connectingClient.on('commandFailed', event => observeMongo(event, true));
  try {
    await connectingClient.connect();
    await connectingClient.db('admin').command({ ping: 1 }, { timeoutMS: 5000 });
    client = connectingClient;
    db = client.db(process.env.MONGODB_DB || 'quizDB');
  } catch (error) {
    await connectingClient.close();
    throw error;
  }

  console.log("✅ MongoDB Atlas connected");

  return db;
}

export function getMongoDB() {
  if (!db) {
    throw new Error(
      "MongoDB has not been initialized. Call connectMongoDB() first."
    );
  }

  return db;
}

export async function disconnectMongoDB() {
  if (connecting) await connecting.catch(() => {});
  const activeClient = client;

  // Prevent collection access while shutdown is in progress.
  client = null;
  db = null;

  if (!activeClient) {
    return;
  }

  try {
    await activeClient.close();
    console.log("MongoDB Atlas disconnected ✅");
  } catch (error) {
    console.error("MongoDB disconnect failed:", error);
    throw error;
  }
}

export async function withMongoTransaction(work) {
  if (!client || !db) throw new Error("MongoDB is not initialized");
  const session = client.startSession();
  try {
    return await session.withTransaction(
      () => work({ session, db }),
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }
    );
  } finally {
    await session.endSession();
  }
}

export function getQuestionsCollection() {
  return getMongoDB().collection("questions");
}

export function getUsersCollection() {
  return getMongoDB().collection("users");
}

export function getNotesCollection() {
  return getMongoDB().collection("notes");
}

export function getAccessCodesCollection() {
  return getMongoDB().collection(
    'accessCodes'
  );
}

export function getMockAttemptsCollection() {
  return getMongoDB().collection("mockAttempts");
}

export function getMockSlotsCollection() {
  return getMongoDB().collection("mockSlots");
}

export function getVideosCollection() {
  return getMongoDB().collection("videos");
}

export function getAuditLogCollection() {
  return getMongoDB().collection("auditLog");
}

export function getPushDevicesCollection() {
  return getMongoDB().collection("pushDevices");
}

export function getNotificationHistoryCollection() {
  return getMongoDB().collection(
    "notificationHistory"
  );
}

export function getScheduledNotificationsCollection() {
  return getMongoDB().collection(
    "scheduledNotifications"
  );
}

export function getBattleRoomsCollection() {
  return getMongoDB().collection("battleRooms");
}

export function getSocketIoAdapterCollection() {
  return getMongoDB().collection("socketIoAdapterEvents");
}

export function getBattleMatchesCollection() { return getMongoDB().collection("battleMatches"); }
export function getBattleProfilesCollection() { return getMongoDB().collection("battleProfiles"); }
export function getBattleMatchmakingQueueCollection() { return getMongoDB().collection("battleMatchmakingQueue"); }
export function getBattleSeasonsCollection() { return getMongoDB().collection("battleSeasons"); }
export function getBattleSeasonProfilesCollection() { return getMongoDB().collection("battleSeasonProfiles"); }
export function getBattleSeasonRewardsCollection() { return getMongoDB().collection("battleSeasonRewards"); }
export function getBattleIntegrityEventsCollection() { return getMongoDB().collection("battleIntegrityEvents"); }
export function getBattleAchievementsCollection() { return getMongoDB().collection("battleAchievements"); }
export function getBattleFriendshipsCollection() { return getMongoDB().collection("battleFriendships"); }
export function getBattleFavoritesCollection() { return getMongoDB().collection("battleFavorites"); }
export function getBattleProgressionProfilesCollection() { return getMongoDB().collection("battleProgressionProfiles"); }
export function getBattleSeasonProgressCollection() { return getMongoDB().collection("battleSeasonProgress"); }
export function getBattleMissionProgressCollection() { return getMongoDB().collection("battleMissionProgress"); }
export function getBattleProgressEventsCollection() { return getMongoDB().collection("battleProgressEvents"); }
export function getBattleSeasonRewardClaimsCollection() { return getMongoDB().collection("battleSeasonRewardClaims"); }
export function getBattleCosmeticInventoryCollection() { return getMongoDB().collection("battleCosmeticInventory"); }

export function getNotificationWorkerHealthCollection() {
  return getMongoDB().collection(
    "notificationWorkerHealth"
  );
}

export function getStudyActivityDailyCollection() {
  return getMongoDB().collection(
    "studyActivityDaily"
  );
}

export function getExamUpdatesCollection() {
  return getMongoDB().collection(
    "examUpdates"
  );
}

export function getNotificationFeedCollection() {
  return getMongoDB().collection(
    "notificationFeed"
  );
}

export function getNotificationReceiptsCollection() {
  return getMongoDB().collection(
    "notificationReceipts"
  );
}

export function getNotificationEngagementCollection() {
  return getMongoDB().collection(
    "notificationEngagement"
  );
}
