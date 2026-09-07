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
