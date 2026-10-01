import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { BSON, Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

const shared = vi.hoisted(() => new Map());
vi.mock('../config/redis.js', () => ({
  getRedisClient: vi.fn(async () => ({})),
  redisGetEjson: vi.fn(async key => shared.has(key) ? BSON.EJSON.parse(shared.get(key)) : null),
  redisSetEjson: vi.fn(async (key, value) => { shared.set(key, BSON.EJSON.stringify(value)); }),
}));

import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { trainingQuestionPool } from './trainingRepository.js';

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
  const find = vi.spyOn(Collection.prototype, 'find');
  const second = await trainingQuestionPool(config, [], ['q1']);
  expect(second.find(row => row.id === 'q1')).toBeUndefined();
  expect(second.find(row => row.id === 'q0')).toBeDefined();
  expect(second[0]._id).toBeInstanceOf(BSON.ObjectId);
  expect(find).toHaveBeenCalledTimes(1);
  expect(find).toHaveBeenCalledWith({ _id: 'revision' }, expect.any(Object));
  find.mockRestore();
});
