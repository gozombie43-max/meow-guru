import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { migrate, migrations } from '../migrations/runner.js';
import { buildNormalizedQuestionFields } from '../services/questions/questionNormalizer.js';
import { PUBLIC_QUESTION_PROJECTION } from '../services/questions/questionReadService.js';
import { quizQuestionProjection } from '../services/questions/quizQuestionDTO.js';
import {
  GLOBAL_LEADERBOARD_PROJECTION,
  SEASON_LEADERBOARD_PROJECTION,
} from '../repositories/battleRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.resolve(__dirname, '../test-results/db-explain-audit.json');

function collectStages(planNode, stages = []) {
  if (!planNode || typeof planNode !== 'object') return stages;
  if (typeof planNode.stage === 'string') {
    stages.push(planNode.stage);
  }
  if (planNode.inputStage) collectStages(planNode.inputStage, stages);
  if (Array.isArray(planNode.inputStages)) {
    for (const child of planNode.inputStages) collectStages(child, stages);
  }
  if (planNode.queryPlan) collectStages(planNode.queryPlan, stages);
  return stages;
}

function collectIndexNames(planNode, names = []) {
  if (!planNode || typeof planNode !== 'object') return names;
  if (typeof planNode.indexName === 'string' && !names.includes(planNode.indexName)) {
    names.push(planNode.indexName);
  }
  if (planNode.inputStage) collectIndexNames(planNode.inputStage, names);
  if (Array.isArray(planNode.inputStages)) {
    for (const child of planNode.inputStages) collectIndexNames(child, names);
  }
  if (planNode.queryPlan) collectIndexNames(planNode.queryPlan, names);
  return names;
}

