import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
};

const action = process.argv[2];
if (!['create', 'cleanup'].includes(action)) throw new Error('Usage: node manage-training-staging-users.js <create|cleanup>');

const uri = required('STAGING_MONGODB_URI');
const dbName = process.env.STAGING_MONGODB_DB?.trim() || 'quizDB_staging';
const prefix = required('STAGING_PROBE_PREFIX').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
const count = Number(process.env.STAGING_PROBE_COUNT || 1);
if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('STAGING_PROBE_COUNT must be an integer from 1 to 100');
if (!/staging/i.test(dbName)) throw new Error('Refusing synthetic-user mutation outside a staging database');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const emailFor = (index) => `${prefix}-${index}@staging.invalid`;
const idFor = (index) => `staging-probe-${prefix}-${index}`;

async function cleanup(db) {
  const ids = Array.from({ length: count }, (_, i) => idFor(i + 1));
  const emails = Array.from({ length: count }, (_, i) => emailFor(i + 1).toLowerCase());
  const sessionDocs = await db
    .collection('quizSessions')
    .find({ userId: { $in: ids } }, { projection: { sessionId: 1, userId: 1, answers: 1 } })
    .toArray();
  const idempIds = [];
  for (const doc of sessionDocs) {
    if (!doc?.userId || !doc?.sessionId || !doc?.answers || typeof doc.answers !== 'object') continue;
    for (const entry of Object.values(doc.answers)) {
      if (!entry?.submissionId) continue;
      idempIds.push(
        createHash('sha256')
          .update(`${doc.userId}:v1.quiz.session.answer:${doc.sessionId}:${entry.submissionId}`)
          .digest('hex'),
      );
    }
  }
  if (idempIds.length > 0) {
    await db.collection('idempotencyRecords').deleteMany({
      $or: [{ _id: { $in: [...new Set(idempIds)] } }, { userId: { $in: ids } }],
    });
  } else {
    await db.collection('idempotencyRecords').deleteMany({ userId: { $in: ids } });
  }
  const userIdCollections = [
    'authSessions',
    'quizSessions',
    'trainingSessions',
    'trainingReviewState',
    'trainingQuestionExposure',
    'trainingSkillState',
    'trainingLearnerStateMeta',
    'userSkillProfile',
    'userQuestionProgress',
    'userTopicProgress',
    'userAnalytics',
    'studyActivityDaily',
    'userBookmarks',
    'userQuizHistory',
  ];
  await Promise.all(userIdCollections.map((name) => db.collection(name).deleteMany({ userId: { $in: ids } })));
  await db.collection('users').deleteMany({
    $or: [{ id: { $in: ids } }, { email: { $in: emails } }, { emailNormalized: { $in: emails } }],
  });
}

try {
  await client.connect();
  const db = client.db(dbName);
  await cleanup(db);

  if (action === 'create') {
    const password = required('STAGING_PROBE_PASSWORD');
    const passwordHash = await bcrypt.hash(password, 12);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const users = Array.from({ length: count }, (_, i) => {
      const email = emailFor(i + 1).toLowerCase();
      return {
        id: idFor(i + 1),
        name: `Staging Probe ${i + 1}`,
        email,
        emailNormalized: email,
        accountRecord: true,
        historyStorageVersion: 1,
        emailVerified: true,
        emailVerifiedAt: nowDate,
        role: 'student',
        authProvider: 'local',
        passwordHash,
        progress: {},
        bookmarks: [],
        bookmarkEntries: [],
        recentQuizzes: [],
        studyTime: 0,
        dailyGoalMinutes: 60,
        createdAt: now,
      };
    });
    await db.collection('users').insertMany(users);
    console.log(JSON.stringify({ action, count, prefix, emails: users.map((user) => user.email) }));
  } else {
    console.log(JSON.stringify({ action, count, prefix }));
  }
} finally {
  await client.close();
}
