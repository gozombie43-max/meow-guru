import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  connectMongoDB,
  disconnectMongoDB,
  getConfiguredPoolSizes,
  mongoPoolHealth,
} from '../../../config/mongodb.js';
import { getMongoSlowQueryThresholdMs, logger, observeMongo } from '../../../infrastructure/logger.js';
import { getHttpTimeoutConfig, listenServer } from '../../../infrastructure/httpListen.js';
import { clearSharedLocalCaches } from '../../../infrastructure/tieredCache.js';
import { isRetiredIndexCreate, migrate, migrations } from '../../../migrations/runner.js';
import { sameKeySpec } from '../../../migrations/indexUtils.js';
import * as migration027 from '../../../migrations/027-question-delivery-optimization.js';
import * as migration028 from '../../../migrations/028-backfill-question-uids.js';
import * as migration029 from '../../../migrations/029-load-readiness-indexes.js';
import {
  buildNormalizedQuestionFields,
  deriveExamModeKey,
  deriveSelectionKey,
  normalizeFilterKey,
  parseShiftInt,
  parseYearInt,
} from '../questionNormalizer.js';
import { questionExamModeCondition } from '../questionExamMode.js';
import {
  buildGeneralAwarenessChapterKeyCondition,
  buildGeneralAwarenessTopicKeyCondition,
} from '../generalAwarenessTopics.js';
import {
  ANALYZE_ANSWERS_PROJECTION,
  PUBLIC_QUESTION_PROJECTION,
  analyzeAnswers,
  fetchImageQuestions,
  fetchPracticeTest,
  fetchQuestionById,
  fetchQuestions,
} from '../questionReadService.js';
import { readQuestionFacets } from '../questionFacets.js';
import { createQuestion, createQuestionsBulk, removeQuestionsBulk } from '../questionWriteService.js';
import { fetchTopicCountSnapshot } from '../topicCountSnapshot.js';
import { invalidateQuestionCacheRevision } from '../questionCache.js';

function collectStages(planNode, stages = []) {
  if (!planNode || typeof planNode !== 'object') return stages;
  if (typeof planNode.stage === 'string') stages.push(planNode.stage);
  if (planNode.inputStage) collectStages(planNode.inputStage, stages);
  if (Array.isArray(planNode.inputStages)) {
    for (const child of planNode.inputStages) collectStages(child, stages);
  }
  if (planNode.queryPlan) collectStages(planNode.queryPlan, stages);
  return stages;
}

function collectIndexNames(planNode, names = []) {
  if (!planNode || typeof planNode !== 'object') return names;
  if (typeof planNode.indexName === 'string') names.push(planNode.indexName);
  if (planNode.inputStage) collectIndexNames(planNode.inputStage, names);
  if (Array.isArray(planNode.inputStages)) {
    for (const child of planNode.inputStages) collectIndexNames(child, names);
  }
  if (planNode.queryPlan) collectIndexNames(planNode.queryPlan, names);
  return names;
}

