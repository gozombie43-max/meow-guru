import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

// ============================================================================
// Meow k6 Staging & Local Synthetic Test-Data Manager
// ============================================================================
// Commands: setup | seed | cleanup | status
// Never logs MongoDB URIs, passwords, or password hashes.

const PRODUCTION_ENV_PATTERN = /(?:^|[._-])prod(?:uction)?(?:$|[._-])|^prod(?:uction)?$/i;
const PRODUCTION_DB_PATTERN = /(?:^|[._-])prod(?:uction)?(?:$|[._-])|\bprod(?:uction)?\b/i;
const PRODUCTION_HOST_PATTERN = /(?:^|[._-])prod(?:uction)?(?:$|[._-])|\bprod(?:uction)?\b/i;

const USER_SCOPED_COLLECTIONS = [
  'authSessions',
  'quizSessions',
  'userQuestionProgress',
  'userTopicProgress',
  'userAnalytics',
  'studyActivityDaily',
  'userQuizHistory',
  'aiConversations',
  'userBookmarks',
  'aiMessages',
];

const QUESTION_SPECS = [
  { subject: 'mathematics', topic: 'percentages', chapter: 'Percentages', concept: 'Percentage Change' },
  { subject: 'mathematics', topic: 'percentages', chapter: 'Percentages', concept: 'Successive Percentage' },
  { subject: 'mathematics', topic: 'percentages', chapter: 'Percentages', concept: 'Population & Value' },
  { subject: 'mathematics', topic: 'ratio-and-proportion', chapter: 'Ratio & Proportion', concept: 'Compound Ratio' },
  { subject: 'mathematics', topic: 'profit-and-loss', chapter: 'Profit & Loss', concept: 'Marked Price & Discount' },
  { subject: 'mathematics', topic: 'algebra', chapter: 'Algebra', concept: 'Linear & Quadratic Identities' },
  { subject: 'mathematics', topic: 'geometry', chapter: 'Geometry', concept: 'Triangles & Circles' },
  { subject: 'mathematics', topic: 'percentages', chapter: 'Percentages', concept: 'Income & Expenditure' },
  { subject: 'reasoning', topic: 'coding-decoding', chapter: 'Coding Decoding', concept: 'Letter Shift' },
  { subject: 'english', topic: 'synonyms-antonyms', chapter: 'Vocabulary', concept: 'Contextual Synonyms' },
  { subject: 'general-awareness', topic: 'polity', chapter: 'Indian Polity', concept: 'Fundamental Rights' },
];

export function stripMongoUriCredentials(uri) {
  return String(uri || '')
    .trim()
    .replace(/^(mongodb(?:\+srv)?:\/\/)([^/@]+)@/i, '$1***@');
}

function parseMongoUriHosts(uri) {
  const raw = String(uri || '').trim();
  const match = /^(mongodb(?:\+srv)?):\/\/([^/?#]+)/i.exec(raw);
  if (!match) {
    throw new Error(`Invalid MongoDB URI "${stripMongoUriCredentials(raw)}"`);
  }
  const scheme = match[1].toLowerCase();
  let authority = match[2];
  const atIdx = authority.lastIndexOf('@');
  if (atIdx !== -1) {
    authority = authority.slice(atIdx + 1);
  }
  if (!authority) {
    throw new Error(`MongoDB URI "${stripMongoUriCredentials(raw)}" is missing host`);
  }

  const hosts = authority
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      if (entry.startsWith('[')) {
        const end = entry.indexOf(']');
        return (end !== -1 ? entry.slice(0, end + 1) : entry).toLowerCase();
      }
      const colonIdx = entry.indexOf(':');
      return (colonIdx !== -1 ? entry.slice(0, colonIdx) : entry).toLowerCase();
    });

  if (hosts.length === 0) {
    throw new Error(`MongoDB URI "${stripMongoUriCredentials(raw)}" contains no hosts`);
  }

  return { scheme, hosts };
}

