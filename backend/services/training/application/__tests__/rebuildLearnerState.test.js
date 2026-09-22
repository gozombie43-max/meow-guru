import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../../../config/mongodb.js';
import { up as upLearnerStateMeta } from '../../../../migrations/010-training-learner-state-meta.js';
import { rebuildLearnerStateForPair } from '../rebuildLearnerState.js';

let mongo;
let db;

const completed = ({ id, userId = 'learner', exam = 'ssc-cgl', at, choice, questionId = 'q1' }) => ({
  id,
  userId,
  exam,
  status: 'completed',
  completedAt: at,
  result: {},
  questions: [{
    id: questionId,
    subject: 'mathematics',
    topic: 'Algebra',
    correctIndex: 1,
    expectedTime: 10,
  }],
  answers: { [questionId]: { choice, confidence: 'sure', seconds: 10 } },
});

const stableRows = async collection => (await db.collection(collection).find({}).sort({ _id: 1 }).toArray())
  .map(({ createdAt, updatedAt, ...row }) => row);

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = 'learner_state_backfill_test';
  db = await connectMongoDB();
  await upLearnerStateMeta(db);
}, 60000);

beforeEach(async () => {
  await Promise.all([
    'trainingSessions',
    'trainingSkillState',
    'trainingReviewState',
    'trainingQuestionExposure',
    'trainingLearnerStateMeta',
  ].map(name => db.collection(name).deleteMany({})));
});

afterAll(async () => {
  await disconnectMongoDB();
  await mongo.stop();
});

describe('rebuildLearnerStateForPair', () => {
  it('rebuilds all 70 sessions rather than treating the newest 50 as authoritative', async () => {
    const sessions = Array.from({ length: 70 }, (_, index) => completed({
      id: `s${index}`,
      at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
      choice: index < 20 ? 0 : 1,
    }));
    await db.collection('trainingSessions').insertMany(sessions);

    await rebuildLearnerStateForPair(db, 'learner', 'ssc-cgl');

    const skill = await db.collection('trainingSkillState').findOne({ userId: 'learner', exam: 'ssc-cgl' });
    expect(skill.attempts).toBe(70);
    expect(skill.correct).toBe(50);
    expect(skill.mastery).toBeCloseTo(sessions.reduce((value, item) => 0.8 * value + 0.2 * Number(item.answers.q1.choice === 1), 0.5));
    expect(await db.collection('trainingQuestionExposure').findOne({ questionId: 'q1' })).toMatchObject({
      timesSeen: 70,
      timesCorrect: 50,
      lastSeenAt: sessions.at(-1).completedAt,
      lastCorrect: true,
    });
    expect(await db.collection('trainingLearnerStateMeta').findOne({ _id: 'learner:ssc-cgl' })).toMatchObject({
      version: 1, status: 'ready', sourceSessionCount: 70, sourceAttemptCount: 70,
      backfilledThroughSessionId: 's69',
    });
    expect(await db.collection('trainingSessions').countDocuments({ learningApplied: true, learningAppliedVersion: 1 })).toBe(70);
  });

  it('is idempotent, preserves exam isolation, and does not manufacture rows for an empty pair', async () => {
    await db.collection('trainingSessions').insertMany([
      completed({ id: 'cgl', at: '2026-01-01T00:00:00.000Z', choice: 0 }),
      completed({ id: 'chsl', exam: 'ssc-chsl', at: '2026-01-02T00:00:00.000Z', choice: 1, questionId: 'chsl-q' }),
    ]);
    await rebuildLearnerStateForPair(db, 'learner', 'ssc-chsl');
    const chslBefore = await stableRows('trainingSkillState');
    await rebuildLearnerStateForPair(db, 'learner', 'ssc-cgl');
    const once = await stableRows('trainingSkillState');
    await rebuildLearnerStateForPair(db, 'learner', 'ssc-cgl');
    expect(await stableRows('trainingSkillState')).toEqual(once);
    expect((await stableRows('trainingSkillState')).filter(row => row.exam === 'ssc-chsl')).toEqual(chslBefore);

    await rebuildLearnerStateForPair(db, 'empty', 'ssc-cgl');
    expect(await db.collection('trainingSkillState').countDocuments({ userId: 'empty' })).toBe(0);
    expect(await db.collection('trainingReviewState').countDocuments({ userId: 'empty' })).toBe(0);
    expect(await db.collection('trainingQuestionExposure').countDocuments({ userId: 'empty' })).toBe(0);
  });

  it('retries when a completion changes the epoch between read and commit', async () => {
    await db.collection('trainingSessions').insertOne(completed({
      id: 'initial', at: '2026-01-01T00:00:00.000Z', choice: 0,
    }));
    let raced = false;
    const result = await rebuildLearnerStateForPair(db, 'learner', 'ssc-cgl', {
      beforeCommit: async () => {
        if (raced) return;
        raced = true;
        await db.collection('trainingLearnerStateMeta').updateOne(
          { _id: 'learner:ssc-cgl' },
          { $set: { userId: 'learner', exam: 'ssc-cgl', status: 'pending', version: 0 }, $inc: { completionEpoch: 1 } },
          { upsert: true },
        );
      },
    });
    expect(result.retries).toBe(1);
    expect(await db.collection('trainingLearnerStateMeta').findOne({ _id: 'learner:ssc-cgl' })).toMatchObject({
      completionEpoch: 1,
      version: 1,
      status: 'ready',
    });
  });
});