async function seedRepresentativeData(db) {
  const now = new Date('2026-11-22T10:00:00.000Z');
  const future = new Date('2026-11-23T10:00:00.000Z');

  // 1. Seed 1,200 questions across SSC, GA, StudyMode, AI Challenge, and IIT JAM
  const topics = [
    { subject: 'Mathematics', topic: 'percentages', chapter: 'percentages', concept: 'Successive Change' },
    { subject: 'Mathematics', topic: 'algebra', chapter: 'linear-equations', concept: 'Cubic Identities' },
    { subject: 'Reasoning', topic: 'syllogism', chapter: 'syllogism', concept: 'Only A Few' },
    { subject: 'English', topic: 'synonyms-antonyms', chapter: 'vocabulary', concept: 'Antonyms' },
    {
      subject: 'general-awareness',
      topic: 'Solar System & Universe',
      chapter: 'Solar System & Universe',
      chapterSlug: 'solar-system-universe',
      topicGroup: 'Geography',
      concept: 'Planets',
    },
    {
      subject: 'iit-jam-physics',
      topic: 'iit-jam-mechanics-and-general-properties-of-matter',
      chapter: 'mechanics',
      concept: 'Lagrangian',
    },
  ];
  const exams = ['SSC CGL 2024', 'SSC CHSL 2024', 'RRB NTPC 2024'];
  const difficulties = ['easy', 'medium', 'hard'];

  const questionDocs = [];
  for (let i = 0; i < 1200; i++) {
    const spec = topics[i % topics.length];
    const isStudy = i % 30 === 0;
    const isAi = !isStudy && i % 15 === 0;
    const uid = `q_${String(i + 1).padStart(32, '0')}`;
    const raw = {
      _id: new ObjectId((i + 1).toString(16).padStart(24, '0')),
      id: `q_audit_${i + 1}`,
      questionUid: uid,
      subject: spec.subject,
      topic: spec.topic,
      chapter: spec.chapter,
      ...(spec.chapterSlug ? { chapterSlug: spec.chapterSlug } : {}),
      ...(spec.topicGroup ? { topicGroup: spec.topicGroup } : {}),
      concept: spec.concept,
      exam: spec.subject === 'iit-jam-physics' ? 'IIT JAM Physics 2024' : exams[i % exams.length],
      year: 2022 + (i % 4),
      shift: `Shift ${(i % 3) + 1}`,
      difficulty: difficulties[i % difficulties.length],
      quizName: isStudy ? 'Study Mode' : isAi ? 'AI Challenge' : 'PYQ',
      questionType: isStudy ? 'study-mode' : 'mcq',
      ...(isStudy ? { word: `Word${i}`, meanings: ['Meaning'] } : {}),
      letter: ['A', 'B', 'C', 'D'][i % 4],
      question: `Representative audit question #${i + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option B',
      correctLetter: 'B',
      solution: `Solution for #${i + 1}`,
      createdAt: new Date(now.getTime() - i * 1000),
      updatedAt: new Date(now.getTime() - i * 1000),
    };
    questionDocs.push({ ...raw, ...buildNormalizedQuestionFields(raw) });
  }
  await db.collection('questions').insertMany(questionDocs, { ordered: false });

  // 2. Seed mockSlots & mockAttempts
  await db.collection('mockSlots').insertMany(
    Array.from({ length: 30 }, (_, i) => ({
      id: `cgl-mock-${i + 1}`,
      examSlug: i < 20 ? 'ssc-cgl' : 'ssc-chsl',
      configKey: i < 20 ? 'ssc-cgl-tier1' : 'ssc-chsl-tier1',
      title: `Mock Paper ${i + 1}`,
      type: i % 2 === 0 ? 'mock' : 'pyq',
      isPyq: i % 2 !== 0,
      tier: 'Tier I',
      year: 2024,
      order: i + 1,
      questionCount: 100,
      hasFixedPaper: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })),
  );

  await db.collection('mockAttempts').insertMany(
    Array.from({ length: 200 }, (_, i) => ({
      id: `att_audit_${i + 1}`,
      userId: `usr_audit_${(i % 40) + 1}`,
      examSlug: 'ssc-cgl',
      testId: 'cgl-mock-1',
      startKey: `start_key_${i + 1}`,
      status: i < 160 ? 'completed' : 'in_progress',
      startedAt: new Date(now.getTime() - i * 60_000),
      submittedAt: i < 160 ? new Date(now.getTime() - i * 30_000) : null,
      deadlineAt: future,
      result: i < 160 ? { totalScore: 50 + (i % 150), maxScore: 200, percentage: 60 } : null,
    })),
  );

  // 3. Seed battleProfiles & battleSeasonProfiles
  await db.collection('battleProfiles').insertMany(
    Array.from({ length: 150 }, (_, i) => ({
      userId: `usr_audit_${i + 1}`,
      displayName: `Player ${i + 1}`,
      rating: 1100 + (i * 7) % 600,
      peakRating: 1200 + (i * 7) % 600,
      gamesPlayed: i < 20 ? 0 : (i % 35) + 1,
      wins: i < 20 ? 0 : Math.floor(((i % 35) + 1) / 2),
      losses: i < 20 ? 0 : Math.floor(((i % 35) + 1) / 3),
      draws: 0,
      currentWinStreak: i % 5,
      bestWinStreak: i % 8,
      updatedAt: new Date(now.getTime() - i * 1000),
    })),
  );

  await db.collection('battleSeasonProfiles').insertMany(
    Array.from({ length: 150 }, (_, i) => ({
      seasonKey: i < 120 ? 'season-2026-s1' : 'season-2025-s4',
      seasonId: i < 120 ? 'season-2026-s1' : 'season-2025-s4',
      userId: `usr_audit_${i + 1}`,
      displayName: `Player ${i + 1}`,
      rating: 1150 + (i * 9) % 550,
      tier: i > 100 ? 'Diamond' : 'Gold',
      gamesPlayed: i < 30 ? 2 : 5 + (i % 40),
      wins: i < 30 ? 1 : 3 + (i % 20),
      losses: i < 30 ? 1 : 2 + (i % 15),
      draws: 0,
      currentWinStreak: i % 4,
      updatedAt: new Date(now.getTime() - i * 1000),
    })),
  );

  // 4. Seed users, pushDevices, and quizSessions
  await db.collection('users').insertMany([
    ...Array.from({ length: 100 }, (_, i) => ({
      id: `usr_audit_${i + 1}`,
      accountRecord: true,
      authProvider: 'local',
      name: i === 0 ? 'Priya Sharma' : `Student Learner ${i + 1}`,
      email: `usr_audit_${i + 1}@example.test`,
      emailNormalized: `usr_audit_${i + 1}@example.test`,
      role: i === 0 ? 'admin' : 'user',
      status: i % 25 === 0 ? 'suspended' : 'active',
      emailVerified: true,
      createdAt: new Date(now.getTime() - i * 60_000).toISOString(),
      lastLoginAt: new Date(now.getTime() - i * 30_000).toISOString(),
    })),
    {
      id: 'email_lock_1',
      type: 'email_lock',
      email: 'pending@example.test',
      createdAt: now,
    },
  ]);

  await db.collection('pushDevices').insertMany(
    Array.from({ length: 80 }, (_, i) => ({
      fid: `fid_audit_${i + 1}`,
      userId: `usr_audit_${(i % 50) + 1}`,
      enabled: i % 5 !== 0,
      platform: i % 10 === 0 ? 'ios' : 'android',
      lastSeenAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })),
  );

  await db.collection('quizSessions').insertMany(
    Array.from({ length: 60 }, (_, i) => ({
      sessionId: `qs_audit_${i + 1}`,
      userId: `usr_audit_${(i % 15) + 1}`,
      mode: i % 2 === 0 ? 'practice' : 'topic',
      status: i % 3 === 0 ? 'completed' : 'in_progress',
      updatedAt: new Date(now.getTime() - i * 5000),
      expiresAt: future,
    })),
  );
}

