import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { BSON, Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

const shared = vi.hoisted(() => new Map());
vi.mock('../config/redis.js', () => ({
  getRedisClient: vi.fn(async () => null),
  redisKey: key => key,
  redisGetJson: vi.fn(async key => shared.has(key) ? JSON.parse(shared.get(key)) : null),
  redisSetJson: vi.fn(async (key, value) => { shared.set(key, JSON.stringify(value)); }),
  redisGetEjson: vi.fn(async key => shared.has(key) ? BSON.EJSON.parse(shared.get(key)) : null),
  redisSetEjson: vi.fn(async (key, value) => { shared.set(key, BSON.EJSON.stringify(value)); }),
}));

import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { trainingQuestionPool } from './trainingRepository.js';
import { clearSharedLocalCaches } from '../infrastructure/tieredCache.js';

let mongo, db;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'training_redis_test');
  vi.stubEnv('TRAINING_INDEXED_QUESTIONS', 'true');
  db = await connectMongoDB();
  await db.collection('questions').insertMany(Array.from({ length: 40 }, (_, index) => ({
    id: `q${index}`, updatedAt: new Date(2026, 0, 1, 0, 0, index),
    trainingExamSlugs: ['ssc-cgl'], trainingEligible: true, trainingMetadataVersion: 1,
    trainingSubjectSlug: 'mathematics', trainingTopicSlug: 'algebra',
    trainingCandidate: { id: `q${index}`, difficulty: 2, discrimination: 0.5 },
  })));
}, 60000);
afterAll(async () => { await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs(); });

it('shares indexed candidates while preserving recent-question exclusion and ObjectIds', async () => {
  const config = { exam: 'ssc-cgl', subject: 'mathematics', topic: 'algebra', mode: 'adaptive' };
  const first = await trainingQuestionPool(config, [], ['q0']);
  expect(first.find(row => row.id === 'q0')).toBeUndefined();
  expect(first[0]._id).toBeInstanceOf(BSON.ObjectId);
  clearSharedLocalCaches();
  const find = vi.spyOn(Collection.prototype, 'find');
  const second = await trainingQuestionPool(config, [], ['q1']);
  expect(second.find(row => row.id === 'q1')).toBeUndefined();
  expect(second.find(row => row.id === 'q0')).toBeDefined();
  expect(second[0]._id).toBeInstanceOf(BSON.ObjectId);
  expect(find).toHaveBeenCalledTimes(1);
  expect(find).toHaveBeenCalledWith({ _id: 'revision' }, expect.any(Object));
  find.mockRestore();
});

it('coalesces ten cold builders without Redis and applies exclusions per learner', async () => {
  clearSharedLocalCaches();
  shared.clear();
  const find = vi.spyOn(Collection.prototype, 'find');
  try {
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => trainingQuestionPool(
      { exam: 'ssc-cgl', subject: 'mathematics', mode: 'adaptive' }, [], [`q${index}`], ['algebra'],
    )));
    // One coalesced revision query and one latest/oldest/quality/weak build.
    expect(find).toHaveBeenCalledTimes(5);
    for (const [index, rows] of results.entries()) {
      expect(rows.some(row => row.id === `q${index}`)).toBe(false);
      expect(rows).toHaveLength(39);
      expect(rows[0]._id).toBeInstanceOf(BSON.ObjectId);
    }
  } finally { find.mockRestore(); }
});

it('reloads candidates after an authoritative question revision changes', async () => {
  const config = { exam: 'ssc-cgl', subject: 'mathematics', mode: 'adaptive' };
  expect((await trainingQuestionPool(config, [], [])).some(row => row.id === 'q0')).toBe(true);
  await db.collection('questions').updateOne({ id: 'q0' }, { $set: { trainingEligible: false } });
  await db.collection('questionMetadata').updateOne({ _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true });
  clearSharedLocalCaches();
  expect((await trainingQuestionPool(config, [], [])).some(row => row.id === 'q0')).toBe(false);
});