function isLoopbackHost(host) {
  const h = String(host || '').trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

export function assertSafeDatabaseTarget({
  envName = 'local',
  uri,
  dbName,
  allowStaging = false,
  expectedHost = '',
} = {}) {
  const normalizedEnv = String(envName || 'local').trim().toLowerCase();
  if (PRODUCTION_ENV_PATTERN.test(normalizedEnv) || /prod/i.test(normalizedEnv)) {
    throw new Error(`Refusing synthetic data operation in production environment ("${normalizedEnv}").`);
  }
  if (normalizedEnv !== 'local' && normalizedEnv !== 'staging') {
    throw new Error(`Unsupported target environment "${normalizedEnv}". Expected "local" or "staging".`);
  }

  if (!uri || !String(uri).trim()) {
    throw new Error(`Missing MongoDB URI for "${normalizedEnv}" environment.`);
  }
  const cleanDbName = String(dbName || '').trim();
  if (!cleanDbName) {
    throw new Error(`Missing MongoDB database name for "${normalizedEnv}" environment.`);
  }

  if (PRODUCTION_DB_PATTERN.test(cleanDbName)) {
    throw new Error(`Refusing production-named database "${cleanDbName}".`);
  }

  const { scheme, hosts } = parseMongoUriHosts(uri);
  for (const host of hosts) {
    if (PRODUCTION_HOST_PATTERN.test(host)) {
      throw new Error(`Refusing production-looking MongoDB host "${host}".`);
    }
  }

  if (normalizedEnv === 'local') {
    if (scheme !== 'mongodb') {
      throw new Error(`Local environment requires standard mongodb:// URI (refusing "${scheme}://").`);
    }
    if (!hosts.every(isLoopbackHost)) {
      throw new Error(
        `Local environment only permits loopback hosts (localhost, 127.0.0.1, ::1); got "${hosts.join(', ')}".`,
      );
    }
    return {
      envName: 'local',
      scheme,
      hosts,
      dbName: cleanDbName,
    };
  }

  // normalizedEnv === 'staging'
  if (!allowStaging) {
    throw new Error(
      'Staging database mutation requires explicit approval (--allow-staging or K6_ALLOW_STAGING=true).',
    );
  }
  if (cleanDbName === 'quizDB' || !/staging/i.test(cleanDbName)) {
    throw new Error(
      `Staging environment requires a staging database name containing "staging" (refusing "${cleanDbName}").`,
    );
  }
  const cleanExpectedHost = String(expectedHost || '').trim().toLowerCase();
  if (cleanExpectedHost && !hosts.includes(cleanExpectedHost)) {
    throw new Error(
      `MongoDB host(s) "${hosts.join(', ')}" do not match STAGING_MONGODB_EXPECTED_HOST "${cleanExpectedHost}".`,
    );
  }

  return {
    envName: 'staging',
    scheme,
    hosts,
    dbName: cleanDbName,
  };
}

// ============================================================================
// Pure Question & User Document Builders (aligned with backend schemas)
// ============================================================================
export function normalizeFilterKey(value) {
  if (value === undefined || value === null || typeof value === 'object') return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeSearchKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function deriveModeKey(question) {
  if (!question || typeof question !== 'object') return 'concept';
  const quizTag = normalizeSearchKey(question.quizName || question.quizId || question.source);
  const normalizedTopic = normalizeSearchKey(question.topic);
  const questionType = String(question.questionType || '').trim().toLowerCase();
  const quizName = String(question.quizName || '').trim().toLowerCase();
  const hasWord = !!(question.word && String(question.word).trim());
  const hasLetter = !!(question.letter && String(question.letter).trim());
  const hasMeanings = Array.isArray(question.meanings);

  if (
    questionType === 'study-mode' ||
    questionType === 'studymode' ||
    quizName === 'study mode' ||
    (hasWord && hasMeanings)
  ) {
    return 'studyMode';
  }
  if (
    ['careerwill', 'patternbank', 'formula', 'formulabank', 'vocabularybank', 'factbank', 'antosynopyq'].includes(
      quizTag,
    ) ||
    normalizedTopic === 'antosynopyq' ||
    hasLetter ||
    hasWord
  ) {
    return 'formula';
  }
  if (['selectionway', 'aichallenge'].includes(quizTag)) return 'aiChallenge';
  if (['tier2', 'tier2hard'].includes(quizTag)) return 'hard';
  if (quizTag === 'topicmix') return 'easy';
  if (['pw', 'mixedpractice', 'mixedpw'].includes(quizTag)) return 'mixed';
  return 'concept';
}

export function buildNormalizedQuestionFields(question) {
  const q = question && typeof question === 'object' ? question : {};
  const seed =
    q.questionUid ||
    q.ingestionKey ||
    (q._id !== undefined && q._id !== null ? String(q._id) : '') ||
    (q.id !== undefined && q.id !== null ? String(q.id) : '');
  const selectionKey = createHash('sha256').update(`selection:v1:${seed}`).digest('hex').slice(0, 16);

  const rawShift = String(q.shift || '').trim().toLowerCase().replace(/^shift\s*[-:]?\s*/, '');
  const shiftInt = /^(?:[1-9]|10)$/.test(rawShift) ? Number.parseInt(rawShift, 10) : null;
  const yearInt = Number.isInteger(q.year) && q.year >= 1900 && q.year <= 2100 ? q.year : null;

  const isJam = ['subject', 'quizSubject', 'topic', 'quizTopic', 'exam', 'subjectId', 'topicId'].some((f) =>
    /^iit[-_\s]*jam(?:[-_\s]|$)/i.test(String(q[f] || '').trim()),
  );

  return {
    topicKey: normalizeSearchKey(q.topic),
    subjectKey: normalizeSearchKey(q.subject || q.quizSubject),
    quizKey: normalizeSearchKey(q.quizName || q.quizId || q.source),
    modeKey: deriveModeKey(q),
    keyVersion: 1,
    examKey: normalizeFilterKey(q.exam),
    conceptKey: normalizeFilterKey(q.concept),
    chapterKey: normalizeFilterKey(q.chapter || q.chapterSlug),
    topicGroupKey: normalizeFilterKey(q.topicGroup),
    examModeKey: isJam ? 'iit-jam' : 'ssc',
    yearInt,
    shiftInt,
    selectionKey,
  };
}

export function buildSyntheticUserDoc({ index, prefix = 'k6-load', passwordHash, now = new Date() }) {
  const cleanPrefix = String(prefix || 'k6-load').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const id = `${cleanPrefix}-${index}`;
  const email = `${id}@loadtest.invalid`.toLowerCase();

  return {
    id,
    name: `K6 Load User ${index}`,
    email,
    emailNormalized: email,
    accountRecord: true,
    historyStorageVersion: 1,
    emailVerified: true,
    emailVerifiedAt: now,
    role: 'student',
    authProvider: 'local',
    passwordHash,
    progress: {},
    bookmarks: [],
    bookmarkEntries: [],
    recentQuizzes: [],
    studyTime: 0,
    dailyGoalMinutes: 60,
    k6Synthetic: true,
    k6Prefix: cleanPrefix,
    createdAt: now.toISOString(),
  };
}

export function buildSyntheticQuestionDoc({ index, prefix = 'k6-load', spec, now = new Date() }) {
  const cleanPrefix = String(prefix || 'k6-load').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const resolvedSpec = spec || QUESTION_SPECS[index % QUESTION_SPECS.length];
  const _id = new ObjectId();
  const questionUid = `q_${createHash('sha256')
    .update(`k6:${cleanPrefix}:${index}:${String(_id)}`)
    .digest('hex')
    .slice(0, 32)}`;

  const quizName = index % 5 === 0 ? 'AI Challenge' : 'Concept Practice';
  const options = [
    `Option A (${index})`,
    `Option B (${index})`,
    `Option C (${index})`,
    `Option D (${index})`,
  ];
  const correctIdx = index % 4;
  const questionText = `[K6 Synthetic #${index}] (${resolvedSpec.topic}) Load-test standardized question ${index}.`;
  const solutionText = `Synthetic solution for ${questionUid}: Option ${['A', 'B', 'C', 'D'][correctIdx]}.`;

  const baseDoc = {
    _id,
    id: questionUid,
    questionUid,
    exam: 'SSC CGL',
    tier: index % 3 === 0 ? 'Tier 2' : 'Tier 1',
    subject: resolvedSpec.subject,
    topic: resolvedSpec.topic,
    chapter: resolvedSpec.chapter,
    concept: resolvedSpec.concept,
    quizName,
    questionType: 'MCQ',
    difficulty: ['easy', 'medium', 'hard'][index % 3],
    year: 2024,
    shift: `Shift ${(index % 4) + 1}`,
    examDate: '2024-09-12',
    question: questionText,
    options,
    correctAnswer: options[correctIdx],
    correctLetter: ['A', 'B', 'C', 'D'][correctIdx],
    solution: solutionText,
    explanation: solutionText,
    translations: {
      en: {
        question: questionText,
        options,
        solution: solutionText,
      },
    },
    k6Synthetic: true,
    k6Prefix: cleanPrefix,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...baseDoc,
    ...buildNormalizedQuestionFields(baseDoc),
  };
}

export function computeAnswerIdempotencyIds(sessionDocs = []) {
  const ids = [];
  for (const doc of sessionDocs) {
    if (!doc?.userId || !doc?.sessionId || !doc?.answers || typeof doc.answers !== 'object') continue;
    for (const entry of Object.values(doc.answers)) {
      if (!entry?.submissionId) continue;
      const hash = createHash('sha256')
        .update(`${doc.userId}:v1.quiz.session.answer:${doc.sessionId}:${entry.submissionId}`)
        .digest('hex');
      ids.push(hash);
    }
  }
  return Array.from(new Set(ids));
}

export async function advanceQuestionBankRevision(db) {
  await db.collection('questionMetadata').updateOne(
    { _id: 'revision' },
    { $inc: { revision: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true },
  );
}

// ============================================================================
// Core Database Operations (setup / seed / cleanup / status)
// ============================================================================
function buildUserTargets(prefix, count) {
  const cleanPrefix = String(prefix || 'k6-load').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const ids = [];
  const emails = [];
  for (let i = 1; i <= count; i++) {
    const id = `${cleanPrefix}-${i}`;
    ids.push(id);
    emails.push(`${id}@loadtest.invalid`);
  }
  return { cleanPrefix, ids, emails };
}

export async function runCleanup(db, options = {}) {
  const { prefix = 'k6-load', count = 200, includeQuestions = false } = options;
  const { cleanPrefix, ids, emails } = buildUserTargets(prefix, Math.max(count, 200));

  const existingUsers = await db
    .collection('users')
    .find(
      {
        $or: [
          { k6Synthetic: true, k6Prefix: cleanPrefix },
          { id: { $in: ids } },
          { emailNormalized: { $in: emails } },
          { email: { $in: emails } },
        ],
      },
      { projection: { id: 1, email: 1, emailNormalized: 1 } },
    )
    .toArray();

  const allIds = Array.from(new Set([...ids, ...existingUsers.map((u) => u.id).filter(Boolean)]));
  const allEmails = Array.from(
    new Set([
      ...emails,
      ...existingUsers.map((u) => u.emailNormalized || u.email).filter(Boolean),
    ]),
  );

  // Compute exact idempotencyRecords _ids from quizSessions before deleting quizSessions.
  const sessionDocs = await db
    .collection('quizSessions')
    .find(
      { userId: { $in: allIds } },
      { projection: { sessionId: 1, userId: 1, answers: 1 } },
    )
    .toArray();
  const computedIdempIds = computeAnswerIdempotencyIds(sessionDocs);

  let idempotencyDeleted = 0;
  if (computedIdempIds.length > 0) {
    const idempRes = await db.collection('idempotencyRecords').deleteMany({
      $or: [{ _id: { $in: computedIdempIds } }, { userId: { $in: allIds } }],
    });
    idempotencyDeleted = idempRes.deletedCount || 0;
  } else {
    const idempRes = await db.collection('idempotencyRecords').deleteMany({
      userId: { $in: allIds },
    });
    idempotencyDeleted = idempRes.deletedCount || 0;
  }

  const deletedCounts = { idempotencyRecords: idempotencyDeleted };
  for (const colName of USER_SCOPED_COLLECTIONS) {
    const res = await db.collection(colName).deleteMany({ userId: { $in: allIds } });
    deletedCounts[colName] = res.deletedCount || 0;
  }

  const usersRes = await db.collection('users').deleteMany({
    $or: [
      { id: { $in: allIds } },
      { emailNormalized: { $in: allEmails } },
      { email: { $in: allEmails } },
      { k6Synthetic: true, k6Prefix: cleanPrefix },
    ],
  });
  deletedCounts.users = usersRes.deletedCount || 0;

  let questionsDeleted = 0;
  if (includeQuestions) {
    const qRes = await db.collection('questions').deleteMany({
      k6Synthetic: true,
      k6Prefix: cleanPrefix,
    });
    questionsDeleted = qRes.deletedCount || 0;
    if (questionsDeleted > 0) {
      await advanceQuestionBankRevision(db);
    }
  }
  deletedCounts.questions = questionsDeleted;

  return {
    command: 'cleanup',
    prefix: cleanPrefix,
    deleted: deletedCounts,
  };
}

export async function runSeed(db, options = {}) {
  const {
    prefix = 'k6-load',
    count = 10,
    password,
    minQuestions = 0,
    seedQuestions = false,
    questionCount = 100,
    bcryptCost = 10,
  } = options;

  if (!password || String(password).length < 6) {
    throw new Error('Password (min 6 chars) is required for setup/seed via --password or K6_USER_PASSWORD.');
  }

  const cleanPrefix = String(prefix || 'k6-load').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const safeCount = Math.max(1, Math.min(200, Number(count) || 10));
  const now = new Date();
  const passwordHash = await bcrypt.hash(String(password), bcryptCost);

  const userDocs = [];
  for (let i = 1; i <= safeCount; i++) {
    userDocs.push(buildSyntheticUserDoc({ index: i, prefix: cleanPrefix, passwordHash, now }));
  }

  const bulkOps = userDocs.map((doc) => ({
    replaceOne: {
      filter: { id: doc.id },
      replacement: doc,
      upsert: true,
    },
  }));
  await db.collection('users').bulkWrite(bulkOps, { ordered: false });

  const existingQuestionCount = await db.collection('questions').countDocuments({});
  let questionsSeeded = 0;
  const shouldSeedQuestions =
    seedQuestions || (minQuestions > 0 && existingQuestionCount < minQuestions);

  if (shouldSeedQuestions && questionCount > 0) {
    const toInsert = [];
    for (let i = 1; i <= questionCount; i++) {
      // Ensure ~70% mathematics questions (including percentages) so practice/mock slices have >40 items
      const spec =
        i % 10 < 7
          ? QUESTION_SPECS[i % 8]
          : QUESTION_SPECS[8 + (i % (QUESTION_SPECS.length - 8))];
      toInsert.push(buildSyntheticQuestionDoc({ index: i, prefix: cleanPrefix, spec, now }));
    }
    await db.collection('questions').insertMany(toInsert, { ordered: false });
    questionsSeeded = toInsert.length;
    await advanceQuestionBankRevision(db);
  }

  const totalQuestions = await db.collection('questions').countDocuments({});

  return {
    command: 'seed',
    prefix: cleanPrefix,
    usersUpserted: userDocs.length,
    sampleEmails: userDocs.slice(0, 3).map((u) => u.email),
    questionsSeeded,
    totalQuestions,
  };
}

export async function runSetup(db, options = {}) {
  const cleanupResult = await runCleanup(db, {
    prefix: options.prefix,
    count: Math.max(options.count || 10, 200),
    includeQuestions: Boolean(options.resetQuestions),
  });
  const seedResult = await runSeed(db, options);
  return {
    command: 'setup',
    prefix: seedResult.prefix,
    cleanedBeforeSetup: cleanupResult.deleted,
    usersCreated: seedResult.usersUpserted,
    sampleEmails: seedResult.sampleEmails,
    questionsSeeded: seedResult.questionsSeeded,
    totalQuestions: seedResult.totalQuestions,
  };
}

export async function runStatus(db, options = {}) {
  const { prefix = 'k6-load' } = options;
  const cleanPrefix = String(prefix || 'k6-load').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const users = await db
    .collection('users')
    .find({ k6Synthetic: true, k6Prefix: cleanPrefix }, { projection: { id: 1, email: 1 } })
    .toArray();
  const ids = users.map((u) => u.id).filter(Boolean);

  const [
    authSessions,
    quizSessions,
    userQuestionProgress,
    userTopicProgress,
    userAnalytics,
    studyActivityDaily,
    totalQuestions,
    syntheticQuestions,
  ] = await Promise.all([
    ids.length ? db.collection('authSessions').countDocuments({ userId: { $in: ids } }) : 0,
    ids.length ? db.collection('quizSessions').countDocuments({ userId: { $in: ids } }) : 0,
    ids.length ? db.collection('userQuestionProgress').countDocuments({ userId: { $in: ids } }) : 0,
    ids.length ? db.collection('userTopicProgress').countDocuments({ userId: { $in: ids } }) : 0,
    ids.length ? db.collection('userAnalytics').countDocuments({ userId: { $in: ids } }) : 0,
    ids.length ? db.collection('studyActivityDaily').countDocuments({ userId: { $in: ids } }) : 0,
    db.collection('questions').countDocuments({}),
    db.collection('questions').countDocuments({ k6Synthetic: true, k6Prefix: cleanPrefix }),
  ]);

  return {
    command: 'status',
    prefix: cleanPrefix,
    syntheticUsers: users.length,
    sampleEmails: users.slice(0, 3).map((u) => u.email),
    collections: {
      authSessions,
      quizSessions,
      userQuestionProgress,
      userTopicProgress,
      userAnalytics,
      studyActivityDaily,
    },
    questions: {
      total: totalQuestions,
      syntheticForPrefix: syntheticQuestions,
    },
  };
}

// ============================================================================
// CLI Argument & Env Parsing
// ============================================================================
export function parseCliArgs(argv = []) {
  const args = Array.isArray(argv) ? argv : [];
  const flags = {
    command: 'status',
    env: null,
    allowStaging: false,
    uri: null,
    db: null,
    expectedHost: null,
    prefix: null,
    count: null,
    password: null,
    questions: null,
    seedQuestions: false,
    skipQuestions: false,
    includeQuestions: false,
    resetQuestions: false,
    json: false,
  };

  let positionalSet = false;
  for (let i = 0; i < args.length; i++) {
    const arg = String(args[i]);
    if (!arg.startsWith('--') && !positionalSet) {
      flags.command = arg.toLowerCase();
      positionalSet = true;
      continue;
    }

    const eqIdx = arg.indexOf('=');
    const key = eqIdx !== -1 ? arg.slice(0, eqIdx) : arg;
    const inlineVal = eqIdx !== -1 ? arg.slice(eqIdx + 1) : null;
    const nextVal = () => {
      if (inlineVal !== null) return inlineVal;
      i += 1;
      return args[i];
    };

    switch (key) {
      case '--env':
        flags.env = nextVal();
        break;
      case '--allow-staging':
        flags.allowStaging = true;
        break;
      case '--uri':
        flags.uri = nextVal();
        break;
      case '--db':
        flags.db = nextVal();
        break;
      case '--expected-host':
        flags.expectedHost = nextVal();
        break;
      case '--prefix':
        flags.prefix = nextVal();
        break;
      case '--count':
        flags.count = Number.parseInt(String(nextVal()), 10);
        break;
      case '--password':
        flags.password = nextVal();
        break;
      case '--questions':
        flags.questions = Number.parseInt(String(nextVal()), 10);
        break;
      case '--seed-questions':
        flags.seedQuestions = true;
        break;
      case '--skip-questions':
        flags.skipQuestions = true;
        break;
      case '--include-questions':
        flags.includeQuestions = true;
        break;
      case '--reset-questions':
        flags.resetQuestions = true;
        break;
      case '--json':
        flags.json = true;
        break;
      default:
        throw new Error(`Unknown CLI flag "${key}"`);
    }
  }

  if (!['setup', 'seed', 'cleanup', 'status'].includes(flags.command)) {
    throw new Error(`Unknown command "${flags.command}". Expected setup | seed | cleanup | status.`);
  }

  return flags;
}

function maybeLoadLocalDotenv(envName) {
  if (envName !== 'local') return;
  if (process.env.K6_MONGODB_URI || process.env.MONGODB_URI) return;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'backend', '.env'),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: false, quiet: true });
      break;
    }
  }
}

