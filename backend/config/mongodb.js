import dns from "node:dns";
import { MongoClient } from "mongodb";

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

export async function connectMongoDB() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  client ??= new MongoClient(uri);
  await client.connect();

  // Verify the connection
  await client.db("admin").command({ ping: 1 });

  db = client.db("quizDB");

  await Promise.all([
    db.collection("questions").createIndex({ topic: 1 }),
    db.collection("questions").createIndex({ subject: 1 }),
    // Cursor order and normalized ingestion keys.
    db.collection("questions").createIndex({ topic: 1, _id: 1 }),
    db.collection("questions").createIndex({ topicKey: 1, _id: 1 }),
    db.collection("questions").createIndex({ subjectKey: 1, topicKey: 1, quizKey: 1, _id: 1 }),
    // Compound indexes for filtered + paginated queries
    db.collection("questions").createIndex({ topic: 1, questionType: 1 }),
    db.collection("questions").createIndex({ topic: 1, quizName: 1 }),
    db.collection("questions").createIndex({ subject: 1, topic: 1, difficulty: 1 }),

    // ── User indexes for admin search & filtering ──
    db.collection("users").createIndex({ email: 1 }),
    db.collection("users").createIndex({ role: 1, status: 1 }),
    db.collection("users").createIndex({ createdAt: -1 }),
    db.collection("users").createIndex(
      { name: "text", email: "text" },
      { name: "users_text_search" }
    ),
    db.collection("users").createIndex({
      "dailyPracticeReminder.enabled": 1,
      "dailyPracticeReminder.nextSendAt": 1,
    }),
    db.collection("users").createIndex({
      "dailyPracticeReminder.streakProtectionEnabled": 1,
      "dailyPracticeReminder.nextStreakProtectionAt": 1,
    }),

    // ── Audit log indexes ──
    db.collection("auditLog").createIndex({ targetUserId: 1 }),
    db.collection("auditLog").createIndex({ adminId: 1 }),
    db.collection("auditLog").createIndex({ createdAt: -1 }),

    // ── Push notification device indexes ──
    db.collection("pushDevices").createIndex({ fid: 1 }, { unique: true }),
    db.collection("pushDevices").createIndex({ userId: 1, enabled: 1 }),
    db.collection("pushDevices").createIndex({ enabled: 1, platform: 1, userId: 1 }),
    db.collection("pushDevices").createIndex({ updatedAt: -1 }),

    // ── Notification history indexes ──
    db.collection("notificationHistory").createIndex({
      createdAt: -1,
    }),
    db.collection("notificationHistory").createIndex({
      sentByUserId: 1,
      createdAt: -1,
    }),

    // ── Scheduled notifications indexes ──
    db.collection("scheduledNotifications").createIndex({
      status: 1,
      sendAt: 1,
    }),

    // ── Battle room indexes ──
    db.collection("battleRooms").createIndex(
      { code: 1 },
      { unique: true }
    ),
    db.collection("battleRooms").createIndex({
      "players.userId": 1,
    }),
    db.collection("battleRooms").createIndex({
      "players.socketId": 1,
    }),
    db.collection("battleRooms").createIndex({
      status: 1,
      updatedAt: -1,
    }),
    db.collection("battleRooms").createIndex({
      status: 1,
      "players.reconnectDeadline": 1,
    }),
    db.collection("battleRooms").createIndex({
      status: 1,
      questionDeadline: 1,
    }),
    db.collection("battleRooms").createIndex({
      status: 1,
      resultRecordedAt: 1,
      finishedAt: 1,
    }),
    db.collection("battleRooms").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    ),
    db.collection("battleRooms").createIndex({ matchmakingId: 1 }, { unique: true, sparse: true }),
    db.collection("battleMatchmakingQueue").createIndex({ userId: 1 }, { unique: true }),
    db.collection("battleMatchmakingQueue").createIndex({ status: 1, subject: 1, topic: 1, questionCount: 1, rating: 1, queuedAt: 1 }),
    db.collection("battleMatchmakingQueue").createIndex({ status: 1, queuedAt: 1 }),
    db.collection("battleMatchmakingQueue").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

    // ── Socket.IO distributed adapter ──
    db.collection("socketIoAdapterEvents").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 3600 }
    ),
    db.collection("battleMatches").createIndex({ roomCode: 1 }, { unique: true }),
    db.collection("battleMatches").createIndex({ "players.userId": 1, finishedAt: -1 }),
    db.collection("battleMatches").createIndex({ finishedAt: -1 }),
    db.collection("battleMatches").createIndex({ finishedAt: -1, origin: 1 }),
    db.collection("battleMatches").createIndex({ seasonKey: 1, finishedAt: -1 }),
    db.collection("battleMatches").createIndex({ finishReason: 1, finishedAt: -1 }),
    db.collection("battleMatches").createIndex({ rematchOfRoomCode: 1 }),
    db.collection("battleProfiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("battleProfiles").createIndex({ rating: -1, wins: -1 }),
    db.collection("battleProfiles").createIndex({ gamesPlayed: -1 }),

    // ── Battle seasons ──
    db.collection("battleSeasons").createIndex({ key: 1 }, { unique: true }),
    db.collection("battleSeasons").createIndex({ status: 1, startsAt: 1, endsAt: 1 }),
    db.collection("battleSeasonProfiles").createIndex({ seasonKey: 1, userId: 1 }, { unique: true }),
    db.collection("battleSeasonProfiles").createIndex({ seasonKey: 1, rating: -1, wins: -1, gamesPlayed: -1 }),
    db.collection("battleSeasonRewards").createIndex({ seasonKey: 1, userId: 1 }, { unique: true }),
    db.collection("battleSeasonRewards").createIndex({ userId: 1, seasonKey: -1 }),
    db.collection("battleIntegrityEvents").createIndex({ dedupeKey: 1 }, { unique: true }),
    db.collection("battleIntegrityEvents").createIndex({ status: 1, severity: 1, lastSeenAt: -1 }),
    db.collection("battleIntegrityEvents").createIndex({ userId: 1, lastSeenAt: -1 }),
    db.collection("battleIntegrityEvents").createIndex({ roomCode: 1 }),
    db.collection("battleIntegrityEvents").createIndex({ opponentUserId: 1, lastSeenAt: -1 }),
    db.collection("battleAchievements").createIndex({ userId: 1, achievementCode: 1 }, { unique: true }),
    db.collection("battleAchievements").createIndex({ userId: 1, unlockedAt: -1 }),
    db.collection("battleFriendships").createIndex({ pairKey: 1 }, { unique: true }),
    db.collection("battleFriendships").createIndex({ users: 1, status: 1 }),
    db.collection("battleFriendships").createIndex({ requestedToUserId: 1, status: 1, createdAt: -1 }),
    db.collection("battleFavorites").createIndex({ userId: 1, targetUserId: 1 }, { unique: true }),
    db.collection("battleFavorites").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("battleProgressionProfiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("battleSeasonProgress").createIndex({ seasonKey: 1, userId: 1 }, { unique: true }),
    db.collection("battleSeasonProgress").createIndex({ seasonKey: 1, xp: -1 }),
    db.collection("battleMissionProgress").createIndex({ userId: 1, missionCode: 1, periodKey: 1 }, { unique: true }),
    db.collection("battleMissionProgress").createIndex({ userId: 1, periodType: 1, periodKey: 1 }),
    db.collection("battleProgressEvents").createIndex({ roomCode: 1, userId: 1 }, { unique: true }),
    db.collection("battleSeasonRewardClaims").createIndex({ seasonKey: 1, userId: 1, milestoneLevel: 1 }, { unique: true }),
    db.collection("battleSeasonRewardClaims").createIndex({ userId: 1, claimedAt: -1 }),
    db.collection("battleCosmeticInventory").createIndex({ userId: 1, cosmeticCode: 1 }, { unique: true }),
    db.collection("battleCosmeticInventory").createIndex({ userId: 1, type: 1, unlockedAt: -1 }),

    // ── Notification worker-health indexes ──
    db.collection("notificationWorkerHealth").createIndex(
      {
        workerName: 1,
        instanceId: 1,
      },
      {
        unique: true,
      }
    ),
    db.collection("notificationWorkerHealth").createIndex({
      updatedAt: -1,
    }),
    db.collection("notificationWorkerHealth").createIndex(
      {
        expiresAt: 1,
      },
      {
        expireAfterSeconds: 0,
      }
    ),

    // ── Study activity daily indexes ──
    db.collection("studyActivityDaily").createIndex(
      {
        userId: 1,
        dateKey: 1,
      },
      {
        unique: true,
      }
    ),
    db.collection("studyActivityDaily").createIndex({
      userId: 1,
      dateKey: -1,
    }),

    // ── Exam updates indexes ──
    db.collection("examUpdates").createIndex(
      { updateKey: 1 },
      { unique: true }
    ),
    db.collection("examUpdates").createIndex({
      publishedAt: -1,
    }),

    // ── Notification feed indexes ──
    db.collection("notificationFeed").createIndex({
      audience: 1,
      userId: 1,
      createdAt: -1,
    }),
    db.collection("notificationFeed").createIndex({
      audience: 1,
      createdAt: -1,
    }),
    db.collection("notificationFeed").createIndex(
      { dedupeKey: 1 },
      {
        unique: true,
        sparse: true,
      }
    ),
    db.collection("notificationFeed").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    ),

    // ── Notification receipts indexes ──
    db.collection("notificationReceipts").createIndex(
      {
        userId: 1,
        notificationId: 1,
      },
      {
        unique: true,
      }
    ),

    // ── Notification engagement indexes ──
    db.collection("notificationEngagement").createIndex(
      {
        userId: 1,
        notificationId: 1,
        event: 1,
        source: 1,
      },
      {
        unique: true,
      }
    ),
    db.collection("notificationEngagement").createIndex({
      notificationId: 1,
      createdAt: -1,
    }),
    db.collection("notificationEngagement").createIndex({
      createdAt: -1,
    }),
    db.collection("notificationEngagement").createIndex(
      {
        expiresAt: 1,
      },
      {
        expireAfterSeconds: 0,
      }
    ),
  ]);

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
