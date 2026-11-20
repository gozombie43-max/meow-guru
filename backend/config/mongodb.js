import { runtimeLog } from '../infrastructure/runtimeLog.js';
import dns from "node:dns";
import { MongoClient } from "mongodb";
import { observeMongo } from '../infrastructure/logger.js';
import { mongoPoolWaiting, dependencyLatency } from '../infrastructure/metrics.js';
import { attachMongoOperationMetrics } from '../infrastructure/mongoOperationMetrics.js';

const DEFAULT_MAX_POOL_SIZE = 50;
const DEFAULT_MIN_POOL_SIZE = 5;

function parseBoundedInt(raw, fallback, min, max) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function getConfiguredPoolSizes(env = process.env) {
  const maxPoolSize = parseBoundedInt(env.MONGO_MAX_POOL_SIZE, DEFAULT_MAX_POOL_SIZE, 1, 500);
  const minPoolSize = parseBoundedInt(env.MONGO_MIN_POOL_SIZE, DEFAULT_MIN_POOL_SIZE, 0, maxPoolSize);
  return { maxPoolSize, minPoolSize };
}

let poolWaiting = 0;
let configuredMaxPoolSize = getConfiguredPoolSizes().maxPoolSize;
export function mongoPoolHealth() { return { waiting: poolWaiting, capacity: configuredMaxPoolSize }; }

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

  const { maxPoolSize, minPoolSize } = getConfiguredPoolSizes();
  configuredMaxPoolSize = maxPoolSize;

  const connectingClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000, connectTimeoutMS: 10000,
    maxPoolSize, minPoolSize, maxIdleTimeMS: 60000, waitQueueTimeoutMS: 5000,
    monitorCommands: true,
  });
  const commandCollections = new Map();
  connectingClient.on('commandStarted', event => {
    const raw = event.commandName === 'getMore' ? event.command?.collection : event.command?.[event.commandName];
    if (typeof raw === 'string' && raw) {
      if (commandCollections.size > 4096) commandCollections.clear();
      commandCollections.set(event.requestId, raw);
    }
  });
  const finishCommand = (event, failed) => {
    const collection = commandCollections.get(event.requestId);
    commandCollections.delete(event.requestId);
    observeMongo(event, failed, collection ? { collection } : undefined);
  };
  connectingClient.on('commandSucceeded', event => finishCommand(event, false));
  connectingClient.on('commandFailed', event => finishCommand(event, true));
  attachMongoOperationMetrics(connectingClient);
  connectingClient.on('connectionCheckOutStarted', () => { poolWaiting++; mongoPoolWaiting.set(poolWaiting); });
  const checkoutFinished = event => {
    poolWaiting = Math.max(0, poolWaiting - 1); mongoPoolWaiting.set(poolWaiting);
    if (Number.isFinite(event.durationMS)) dependencyLatency.observe({ dependency: 'mongo.pool', operation: 'checkout' }, event.durationMS / 1000);
  };
  connectingClient.on('connectionCheckedOut', checkoutFinished);
  connectingClient.on('connectionCheckOutFailed', checkoutFinished);
  try {
    await connectingClient.connect();
    await connectingClient.db('admin').command({ ping: 1 }, { timeoutMS: 5000 });
    client = connectingClient;
    db = client.db(process.env.MONGODB_DB || 'quizDB');
  } catch (error) {
    await connectingClient.close();
    throw error;
  }

  runtimeLog.info("✅ MongoDB Atlas connected");

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
  poolWaiting = 0; mongoPoolWaiting.set(0);

  if (!activeClient) {
    return;
  }

  try {
    await activeClient.close();
    runtimeLog.info("MongoDB Atlas disconnected ✅");
  } catch (error) {
    runtimeLog.error("MongoDB disconnect failed:", error);
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

export function getUserQuestionProgressCollection() {
  return getMongoDB().collection("userQuestionProgress");
}

export function getUserTopicProgressCollection() {
  return getMongoDB().collection("userTopicProgress");
}