async function main() {
  const flags = parseCliArgs(process.argv.slice(2));
  const envName = String(flags.env || process.env.K6_ENV || process.env.ENVIRONMENT || 'local')
    .trim()
    .toLowerCase();

  // Never auto-load .env in staging mode.
  maybeLoadLocalDotenv(envName);

  const allowStaging =
    flags.allowStaging ||
    String(process.env.K6_ALLOW_STAGING || process.env.ALLOW_STAGING || '').trim().toLowerCase() === 'true';

  const uri =
    flags.uri ||
    (envName === 'staging'
      ? process.env.K6_MONGODB_URI || process.env.STAGING_MONGODB_URI
      : process.env.K6_MONGODB_URI || process.env.MONGODB_URI);

  const dbName =
    flags.db ||
    (envName === 'staging'
      ? process.env.K6_MONGODB_DB || process.env.STAGING_MONGODB_DB || 'quizDB_staging'
      : process.env.K6_MONGODB_DB || process.env.MONGODB_DB || 'quizDB');

  const expectedHost =
    flags.expectedHost || process.env.STAGING_MONGODB_EXPECTED_HOST || process.env.K6_EXPECTED_HOST || '';

  const target = assertSafeDatabaseTarget({
    envName,
    uri,
    dbName,
    allowStaging,
    expectedHost,
  });

  const prefix =
    flags.prefix || process.env.K6_USER_PREFIX || process.env.STAGING_PROBE_PREFIX || 'k6-load';
  const count =
    flags.count ??
    (Number.parseInt(String(process.env.K6_USER_COUNT || process.env.STAGING_PROBE_COUNT || ''), 10) ||
      (target.envName === 'staging' ? 25 : 10));
  const password =
    flags.password || process.env.K6_USER_PASSWORD || process.env.STAGING_PROBE_PASSWORD || '';
  const questionCount =
    flags.questions ??
    (Number.parseInt(String(process.env.K6_SEED_QUESTIONS || ''), 10) ||
      (target.envName === 'local' ? 100 : 0));

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });

  await client.connect();
  try {
    const db = client.db(target.dbName);
    let result;
    if (flags.command === 'setup') {
      result = await runSetup(db, {
        prefix,
        count,
        password,
        minQuestions: flags.skipQuestions ? 0 : target.envName === 'local' ? 100 : 0,
        seedQuestions: flags.seedQuestions && !flags.skipQuestions,
        questionCount: flags.skipQuestions ? 0 : questionCount,
        resetQuestions: flags.resetQuestions,
      });
    } else if (flags.command === 'seed') {
      result = await runSeed(db, {
        prefix,
        count,
        password,
        minQuestions: flags.skipQuestions ? 0 : target.envName === 'local' ? 100 : 0,
        seedQuestions: flags.seedQuestions && !flags.skipQuestions,
        questionCount: flags.skipQuestions ? 0 : questionCount,
      });
    } else if (flags.command === 'cleanup') {
      result = await runCleanup(db, {
        prefix,
        count: Math.max(count, 200),
        includeQuestions: flags.includeQuestions,
      });
    } else {
      result = await runStatus(db, { prefix });
    }

    const sanitizedOutput = {
      ok: true,
      env: target.envName,
      dbName: target.dbName,
      hosts: target.hosts,
      ...result,
    };
    console.log(JSON.stringify(sanitizedOutput, null, flags.json ? 0 : 2));
  } finally {
    await client.close();
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((err) => {
    const safeMessage = stripMongoUriCredentials(err?.message || String(err));
    console.error(`[staging-test-data] Error: ${safeMessage}`);
    process.exitCode = 1;
  });
}
