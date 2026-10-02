import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { idempotency } from '../idempotency.js';

let mongo, base, secondBase, db;
const servers = [];
let mutations = 0;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'idempotency_tests');
  db = await connectMongoDB();
  const start = async () => {
    const app = express();
    app.use(express.json(), (req, _res, next) => { req.user = { id: req.get('Test-User') || 'one' }; next(); });
    app.post('/write', idempotency('test.write'), async (_req, res) => { mutations++; await new Promise(resolve => setTimeout(resolve, 30)); res.status(201).json({ mutation: mutations }); });
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await new Promise(resolve => server.once('listening', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  base = await start();
  secondBase = await start();
});
afterAll(async () => { await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))); await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs(); });
const send = (key, body = { a: 1 }, user = 'one', origin = base) => fetch(`${origin}/write`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'Test-User': user }, body: JSON.stringify(body) });

it('coalesces concurrent duplicate writes and replays the saved outcome across instances', async () => {
  const replies = await Promise.all([send('same-key-123'), send('same-key-123', { a: 1 }, 'one', secondBase)]);
  expect(replies.map(r => r.status).sort()).toEqual([201, 409]);
  const replay = await send('same-key-123', { a: 1 }, 'one', secondBase);
  expect(replay.status).toBe(201);
  expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
  expect(mutations).toBe(1);
  expect(await replay.json()).toEqual({ mutation: 1 });
  expect((await send('same-key-123', { a: 2 })).status).toBe(409);
  expect((await send('same-key-123', { a: 1 }, 'two')).status).toBe(201);
});

it('does not repeat a mutation when its response could not be recorded', async () => {
  const collection = db.collection('idempotencyRecords');
  const originalCollection = db.collection.bind(db);
  const lookup = vi.spyOn(db, 'collection').mockImplementation(name => name === 'idempotencyRecords' ? collection : originalCollection(name));
  const update = collection.updateOne.bind(collection);
  collection.updateOne = async () => { throw new Error('Network lost after commit'); };
  const before = mutations;
  try { expect((await send('lost-reply-123')).status).toBe(503); }
  finally { collection.updateOne = update; lookup.mockRestore(); }
  expect((await send('lost-reply-123', { a: 1 }, 'one', secondBase)).status).toBe(409);
  expect(mutations).toBe(before + 1);
});
