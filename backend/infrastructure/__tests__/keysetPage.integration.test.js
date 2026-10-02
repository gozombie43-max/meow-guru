import { beforeAll, afterAll, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { readKeysetPage } from '../keysetPage.js';
let mongo, client, collection;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); client = new MongoClient(mongo.getUri()); await client.connect();
  collection = client.db('keyset').collection('feed');
  await collection.insertMany(Array.from({ length: 12 }, (_, i) => ({ _id: new ObjectId(), audience: 'all', createdAt: new Date(1700000000000 + Math.floor(i / 3) * 1000), expiresAt: new Date(Date.now() + 100000) })));
});
afterAll(async () => { await client?.close(); await mongo?.stop(); });
it('reads duplicate timestamps once, survives new inserts and changing expiry times, and scopes cursors', async () => {
  const list = (cursor, scope = 'feed:one') => readKeysetPage(collection, { filter: { expiresAt: { $gt: new Date() } }, scope, cursor, limit: 4 });
  const first = await list();
  await collection.insertOne({ createdAt: new Date(), expiresAt: new Date(Date.now() + 100000) });
  const second = await list(first.nextCursor);
  const third = await list(second.nextCursor);
  expect(new Set([...first.items, ...second.items, ...third.items].map(row => row._id.toString())).size).toBe(12);
  expect(third.hasMore).toBe(false);
  await expect(list(first.nextCursor, 'feed:two')).rejects.toMatchObject({ statusCode: 400 });
  await expect(list('bad')).rejects.toMatchObject({ statusCode: 400 });
});