async function explainQuery(db, spec) {
  const col = db.collection(spec.collection);
  let explained;
  if (spec.operation === 'count') {
    explained = await col.find(spec.filter).explain('executionStats');
  } else {
    let cursor = col.find(spec.filter);
    if (spec.projection) cursor = cursor.project(spec.projection);
    if (spec.collation) cursor = cursor.collation(spec.collation);
    if (spec.sort) cursor = cursor.sort(spec.sort);
    if (spec.limit) cursor = cursor.limit(spec.limit);
    explained = await cursor.explain('executionStats');
  }

  const winningPlan = explained.queryPlanner?.winningPlan || {};
  const stats = explained.executionStats || {};
  const stages = collectStages(winningPlan);
  const indexNames = collectIndexNames(winningPlan);
  const usesCollscan = stages.includes('COLLSCAN');
  const usesIxscan = stages.some((stage) =>
    ['IXSCAN', 'EXPRESS_IXSCAN', 'COUNT_SCAN', 'TEXT_MATCH'].includes(stage),
  );
  const hasBlockingSort = stages.includes('SORT');

  return {
    name: spec.name,
    category: spec.category,
    collection: spec.collection,
    critical: spec.critical !== false,
    winningPlan: usesCollscan ? 'COLLSCAN' : usesIxscan ? 'IXSCAN' : stages.join(' <- '),
    stageChain: stages.join(' <- '),
    indexName: indexNames[0] || null,
    indexNames,
    usesCollscan,
    usesIxscan,
    hasBlockingSort,
    totalKeysExamined: stats.totalKeysExamined ?? 0,
    totalDocsExamined: stats.totalDocsExamined ?? 0,
    nReturned: stats.nReturned ?? 0,
    executionTimeMillis: stats.executionTimeMillis ?? 0,
  };
}

