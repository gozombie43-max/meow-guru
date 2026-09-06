import { MongoClient } from "mongodb";

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

    // ── Audit log indexes ──
    db.collection("auditLog").createIndex({ targetUserId: 1 }),
    db.collection("auditLog").createIndex({ adminId: 1 }),
    db.collection("auditLog").createIndex({ createdAt: -1 }),
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
