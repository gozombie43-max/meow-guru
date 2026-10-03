import { afterEach, describe, expect, it } from 'vitest';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { up } from '../015-progress-scale-indexes.js';

let server;
let client;

afterEach(async () => {
  await client?.close();
  await server?.stop();
  client = null;
  server = null;
});

async function database() {
  server = await MongoMemoryServer.create();
  client = new MongoClient(server.getUri());
  await client.connect();
  return client.db('progress_scale_indexes');
}

describe('progress scale indexes', () => {
  it('adopts legacy equivalent indexes and remains idempotent', async () => {
    const db = await database();
    await db.collection('userQuestionProgress').createIndex(
      { userId: 1, questionId: 1 },
      { unique: true },
    );
    await db.collection('userQuestionProgress').createIndex({ userId: 1, topic: 1 });
    await db.collection('userTopicProgress').createIndex(
      { userId: 1, topic: 1 },
      { unique: true },
    );

    await up(db);
    await up(db);

    const questionIndexes = await db.collection('userQuestionProgress').listIndexes().toArray();
    const topicIndexes = await db.collection('userTopicProgress').listIndexes().toArray();

    expect(questionIndexes.filter(index => index.key.userId === 1 && index.key.questionId === 1)).toHaveLength(1);
    expect(questionIndexes.find(index => index.key.userId === 1 && index.key.questionId === 1)?.unique).toBe(true);
    expect(questionIndexes.filter(index => index.key.userId === 1 && index.key.topic === 1)).toHaveLength(1);
    expect(topicIndexes.filter(index => index.key.userId === 1 && index.key.topic === 1)).toHaveLength(1);
    expect(topicIndexes.find(index => index.key.userId === 1 && index.key.topic === 1)?.unique).toBe(true);
  });

  it('rejects a conflicting non-unique user/question index', async () => {
    const db = await database();
    await db.collection('userQuestionProgress').createIndex({ userId: 1, questionId: 1 });

    await expect(up(db)).rejects.toThrow('conflicts with existing index');
  });
});