function buildSeedQuestions() {
  const docs = [];
  const mathTopics = ['percentages', 'algebra', 'geometry', 'trigonometry'];
  const exams = ['SSC CGL 2024', 'SSC CHSL 2023', 'RRB NTPC 2024'];
  const concepts = ['Successive Change', 'Linear Identities', 'Circle Theorems', 'Ratio Method'];

  for (let i = 0; i < 400; i++) {
    const topic = mathTopics[i % mathTopics.length];
    const exam = exams[i % exams.length];
    const concept = concepts[i % concepts.length];
    const quizName = i % 5 === 0 ? 'CareerWill' : 'PYQ';
    docs.push({
      id: `math_${i}`,
      questionUid: `q_${String(i + 1).padStart(32, '0')}`,
      subject: 'Mathematics',
      topic,
      chapter: topic,
      concept,
      exam,
      year: i % 2 === 0 ? 2024 : '2023',
      shift: i % 3 === 0 ? 'Shift 2' : 1,
      quizName,
      difficulty: i % 3 === 0 ? 'hard' : i % 2 === 0 ? 'easy' : 'medium',
      question: `Math question ${i}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      correctLetter: 'A',
      solution: `Secret math solution ${i}`,
      solutionImage: `/sol_${i}.png`,
      ingestionHash: `hash_${i}`,
      translations: {
        bn: {
          question: `গণিত প্রশ্ন ${i}`,
          options: ['ক', 'খ', 'গ', 'ঘ'],
          solution: `গোপন সমাধান ${i}`,
        },
      },
    });
  }

  // Study-mode rows that must be excluded from normal practice counts/tests.
  for (let i = 0; i < 10; i++) {
    docs.push({
      id: `study_${i}`,
      questionUid: `q_${String(1000 + i).padStart(32, '0')}`,
      subject: 'Mathematics',
      topic: 'percentages',
      questionType: 'study-mode',
      quizName: 'Study Mode',
      word: `Word${i}`,
      meanings: ['Meaning'],
      question: `Study ${i}`,
    });
  }

  // General Awareness topicGroup + chapter rows.
  for (let i = 0; i < 120; i++) {
    const isGeo = i < 80;
    docs.push({
      id: `ga_${i}`,
      questionUid: `q_${String(2000 + i).padStart(32, '0')}`,
      subject: 'general-awareness',
      topic: isGeo ? 'Solar System & Universe' : 'Fundamental Rights',
      chapter: isGeo ? 'Solar System & Universe' : 'Fundamental Rights',
      chapterSlug: isGeo ? 'solar-system-universe' : 'fundamental-rights',
      topicGroup: isGeo ? 'Geography' : 'Polity',
      exam: 'SSC CGL 2024',
      concept: isGeo ? 'Planets' : 'Articles',
      quizName: 'PYQ',
      question: `GA question ${i}`,
      options: ['Opt 1', 'Opt 2', 'Opt 3', 'Opt 4'],
      correctAnswer: 'Opt 1',
      solution: `GA secret solution ${i}`,
    });
  }

  // IIT JAM rows for examMode separation.
  for (let i = 0; i < 60; i++) {
    docs.push({
      id: `jam_${i}`,
      questionUid: `q_${String(3000 + i).padStart(32, '0')}`,
      subject: 'iit-jam-physics',
      topic: 'iit-jam-mechanics-and-general-properties-of-matter',
      exam: 'IIT JAM Physics 2024',
      concept: 'Lagrangian',
      quizName: 'PYQ',
      question: `JAM question ${i}`,
      options: ['1', '2', '3', '4'],
      correctAnswer: '1',
      solution: `JAM secret solution ${i}`,
    });
  }

  // Image MCQ rows.
  for (let i = 0; i < 10; i++) {
    docs.push({
      id: `img_${i}`,
      questionUid: `q_${String(4000 + i).padStart(32, '0')}`,
      subject: 'Reasoning',
      topic: 'visual_reasoning',
      questionType: 'image_mcq',
      question: `Image question ${i}`,
      questionImage: `/img_${i}.webp`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'B',
      solution: `Image secret solution ${i}`,
    });
  }

  return docs;
}

describe('Phase 2 MongoDB Optimization & Infrastructure Tuning', () => {
  let server;
  let db;
  let indexCountBefore027 = 0;
  let indexCountAfter027 = 0;
  let adaptiveIndexesBefore027 = 0;
  let adaptiveIndexesAfter027 = 0;
  let indexCountBefore029 = 0;
  let indexCountAfter029 = 0;
  let battleProfilesBefore029 = 0;
  let battleProfilesAfter029 = 0;
  let notificationFeedBefore029 = 0;
  let notificationFeedAfter029 = 0;
  let examUpdatesBefore029 = 0;
  let examUpdatesAfter029 = 0;

  beforeAll(async () => {
    vi.stubEnv('MONGO_MAX_POOL_SIZE', '64');
    vi.stubEnv('MONGO_MIN_POOL_SIZE', '8');
    vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
    server = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', server.getUri());
    vi.stubEnv('MONGODB_DB', `mongo_opt_${Date.now()}`);
    db = await connectMongoDB();

    // Seed raw un-backfilled documents first to test 027 backfill end-to-end.
    await db.collection('questions').insertMany(buildSeedQuestions());

    // Run migrations 001..026, record baseline index counts.
    const priorSteps = migrations.filter(
      step => step.id !== migration027.id && step.id !== migration028.id && step.id !== migration029.id,
    );
    await migrate(db, priorSteps);
    indexCountBefore027 = (await db.collection('questions').listIndexes().toArray()).length;
    adaptiveIndexesBefore027 = (await db.collection('adaptiveQuizSessions').listIndexes().toArray()).length;

    // Run migration 027 via runner and verify post-migration counts.
    await migrate(db, [migration027]);
    indexCountAfter027 = (await db.collection('questions').listIndexes().toArray()).length;
    adaptiveIndexesAfter027 = (await db.collection('adaptiveQuizSessions').listIndexes().toArray()).length;

    // Run migration 028, record pre-029 counts, then run 029 via runner.
    await migrate(db, [migration028]);
    indexCountBefore029 = (await db.collection('questions').listIndexes().toArray()).length;
    battleProfilesBefore029 = (await db.collection('battleProfiles').listIndexes().toArray()).length;
    notificationFeedBefore029 = (await db.collection('notificationFeed').listIndexes().toArray()).length;
    examUpdatesBefore029 = (await db.collection('examUpdates').listIndexes().toArray()).length;

    await migrate(db, [migration029]);
    indexCountAfter029 = (await db.collection('questions').listIndexes().toArray()).length;
    battleProfilesAfter029 = (await db.collection('battleProfiles').listIndexes().toArray()).length;
    notificationFeedAfter029 = (await db.collection('notificationFeed').listIndexes().toArray()).length;
    examUpdatesAfter029 = (await db.collection('examUpdates').listIndexes().toArray()).length;
  }, 120000);

  afterAll(async () => {
    await disconnectMongoDB();
    await server?.stop();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    clearSharedLocalCaches();
    invalidateQuestionCacheRevision();
  });

  it('configures Mongo pool sizes, slow-query threshold, and Azure HTTP keep-alive timeouts', async () => {
    expect(getConfiguredPoolSizes({})).toEqual({ maxPoolSize: 50, minPoolSize: 5 });
    expect(getConfiguredPoolSizes({ MONGO_MAX_POOL_SIZE: '80', MONGO_MIN_POOL_SIZE: '10' })).toEqual({
      maxPoolSize: 80,
      minPoolSize: 10,
    });
    expect(getConfiguredPoolSizes({ MONGO_MAX_POOL_SIZE: '10', MONGO_MIN_POOL_SIZE: '25' })).toEqual({
      maxPoolSize: 10,
      minPoolSize: 10,
    });
    expect(mongoPoolHealth().capacity).toBe(64);

    expect(getMongoSlowQueryThresholdMs({})).toBe(100);
    expect(getMongoSlowQueryThresholdMs({ MONGO_SLOW_QUERY_MS: '' })).toBe(100);
    expect(getMongoSlowQueryThresholdMs({ MONGO_SLOW_QUERY_MS: '   ' })).toBe(100);
    expect(getMongoSlowQueryThresholdMs({ MONGO_SLOW_QUERY_MS: '150' })).toBe(150);

    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      observeMongo({ commandName: 'find', duration: 120 }, false, { collection: 'questions' });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'find', collection: 'questions', durationMs: 120, failed: false }),
        'Mongo operation',
      );
      warnSpy.mockClear();
      observeMongo({ commandName: 'find', duration: 50 }, false, { collection: 'questions' });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }

    expect(getHttpTimeoutConfig({})).toEqual(expect.objectContaining({ keepAliveTimeout: 65000, headersTimeout: 66000 }));
    expect(getHttpTimeoutConfig({ HTTP_KEEP_ALIVE_TIMEOUT_MS: '70000', HTTP_HEADERS_TIMEOUT_MS: '60000' })).toEqual(
      expect.objectContaining({
        keepAliveTimeout: 70000,
        headersTimeout: 71000,
      }),
    );

    const httpServer = createServer((_req, res) => res.end('ok'));
    await listenServer(httpServer, 0, '127.0.0.1');
    try {
      expect(httpServer.keepAliveTimeout).toBe(65000);
      expect(httpServer.headersTimeout).toBe(66000);
    } finally {
      await new Promise(resolve => httpServer.close(resolve));
    }
  });

  it('computes deterministic normalized filter keys, examModeKey, year/shift ints, and selectionKey', () => {
    expect(normalizeFilterKey('  SSC   CGL  2024 ')).toBe('ssc cgl 2024');
    expect(normalizeFilterKey(null)).toBe('');
    expect(normalizeFilterKey({ $ne: 'x' })).toBe('');
    expect(normalizeFilterKey(['a', 'b'])).toBe('');
    expect(parseYearInt('2024')).toBe(2024);
    expect(parseYearInt(2023)).toBe(2023);
    expect(parseYearInt('bad')).toBeNull();
    expect(parseShiftInt('Shift 3')).toBe(3);
    expect(parseShiftInt(2)).toBe(2);
    expect(parseShiftInt('99')).toBeNull();
    expect(deriveExamModeKey({ subject: 'iit-jam-physics' })).toBe('iit-jam');
    expect(deriveExamModeKey({ subject: ['iit-jam-physics'] })).toBe('iit-jam');
    expect(deriveExamModeKey({ subject: 'Mathematics', exam: 'SSC CGL' })).toBe('ssc');
    expect(buildNormalizedQuestionFields(null)).toMatchObject({
      topicKey: '',
      subjectKey: '',
      modeKey: 'concept',
      examModeKey: 'ssc',
      yearInt: null,
      shiftInt: null,
    });

    const sample = {
      questionUid: 'q_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      subject: 'General Awareness',
      topic: 'Solar System & Universe',
      chapter: 'Solar System & Universe',
      topicGroup: 'Geography',
      exam: ' SSC   CGL 2024 ',
      concept: '  Planets & Orbits ',
      year: '2024',
      shift: 'Shift 2',
      quizName: 'PYQ',
    };
    const fields = buildNormalizedQuestionFields(sample);
    expect(fields).toEqual({
      topicKey: 'solarsystemuniverse',
      subjectKey: 'generalawareness',
      quizKey: 'pyq',
      modeKey: 'concept',
      keyVersion: 1,
      examKey: 'ssc cgl 2024',
      conceptKey: 'planets & orbits',
      chapterKey: 'solar system & universe',
      topicGroupKey: 'geography',
      examModeKey: 'ssc',
      yearInt: 2024,
      shiftInt: 2,
      selectionKey: deriveSelectionKey(sample),
    });
    expect(fields.selectionKey).toMatch(/^[a-f0-9]{16}$/);
    expect(deriveSelectionKey(sample)).toBe(deriveSelectionKey({ ...sample }));

    expect(questionExamModeCondition('ssc', { useNormalizedKeys: true })).toEqual({ examModeKey: 'ssc' });
    expect(questionExamModeCondition('iit-jam', { useNormalizedKeys: true })).toEqual({ examModeKey: 'iit-jam' });
    expect(buildGeneralAwarenessTopicKeyCondition('geography')).toEqual({
      $or: [
        { topicKey: { $in: expect.arrayContaining(['geography', 'solarsystemuniverse']) } },
        { topicGroupKey: 'geography' },
      ],
    });
    expect(buildGeneralAwarenessChapterKeyCondition('Solar System & Universe')).toEqual({
      $or: [
        { topicKey: { $in: expect.arrayContaining(['solarsystemuniverse']) } },
        { chapterKey: { $in: expect.arrayContaining(['solar system & universe', 'solar-system-universe']) } },
      ],
    });
  });

  it('backfills all documents, reduces index bloat cleanly, and is idempotent on re-run', async () => {
    const questions = db.collection('questions');

    // Every seeded document has all new normalized fields backfilled.
    const missingAfter = await questions.countDocuments({
      $or: [
        { examKey: { $exists: false } },
        { conceptKey: { $exists: false } },
        { chapterKey: { $exists: false } },
        { topicGroupKey: { $exists: false } },
        { examModeKey: { $exists: false } },
        { yearInt: { $exists: false } },
        { shiftInt: { $exists: false } },
        { selectionKey: { $exists: false } },
      ],
    });
    expect(missingAfter).toBe(0);

    // Index count on questions dropped cleanly (40 -> 36) in 027, then 36 -> 37 in 029
    // (+3 ESR ring-scan indexes, -2 ESR-broken 027 indexes) and strict-prefix duplicates dropped.
    expect(indexCountBefore027).toBe(40);
    expect(indexCountAfter027).toBeLessThan(indexCountBefore027);
    expect(indexCountAfter027).toBe(36);
    expect(adaptiveIndexesBefore027).toBe(3);
    expect(adaptiveIndexesAfter027).toBe(1);

    expect(indexCountBefore029).toBe(36);
    expect(indexCountAfter029).toBe(37);
    expect(battleProfilesBefore029).toBe(5);
    expect(battleProfilesAfter029).toBe(5);
    expect(notificationFeedBefore029).toBe(7);
    expect(notificationFeedAfter029).toBe(6);
    expect(examUpdatesBefore029).toBe(5);
    expect(examUpdatesAfter029).toBe(4);

    const questionIndexNames = (await questions.listIndexes().toArray()).map(idx => idx.name);
    expect(questionIndexNames).toEqual(
      expect.arrayContaining([
        'questions_examMode_topic_mode_id',
        'questions_topic_mode_examKey_id',
        'questions_topic_mode_conceptKey_id',
        'questions_selection_id',
        'questions_topic_selection_id',
        'questions_examMode_subject_selection_id',
        'questions_topic_chapterKey_mode_id',
        'questions_topicGroupKey_mode_id',
      ]),
    );
    expect(questionIndexNames).not.toContain('questions_topic_mode_selection_id');
    expect(questionIndexNames).not.toContain('questions_examMode_subject_mode_selection_id');
    expect(questionIndexNames).not.toContain('topic_1');
    expect(questionIndexNames).not.toContain('subject_1');
    expect(questionIndexNames).not.toContain('training_quality_candidates');
    expect(questionIndexNames).not.toContain('training_topic_candidates');

    const battleProfileIndexes = await db.collection('battleProfiles').listIndexes().toArray();
    expect(battleProfileIndexes.some(idx => sameKeySpec(idx.key, { rating: -1, wins: -1, gamesPlayed: -1 }))).toBe(true);
    expect(battleProfileIndexes.some(idx => sameKeySpec(idx.key, { rating: -1, wins: -1 }))).toBe(false);

    const notificationFeedIndexes = await db.collection('notificationFeed').listIndexes().toArray();
    expect(notificationFeedIndexes.some(idx => sameKeySpec(idx.key, { audience: 1, userId: 1, createdAt: -1, _id: -1 }))).toBe(true);
    expect(notificationFeedIndexes.some(idx => sameKeySpec(idx.key, { audience: 1, userId: 1, createdAt: -1 }))).toBe(false);

    const examUpdateIndexes = await db.collection('examUpdates').listIndexes().toArray();
    expect(examUpdateIndexes.some(idx => sameKeySpec(idx.key, { publishedAt: -1, _id: -1 }))).toBe(true);
    expect(examUpdateIndexes.some(idx => sameKeySpec(idx.key, { publishedAt: -1 }))).toBe(false);

    const uqpIndexNames = (await db.collection('userQuestionProgress').listIndexes().toArray()).map(idx => idx.name);
    expect(uqpIndexNames).toContain('userQuestionProgress_user_topic');

    const quizSessionIndexes = await db.collection('quizSessions').listIndexes().toArray();
    expect(quizSessionIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'quizSessions_session_id', unique: true }),
        expect.objectContaining({ name: 'quizSessions_user_status_updated' }),
        expect.objectContaining({ name: 'quizSessions_expires_ttl', expireAfterSeconds: 0 }),
      ]),
    );

    // Idempotent re-run of migration 027 & 029 (and full runner replay must NOT rebuild/re-drop retired indexes).
    await expect(migration027.up(db)).resolves.toBeUndefined();
    await expect(migration029.up(db)).resolves.toBeUndefined();
    expect((await questions.listIndexes().toArray()).length).toBe(indexCountAfter029);
    expect((await db.collection('battleProfiles').listIndexes().toArray()).length).toBe(battleProfilesAfter029);
    expect((await db.collection('notificationFeed').listIndexes().toArray()).length).toBe(notificationFeedAfter029);
    expect((await db.collection('examUpdates').listIndexes().toArray()).length).toBe(examUpdatesAfter029);

    const origCreateIndex = Collection.prototype.createIndex;
    const createIndexCalls = [];
    const createIndexSpy = vi.spyOn(Collection.prototype, 'createIndex').mockImplementation(function (key, opts, ...rest) {
      createIndexCalls.push({ collection: this.collectionName, key, opts });
      return origCreateIndex.call(this, key, opts, ...rest);
    });
    const dropIndexSpy = vi.spyOn(Collection.prototype, 'dropIndex');
    try {
      await expect(migrate(db)).resolves.toBeUndefined();
      expect(dropIndexSpy).not.toHaveBeenCalled();
      const rebuiltRetired = createIndexCalls.filter(({ collection, key, opts }) =>
        isRetiredIndexCreate(collection, key, opts),
      );
      expect(rebuiltRetired).toHaveLength(0);
    } finally {
      createIndexSpy.mockRestore();
      dropIndexSpy.mockRestore();
    }
    expect((await questions.listIndexes().toArray()).length).toBe(indexCountAfter029);
  });

  it('uses IXSCAN with zero COLLSCAN, zero blocking SORT, and totalDocsExamined <= limit + 1 on core delivery queries', async () => {
    const questions = db.collection('questions');
    const limit = 25;
    const maxAllowedExamined = limit + 1;

    const cases = [
      {
        label: 'examMode + topic + mode cursor',
        filter: { examModeKey: 'ssc', topicKey: 'percentages', modeKey: 'concept' },
        sort: { _id: 1 },
        expectedIndex: 'questions_examMode_topic_mode_id',
      },
      {
        label: 'topic + mode + examKey cursor',
        filter: { topicKey: 'percentages', modeKey: 'concept', examKey: 'ssc cgl 2024' },
        sort: { _id: 1 },
        expectedIndex: 'questions_topic_mode_examKey_id',
      },
      {
        label: 'topic + mode + conceptKey cursor',
        filter: { topicKey: 'percentages', modeKey: 'concept', conceptKey: 'successive change' },
        sort: { _id: 1 },
        expectedIndex: 'questions_topic_mode_conceptKey_id',
      },
      {
        label: 'unfiltered selectionKey ring-scan',
        filter: { modeKey: { $ne: 'studyMode' }, selectionKey: { $gte: '4000000000000000' } },
        sort: { selectionKey: 1, _id: 1 },
        expectedIndex: 'questions_selection_id',
        maxAllowedExamined: limit + 1 + 10,
      },
      {
        label: 'topic + non-studyMode + selectionKey ring-scan',
        filter: { topicKey: 'percentages', modeKey: { $ne: 'studyMode' }, selectionKey: { $gte: '4000000000000000' } },
        sort: { selectionKey: 1, _id: 1 },
        expectedIndex: 'questions_topic_selection_id',
        maxAllowedExamined: limit + 1 + 10,
      },
      {
        label: 'examMode + subject + non-studyMode + selectionKey ring-scan',
        filter: { examModeKey: 'ssc', subjectKey: 'mathematics', modeKey: { $ne: 'studyMode' }, selectionKey: { $gte: '4000000000000000' } },
        sort: { selectionKey: 1, _id: 1 },
        expectedIndex: 'questions_examMode_subject_selection_id',
        maxAllowedExamined: limit + 1 + 10,
      },
      {
        label: 'GA topicGroupKey + mode cursor',
        filter: { topicGroupKey: 'geography', modeKey: 'concept' },
        sort: { _id: 1 },
        expectedIndex: 'questions_topicGroupKey_mode_id',
      },
      {
        label: 'topic + chapterKey + mode cursor',
        filter: { topicKey: 'solarsystemuniverse', chapterKey: 'solar system & universe', modeKey: 'concept' },
        sort: { _id: 1 },
        expectedIndex: 'questions_topic_chapterKey_mode_id',
      },
    ];

    for (const testCase of cases) {
      const plan = await questions
        .find(testCase.filter, { projection: PUBLIC_QUESTION_PROJECTION })
        .sort(testCase.sort)
        .limit(limit + 1)
        .explain('executionStats');

      const stages = collectStages(plan.queryPlanner.winningPlan);
      const indexNames = collectIndexNames(plan.queryPlanner.winningPlan);

      expect(stages, `${testCase.label} stages`).toContain('IXSCAN');
      expect(stages, `${testCase.label} must not COLLSCAN`).not.toContain('COLLSCAN');
      expect(stages, `${testCase.label} must not blocking SORT`).not.toContain('SORT');
      expect(indexNames, `${testCase.label} index`).toContain(testCase.expectedIndex);
      expect(
        plan.executionStats.totalDocsExamined,
        `${testCase.label} totalDocsExamined`,
      ).toBeLessThanOrEqual(testCase.maxAllowedExamined ?? maxAllowedExamined);
    }
  });

  it('enforces safe field projections on public reads and unbiased selectionKey ring-scan on practice tests', async () => {
    const sensitiveKeys = [
      'correctAnswer', 'correctLetter', 'solution', 'solutionImage',
      'ingestionHash', 'trainingCandidate', 'battleSelectionKey',
    ];
    for (const key of sensitiveKeys) {
      expect(PUBLIC_QUESTION_PROJECTION[key]).toBeUndefined();
    }
    expect(ANALYZE_ANSWERS_PROJECTION).toEqual({
      _id: 0, id: 1, questionUid: 1, topic: 1, subject: 1, correctAnswer: 1, options: 1,
    });

    const listRes = await fetchQuestions({ topic: 'percentages', limit: 10 });
    expect(listRes.questions.length).toBeGreaterThan(0);
    for (const q of listRes.questions) {
      for (const key of sensitiveKeys) expect(q[key]).toBeUndefined();
      expect(q.translations?.bn?.solution).toBeUndefined();
    }

    const imgRes = await fetchImageQuestions('visual_reasoning', 5);
    expect(imgRes.count).toBe(5);
    for (const q of imgRes.questions) {
      for (const key of sensitiveKeys) expect(q[key]).toBeUndefined();
    }

    const single = await fetchQuestionById('math_0', 'percentages');
    expect(single).toBeTruthy();
    for (const key of sensitiveKeys) expect(single[key]).toBeUndefined();
    expect(single.translations?.bn?.solution).toBeUndefined();

    // Unbiased practice test ring-scan with wraparound and examMode filtering.
    const testA = await fetchPracticeTest({
      subject: 'mathematics',
      examMode: 'ssc',
      count: 15,
      pivot: '0000000000000000',
    });
    const testB = await fetchPracticeTest({
      subject: 'mathematics',
      examMode: 'ssc',
      count: 15,
      pivot: 'f000000000000000',
    });
    expect(testA).toHaveLength(15);
    expect(testB).toHaveLength(15);
    expect(new Set(testA.map(q => q.id)).size).toBe(15);
    expect(new Set(testB.map(q => q.id)).size).toBe(15);
    expect(testA.map(q => q.id).sort()).not.toEqual(testB.map(q => q.id).sort());
    for (const q of [...testA, ...testB]) {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.solution).toBeUndefined();
      expect(q.id.startsWith('study_')).toBe(false);
      expect(q.id.startsWith('jam_')).toBe(false);
    }

    const analysis = await analyzeAnswers([
      { questionId: 'math_0', topic: 'percentages', selectedAnswer: 'A' },
    ]);
    expect(analysis.summary.correct).toBe(1);

    const facets = await readQuestionFacets('mathematics', 'ssc', { useNormalizedKeys: true });
    expect(facets.topics).toContain('percentages');
    expect(facets.topics).not.toContain('iit-jam-mechanics-and-general-properties-of-matter');

    // Study Mode & safe frontend fields stay in PUBLIC_QUESTION_PROJECTION.
    for (const safeField of [
      'homophones', 'homonyms', 'prompt', 'phrase', 'definition', 'meaning', 'clue',
      'answerTranslation', 'wordTranslation', 'translation', 'hint',
      'optionAImage', 'optionBImage', 'optionCImage', 'optionDImage',
      'category', 'subtopic', 'concepts', 'language', 'examName', 'examYear',
    ]) {
      expect(PUBLIC_QUESTION_PROJECTION[safeField]).toBe(1);
    }

    const tempIds = ['ga_slug_lookup_1', 'ga_slug_lookup_2', 'logical_reason_1', 'legacy_physics_optics_1'];
    try {
      // GA bidirectional chapter slug <-> title lookup after 027 backfill.
      const gaSlugDoc = {
        id: 'ga_slug_lookup_1',
        questionUid: 'q_ffffffffffffffffffffffffffffff01',
        subject: 'general-awareness',
        topic: 'geography',
        topicGroup: 'geography',
        chapter: 'Solar System & Universe',
        chapterSlug: 'solar-system-universe',
        quizName: 'PYQ',
        question: 'Which planet is known as the Red Planet?',
        options: ['Mars', 'Venus', 'Earth', 'Jupiter'],
        correctAnswer: 'Mars',
        solution: 'Secret Mars solution',
      };
      const gaRiversDoc = {
        id: 'ga_slug_lookup_2',
        questionUid: 'q_ffffffffffffffffffffffffffffff04',
        subject: 'general-awareness',
        topic: 'geography',
        topicGroup: 'geography',
        chapter: 'Indian Rivers & Drainage System',
        chapterSlug: 'indian-rivers-drainage-system',
        quizName: 'PYQ',
        question: 'Longest peninsular river of India?',
        options: ['Godavari', 'Krishna', 'Kaveri', 'Narmada'],
        correctAnswer: 'Godavari',
        solution: 'Secret river solution',
      };
      await db.collection('questions').insertMany([
        { ...gaSlugDoc, ...buildNormalizedQuestionFields(gaSlugDoc) },
        { ...gaRiversDoc, ...buildNormalizedQuestionFields(gaRiversDoc) },
      ]);
      const bySlugDirect = await db.collection('questions').find(
        buildGeneralAwarenessChapterKeyCondition('solar-system-universe'),
      ).toArray();
      expect(bySlugDirect.some(doc => doc.id === 'ga_slug_lookup_1')).toBe(true);

      const bySlugRead = await fetchQuestions({
        topic: 'geography',
        chapter: 'solar-system-universe',
        limit: 200,
      });
      expect(bySlugRead.questions.some(doc => doc.id === 'ga_slug_lookup_1')).toBe(true);

      const byUniqueSlugRead = await fetchQuestions({
        topic: 'geography',
        chapter: 'indian-rivers-drainage-system',
        limit: 20,
      });
      expect(byUniqueSlugRead.questions.map(doc => doc.id)).toEqual(['ga_slug_lookup_2']);

      // Reasoning facets in normalized mode include logicalreasoning aliases.
      const logicalDoc = {
        id: 'logical_reason_1',
        questionUid: 'q_ffffffffffffffffffffffffffffff02',
        subject: 'Logical Reasoning',
        topic: 'syllogism-inferences',
        quizName: 'PYQ',
        question: 'All A are B',
        options: ['True', 'False'],
        correctAnswer: 'True',
      };
      await db.collection('questions').insertOne({
        ...logicalDoc,
        ...buildNormalizedQuestionFields(logicalDoc),
      });
      clearSharedLocalCaches();
      invalidateQuestionCacheRevision();
      const reasoningFacets = await readQuestionFacets('reasoning', 'ssc', { useNormalizedKeys: true });
      expect(reasoningFacets.topics).toContain('syllogism-inferences');

      // Legacy topicCountSnapshot (normalized=false) classifies non-GA physics docs under physics, not chapter pollution.
      const legacyPhysicsDoc = {
        id: 'legacy_physics_optics_1',
        questionUid: 'q_ffffffffffffffffffffffffffffff03',
        subject: 'physics',
        topic: 'optics',
        quizName: 'PYQ',
        question: 'Focal length of plane mirror?',
        options: ['Infinity', 'Zero'],
        correctAnswer: 'Infinity',
      };
      await db.collection('questions').insertOne(legacyPhysicsDoc);
      vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'false');
      clearSharedLocalCaches();
      invalidateQuestionCacheRevision();
      const legacyGaSnapshot = await fetchTopicCountSnapshot('general-awareness');
      expect(legacyGaSnapshot.totals.physics).toBeGreaterThanOrEqual(1);
      expect(legacyGaSnapshot.totals.optics).toBeUndefined();
    } finally {
      vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', 'true');
      await db.collection('questions').deleteMany({ id: { $in: tempIds } });
    }
  });

  it('executes topicCountSnapshot in 1 aggregation per subject and removes bulk questions in 1 batched lookup', async () => {
    await db.collection('questionMetadata').deleteMany({});
    clearSharedLocalCaches();
    invalidateQuestionCacheRevision();

    const aggregateSpy = vi.spyOn(Collection.prototype, 'aggregate');
    try {
      const mathSnapshot = await fetchTopicCountSnapshot('mathematics');
      expect(aggregateSpy).toHaveBeenCalledTimes(1);
      expect(mathSnapshot.totals.percentages).toBe(100);
      expect(mathSnapshot.totals.algebra).toBe(100);
      expect(mathSnapshot.totals.geometry).toBe(100);
      expect(mathSnapshot.totals.trigonometry).toBe(100);

      aggregateSpy.mockClear();
      const gaSnapshot = await fetchTopicCountSnapshot('general-awareness');
      expect(aggregateSpy).toHaveBeenCalledTimes(1);
      expect(gaSnapshot.totals['solar-system-universe']).toBe(80);
      expect(gaSnapshot.totals.geography).toBe(80);
      expect(gaSnapshot.totals['fundamental-rights']).toBe(40);
      expect(gaSnapshot.totals.polity).toBe(40);
    } finally {
      aggregateSpy.mockRestore();
    }

    // Write path populates all new normalized fields & batched bulk delete avoids N+1.
    const created = await createQuestion({
      id: 'write_check_1',
      subject: 'Mathematics',
      topic: 'percentages',
      exam: 'SSC CGL 2025',
      concept: 'Base Change',
      year: '2025',
      shift: 'Shift 1',
      quizName: 'PYQ',
      question: 'Created Q',
      options: ['1', '2'],
      correctAnswer: '1',
    });
    expect(created).toMatchObject({
      examKey: 'ssc cgl 2025',
      conceptKey: 'base change',
      examModeKey: 'ssc',
      yearInt: 2025,
      shiftInt: 1,
      selectionKey: expect.stringMatching(/^[a-f0-9]{16}$/),
    });

    const bulkRows = Array.from({ length: 10 }, (_, idx) => ({
      id: `bulk_del_${idx}`,
      subject: 'Mathematics',
      topic: 'algebra',
      question: `Bulk ${idx}`,
      options: ['1', '2'],
      correctAnswer: '1',
    }));
    const bulkResult = await createQuestionsBulk(bulkRows);
    expect(bulkResult.every(r => r.status === 'fulfilled')).toBe(true);

    const findSpy = vi.spyOn(Collection.prototype, 'find');
    try {
      const deleted = await removeQuestionsBulk(bulkRows.map(r => r.id));
      expect(deleted).toEqual({ deleted: 10, failed: 0, total: 10 });
      // Exactly 1 batched $in lookup against questions (not 10 sequential queries).
      const questionFindCalls = findSpy.mock.calls.filter(([filter]) => filter?.id?.$in || filter?.$and);
      expect(questionFindCalls.length).toBe(1);
    } finally {
      findSpy.mockRestore();
    }
  });

  it('proves IXSCAN, zero COLLSCAN, and zero blocking SORT via explain(executionStats) across all audited question, session, progress, mock attempt, training, and auth queries', async () => {
    const questions = db.collection('questions');
    const quizSessions = db.collection('quizSessions');
    const uqp = db.collection('userQuestionProgress');
    const mockAttempts = db.collection('mockAttempts');
    const users = db.collection('users');

    const assertExplainIxscan = async (cursor, { label, expectedIndex, maxDocsExamined, allowSort = false }) => {
      const plan = await cursor.explain('executionStats');
      const stages = collectStages(plan.queryPlanner.winningPlan);
      const indexNames = collectIndexNames(plan.queryPlanner.winningPlan);
      expect(
        stages.some(stage => stage === 'IXSCAN' || stage === 'EXPRESS_IXSCAN'),
        `${label} stages (${JSON.stringify(stages)})`,
      ).toBe(true);
      expect(stages, `${label} must not COLLSCAN`).not.toContain('COLLSCAN');
      if (!allowSort) {
        expect(stages, `${label} must not blocking SORT`).not.toContain('SORT');
      }
      if (expectedIndex) {
        expect(indexNames, `${label} expected index`).toContain(expectedIndex);
      }
      if (maxDocsExamined !== undefined) {
        expect(plan.executionStats.totalDocsExamined, `${label} totalDocsExamined`).toBeLessThanOrEqual(maxDocsExamined);
      }
      return plan;
    };

    const uid1 = `q_${String(1).padStart(32, '0')}`;
    const uid2 = `q_${String(2).padStart(32, '0')}`;
    const uid3 = `q_${String(3).padStart(32, '0')}`;
    const now = new Date('2026-11-22T10:00:00Z');
    const future = new Date('2026-11-22T12:00:00Z');

    try {
      // Populate representative training metadata on existing math_* docs without changing topic counts,
      // plus >= 15 realistic docs + decoys in quizSessions, userQuestionProgress, mockAttempts, and users.
      const mathIds = Array.from({ length: 25 }, (_, i) => `math_${i}`);
      await questions.updateMany(
        { id: { $in: mathIds } },
        {
          $set: {
            trainingExamSlugs: ['ssc-cgl'],
            trainingEligible: true,
            trainingMetadataVersion: 1,
            trainingSubjectSlug: 'mathematics',
            trainingTopicSlug: 'percentages',
            trainingCandidate: { difficulty: 0.5, discrimination: 0.7 },
            updatedAt: now,
          },
        },
      );

      await quizSessions.insertMany(
        Array.from({ length: 16 }, (_, i) => ({
          sessionId: `qs_exp_${i + 1}`,
          userId: i < 8 ? 'u_exp_1' : 'u_exp_2',
          status: i % 2 === 0 ? 'in_progress' : 'completed',
          updatedAt: new Date(now.getTime() + i * 1000),
          expiresAt: future,
        })),
      );

      await uqp.insertMany([
        ...Array.from({ length: 15 }, (_, i) => ({
          userId: i < 8 ? 'u_exp_1' : 'u_exp_2',
          questionUid: `q_${String(i + 1).padStart(32, '0')}`,
          topic: 'percentages',
          attempts: 1,
        })),
        { userId: 'u_exp_legacy', topic: 'percentages', attempts: 1 }, // decoy missing questionUid
      ]);

      await mockAttempts.insertMany([
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `att_exp_${i + 1}`,
          userId: i < 6 ? 'u_exp_1' : 'u_exp_2',
          startKey: `sk_${i + 1}`,
          status: 'in_progress',
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `att_nostart_${i + 1}`,
          userId: 'u_exp_1',
          status: 'completed',
        })),
      ]);

      await users.insertMany([
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `u_exp_${i + 1}`,
          accountRecord: true,
          authProvider: 'local',
          email: `exp${i + 1}@test.local`,
          emailNormalized: `exp${i + 1}@test.local`,
          emailVerified: i % 2 === 0,
          emailVerificationTokenHash: `vhash_${i + 1}`,
          emailVerificationExpiresAt: future,
          passwordResetTokenHash: `rhash_${i + 1}`,
          passwordResetExpiresAt: future,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `lock_exp_${i + 1}`,
          type: 'email_lock',
          email: `lock${i + 1}@test.local`,
        })),
      ]);

      // 1. hydrateQuestionBatch ($in + $type: 'string')
      await assertExplainIxscan(
        questions.find({ questionUid: { $in: [uid1, uid2, uid3], $type: 'string' } }, { projection: PUBLIC_QUESTION_PROJECTION }),
        { label: 'questions hydrateQuestionBatch', expectedIndex: 'question_canonical_identity', maxDocsExamined: 3 },
      );

      // 2. resolveQuestion (single uid + $type: 'string', unscoped & examMode-scoped)
      await assertExplainIxscan(
        questions.find({ questionUid: { $eq: uid1, $type: 'string' } }).limit(1),
        { label: 'questions resolveQuestion unscoped', expectedIndex: 'question_canonical_identity', maxDocsExamined: 1 },
      );
      await assertExplainIxscan(
        questions.find({ $and: [{ questionUid: { $eq: uid1, $type: 'string' } }, questionExamModeCondition('ssc')] }).limit(1),
        { label: 'questions resolveQuestion examMode-scoped', expectedIndex: 'question_canonical_identity', maxDocsExamined: 1 },
      );

      // 3. fetchQuestionsRevealWindow ($or of $type: 'string' predicates)
      await assertExplainIxscan(
        questions.find({
          $or: [
            { questionUid: { $eq: uid1, $type: 'string' } },
            { questionUid: { $eq: uid2, $type: 'string' } },
          ],
        }).limit(24),
        { label: 'questions fetchQuestionsRevealWindow', expectedIndex: 'question_canonical_identity', maxDocsExamined: 2 },
      );

      // 4. fetchPracticeTest (exact normalized examModeKey + subjectKey + non-studyMode + selectionKey)
      await assertExplainIxscan(
        questions
          .find({
            $and: [
              { subjectKey: 'mathematics' },
              { examModeKey: 'ssc' },
              { modeKey: { $ne: 'studyMode' } },
              { selectionKey: { $gte: '4000000000000000' } },
            ],
          })
          .sort({ selectionKey: 1, _id: 1 })
          .limit(30),
        { label: 'questions fetchPracticeTest', expectedIndex: 'questions_examMode_subject_selection_id', maxDocsExamined: 40 },
      );

      // 5. quizSessions lookups
      await assertExplainIxscan(
        quizSessions.find({ sessionId: 'qs_exp_1' }).limit(1),
        { label: 'quizSessions findQuizSessionById', expectedIndex: 'quizSessions_session_id', maxDocsExamined: 1 },
      );
      await assertExplainIxscan(
        quizSessions.find({ userId: 'u_exp_1', status: 'in_progress' }).sort({ updatedAt: -1 }).limit(10),
        { label: 'quizSessions user status updatedAt', expectedIndex: 'quizSessions_user_status_updated', maxDocsExamined: 10 },
      );

      // 6. userQuestionProgress (recordQuestionAnswerInTransaction)
      await assertExplainIxscan(
        uqp.find({ userId: 'u_exp_1', questionUid: { $eq: uid1, $type: 'string' } }).limit(1),
        { label: 'userQuestionProgress canonical lookup', expectedIndex: 'canonical_user_question_progress', maxDocsExamined: 1 },
      );

      // 7. mockAttempts (getAttemptByStartKey)
      await assertExplainIxscan(
        mockAttempts.find({ userId: 'u_exp_1', startKey: { $eq: 'sk_1', $type: 'string' } }).limit(1),
        { label: 'mockAttempts getAttemptByStartKey', expectedIndex: 'mock_start_idempotency', maxDocsExamined: 1 },
      );

      // 8. trainingRepository (trainingQuestionPool standard queries + dueTrainingQuestions)
      const trainingBase = {
        $and: [
          { trainingExamSlugs: 'ssc-cgl', trainingEligible: true, trainingMetadataVersion: 1 },
          { trainingSubjectSlug: 'mathematics' },
        ],
      };
      await assertExplainIxscan(
        questions.find(trainingBase).sort({ updatedAt: -1, _id: 1 }).limit(20),
        { label: 'trainingQuestionPool latest', expectedIndex: 'training_indexed_latest', maxDocsExamined: 20 },
      );
      await assertExplainIxscan(
        questions.find(trainingBase).sort({ updatedAt: 1, _id: 1 }).limit(20),
        { label: 'trainingQuestionPool oldest', expectedIndex: 'training_indexed_oldest', maxDocsExamined: 20 },
      );
      await assertExplainIxscan(
        questions.find(trainingBase).sort({ 'trainingCandidate.difficulty': -1, 'trainingCandidate.discrimination': -1, updatedAt: -1 }).limit(20),
        { label: 'trainingQuestionPool quality', expectedIndex: 'training_indexed_quality', maxDocsExamined: 20 },
      );
      await assertExplainIxscan(
        questions
          .find({
            $and: [
              { trainingExamSlugs: 'ssc-cgl', trainingEligible: true, trainingMetadataVersion: 1 },
              {
                $or: [
                  { questionUid: { $in: [uid1, uid2], $type: 'string' } },
                  { id: { $in: ['math_0'] }, questionUid: { $exists: false } },
                ],
              },
            ],
          })
          .limit(500),
        { label: 'dueTrainingQuestions', maxDocsExamined: 3 },
      );

      // 9. users auth queries (authRegistrationRepository canonical + fallback + token hashes + identity)
      await assertExplainIxscan(
        users.find({
          accountRecord: true,
          emailNormalized: { $eq: 'exp1@test.local', $type: 'string' },
          type: { $ne: 'email_lock' },
        }).limit(2),
        { label: 'users findUserByEmail canonical', expectedIndex: 'account_email_identity', maxDocsExamined: 1 },
      );
      await assertExplainIxscan(
        users.find({
          email: 'exp1@test.local',
          type: { $ne: 'email_lock' },
        }).limit(2),
        { label: 'users findUserByEmail fallback', expectedIndex: 'email_1', maxDocsExamined: 1 },
      );
      await assertExplainIxscan(
        users.find({
          authProvider: 'local',
          emailVerified: { $ne: true },
          emailVerificationTokenHash: { $eq: 'vhash_2', $type: 'string' },
          emailVerificationExpiresAt: { $gt: now },
          type: { $ne: 'email_lock' },
        }).limit(1),
        { label: 'users verifyLocalUserEmailByTokenHash', expectedIndex: 'email_verification_token_lookup', maxDocsExamined: 1 },
      );
      await assertExplainIxscan(
        users.find({
          authProvider: 'local',
          passwordResetTokenHash: { $eq: 'rhash_1', $type: 'string' },
          passwordResetExpiresAt: { $gt: now },
          type: { $ne: 'email_lock' },
        }).limit(1),
        { label: 'users consumePasswordResetToken', expectedIndex: 'password_reset_token_lookup', maxDocsExamined: 1 },
      );
      await assertExplainIxscan(
        users.find({ id: 'u_exp_1', type: { $ne: 'email_lock' } }).limit(1),
        { label: 'users user_identity_lookup', expectedIndex: 'user_identity_lookup', maxDocsExamined: 1 },
      );
    } finally {
      await Promise.all([
        questions.updateMany(
          { id: { $regex: /^math_/ } },
          {
            $unset: {
              trainingExamSlugs: '',
              trainingEligible: '',
              trainingMetadataVersion: '',
              trainingSubjectSlug: '',
              trainingTopicSlug: '',
              trainingCandidate: '',
              updatedAt: '',
            },
          },
        ),
        quizSessions.deleteMany({ sessionId: { $regex: /^qs_exp_/ } }),
        uqp.deleteMany({ userId: { $in: ['u_exp_1', 'u_exp_2', 'u_exp_legacy'] } }),
        mockAttempts.deleteMany({ id: { $regex: /^att_(exp|nostart)_/ } }),
        users.deleteMany({ id: { $regex: /^(u_exp_|lock_exp_)/ } }),
      ]);
    }
  });
});