async function main() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = await new MongoClient(replSet.getUri()).connect();
  try {
    const db = client.db('meow_explain_audit');
    await migrate(db);
    await seedRepresentativeData(db);

    const uid1 = `q_${String(1).padStart(32, '0')}`;
    const uid2 = `q_${String(2).padStart(32, '0')}`;
    const uid3 = `q_${String(3).padStart(32, '0')}`;
    const boundaryId = new ObjectId((10).toString(16).padStart(24, '0'));

    const hotQueries = [
      {
        name: 'v1.practice.topicRingScan',
        category: 'Question Delivery v1',
        collection: 'questions',
        filter: {
          examModeKey: 'ssc',
          topicKey: 'percentages',
          modeKey: { $ne: 'studyMode' },
          selectionKey: { $gte: '4000000000000000' },
        },
        projection: quizQuestionProjection,
        sort: { selectionKey: 1, _id: 1 },
        limit: 21,
      },
      {
        name: 'v1.practice.subjectRingScan',
        category: 'Question Delivery v1',
        collection: 'questions',
        filter: {
          examModeKey: 'ssc',
          subjectKey: 'mathematics',
          modeKey: { $ne: 'studyMode' },
          selectionKey: { $gte: '4000000000000000' },
        },
        projection: quizQuestionProjection,
        sort: { selectionKey: 1, _id: 1 },
        limit: 21,
      },
      {
        name: 'v1.topic.loadTopicPoolUids',
        category: 'Question Delivery v1',
        collection: 'questions',
        filter: {
          examModeKey: 'ssc',
          topicKey: 'percentages',
          modeKey: { $ne: 'studyMode' },
        },
        projection: { _id: 1, questionUid: 1, id: 1 },
        sort: { _id: 1 },
        limit: 200,
      },
      {
        name: 'v1.session.examModeTopicModeCursor',
        category: 'Question Delivery v1',
        collection: 'questions',
        filter: {
          examModeKey: 'ssc',
          topicKey: 'percentages',
          modeKey: 'concept',
        },
        projection: quizQuestionProjection,
        sort: { _id: 1 },
        limit: 25,
      },
      {
        name: 'v1.batch.hydrateQuestionBatch',
        category: 'Question Delivery v1',
        collection: 'questions',
        filter: {
          questionUid: { $in: [uid1, uid2, uid3], $type: 'string' },
        },
        projection: quizQuestionProjection,
        limit: 20,
      },
      {
        name: 'cursor.topicExamPage',
        category: 'Cursor Pagination',
        collection: 'questions',
        filter: {
          topicKey: 'percentages',
          modeKey: 'concept',
          examKey: 'ssc cgl 2024',
          _id: { $gt: boundaryId },
        },
        projection: PUBLIC_QUESTION_PROJECTION,
        sort: { _id: 1 },
        limit: 26,
      },
      {
        name: 'cursor.topicConceptPage',
        category: 'Cursor Pagination',
        collection: 'questions',
        filter: {
          topicKey: 'percentages',
          modeKey: 'concept',
          conceptKey: 'successive change',
        },
        projection: PUBLIC_QUESTION_PROJECTION,
        sort: { _id: 1 },
        limit: 26,
      },
      {
        name: 'cursor.topicChapterPage',
        category: 'Cursor Pagination',
        collection: 'questions',
        filter: {
          topicKey: 'solarsystemuniverse',
          chapterKey: 'solar system & universe',
          modeKey: 'concept',
        },
        projection: PUBLIC_QUESTION_PROJECTION,
        sort: { _id: 1 },
        limit: 26,
      },
      {
        name: 'cursor.gaTopicGroupPage',
        category: 'Topic & Practice Queries',
        collection: 'questions',
        filter: {
          topicGroupKey: 'geography',
          modeKey: 'concept',
        },
        projection: PUBLIC_QUESTION_PROJECTION,
        sort: { _id: 1 },
        limit: 26,
      },
      {
        name: 'practice.subjectDifficultyPool',
        category: 'Topic & Practice Queries',
        collection: 'questions',
        filter: {
          subjectKey: 'mathematics',
          difficulty: 'medium',
          modeKey: { $ne: 'studyMode' },
        },
        projection: PUBLIC_QUESTION_PROJECTION,
        limit: 30,
      },
      {
        name: 'mock.slotLookupById',
        category: 'Mock Paper & Percentile',
        collection: 'mockSlots',
        filter: {
          examSlug: 'ssc-cgl',
          id: 'cgl-mock-1',
        },
        limit: 1,
      },
      {
        name: 'mock.percentileCountBelow',
        category: 'Mock Paper & Percentile',
        collection: 'mockAttempts',
        operation: 'count',
        filter: {
          examSlug: 'ssc-cgl',
          testId: 'cgl-mock-1',
          status: 'completed',
          'result.totalScore': { $lte: 135 },
        },
      },
      {
        name: 'mock.percentileCountTotal',
        category: 'Mock Paper & Percentile',
        collection: 'mockAttempts',
        operation: 'count',
        filter: {
          examSlug: 'ssc-cgl',
          testId: 'cgl-mock-1',
          status: 'completed',
        },
      },
      {
        name: 'battle.globalLeaderboard',
        category: 'Battle Leaderboards',
        collection: 'battleProfiles',
        filter: {
          gamesPlayed: { $gte: 1 },
        },
        projection: GLOBAL_LEADERBOARD_PROJECTION,
        sort: { rating: -1, wins: -1, updatedAt: -1 },
        limit: 100,
      },
      {
        name: 'battle.seasonLeaderboardByKey',
        category: 'Battle Leaderboards',
        collection: 'battleSeasonProfiles',
        filter: {
          seasonKey: 'season-2026-s1',
          gamesPlayed: { $gte: 5 },
        },
        projection: SEASON_LEADERBOARD_PROJECTION,
        sort: { rating: -1, wins: -1, updatedAt: -1 },
        limit: 100,
      },
      {
        name: 'battle.seasonLeaderboardById',
        category: 'Battle Leaderboards',
        collection: 'battleSeasonProfiles',
        filter: {
          seasonId: 'season-2026-s1',
          gamesPlayed: { $gte: 5 },
        },
        projection: SEASON_LEADERBOARD_PROJECTION,
        sort: { rating: -1, wins: -1, updatedAt: -1 },
        limit: 100,
      },
      {
        name: 'auth.quizSessionById',
        category: 'User & Session Lookup',
        collection: 'quizSessions',
        filter: {
          sessionId: 'qs_audit_1',
        },
        limit: 1,
      },
      {
        name: 'auth.userById',
        category: 'User & Session Lookup',
        collection: 'users',
        filter: {
          id: 'usr_audit_1',
          type: { $ne: 'email_lock' },
        },
        limit: 1,
      },
      {
        name: 'auth.userByEmailNormalized',
        category: 'User & Session Lookup',
        collection: 'users',
        filter: {
          accountRecord: true,
          emailNormalized: { $eq: 'usr_audit_1@example.test', $type: 'string' },
          type: { $ne: 'email_lock' },
        },
        limit: 2,
      },
      {
        name: 'admin.usersTextSearch',
        category: 'Admin User Search',
        collection: 'users',
        filter: {
          type: { $ne: 'email_lock' },
          $text: { $search: 'Priya' },
        },
        limit: 25,
      },
      {
        name: 'admin.usersAnchoredIdEmailPrefix',
        category: 'Admin User Search',
        collection: 'users',
        filter: {
          type: { $ne: 'email_lock' },
          $or: [{ id: /^usr_audit_1/ }, { email: /^usr_audit_1/ }],
        },
        limit: 25,
      },
      {
        name: 'admin.pushDevicesAndroidUsers',
        category: 'Admin User Search',
        collection: 'pushDevices',
        filter: {
          enabled: true,
          platform: 'android',
        },
        projection: { _id: 0, userId: 1 },
        limit: 5000,
      },
    ];

    const queryResults = [];
    for (const spec of hotQueries) {
      queryResults.push(await explainQuery(db, spec));
    }

    const collscans = queryResults.filter((r) => r.critical && r.usesCollscan);
    const report = {
      generatedAt: new Date().toISOString(),
      migrationsApplied: migrations.length,
      latestMigrationId: migrations.at(-1)?.id || null,
      totalQueriesAudited: queryResults.length,
      criticalCollscanCount: collscans.length,
      allCriticalPassed: collscans.length === 0,
      queries: queryResults,
    };

    await mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log('\n### MongoDB `explain("executionStats")` Hot-Query Audit Summary\n');
    console.log(
      '| Query | Collection | Plan | Index Used | Keys Examined | Docs Examined | Returned | Time (ms) |',
    );
    console.log('|---|---|---|---|---:|---:|---:|---:|');
    for (const q of queryResults) {
      console.log(
        `| \`${q.name}\` | \`${q.collection}\` | **${q.winningPlan}** (\`${q.stageChain}\`) | \`${q.indexName || 'N/A'}\` | ${q.totalKeysExamined} | ${q.totalDocsExamined} | ${q.nReturned} | ${q.executionTimeMillis} |`,
      );
    }
    console.log(`\nSaved JSON report to: ${REPORT_PATH}`);

    if (collscans.length > 0) {
      console.error(
        `\nFAILED: ${collscans.length} critical query(ies) performed a COLLSCAN:`,
        collscans.map((c) => c.name),
      );
      process.exitCode = 1;
    }
  } finally {
    await client.close();
    await replSet.stop();
  }
}

main().catch((err) => {
  console.error('audit-db-explain failed:', err);
  process.exit(1);
});
