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
const count = Math.max(1, Math.min(20, Number(process.env.STAGING_PROBE_COUNT || 1)));
if (!Number.isInteger(count)) throw new Error('STAGING_PROBE_COUNT must be an integer');
if (!/staging/i.test(dbName)) throw new Error('Refusing synthetic-user mutation outside a staging database');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
const emailFor = (index) => `${prefix}-${index}@staging.invalid`;
const idFor = (index) => `staging-probe-${prefix}-${index}`;

async function cleanup(db) {
  const ids = Array.from({ length: count }, (_, i) => idFor(i + 1));
  const emails = Array.from({ length: count }, (_, i) => emailFor(i + 1));
  const userIdCollections = [
    'authSessions',
    'trainingSessions',
    'trainingReviewState',
    'trainingQuestionExposure',
    'trainingSkillState',
    'trainingLearnerStateMeta',
    'userSkillProfile',
  ];
  await Promise.all(userIdCollections.map((name) => db.collection(name).deleteMany({ userId: { $in: ids } })));
  await db.collection('users').deleteMany({ $or: [{ id: { $in: ids } }, { email: { $in: emails } }] });
}

try {
  await client.connect();
  const db = client.db(dbName);
  await cleanup(db);

  if (action === 'create') {
    const password = required('STAGING_PROBE_PASSWORD');
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const users = Array.from({ length: count }, (_, i) => ({
      id: idFor(i + 1),
      name: `Staging Probe ${i + 1}`,
      email: emailFor(i + 1),
      role: 'student',
      authProvider: 'local',
      passwordHash,
      progress: {},
      bookmarks: [],
      bookmarkEntries: [],
      recentQuizzes: [],
      createdAt: now,
    }));
    await db.collection('users').insertMany(users);
    console.log(JSON.stringify({ action, count, prefix, emails: users.map((user) => user.email) }));
  } else {
    console.log(JSON.stringify({ action, count, prefix }));
  }
} finally {
  await client.close();
}
