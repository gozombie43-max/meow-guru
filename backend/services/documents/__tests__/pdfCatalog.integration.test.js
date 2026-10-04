import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
const state = vi.hoisted(() => ({ db: null, version: 1, shared: new Map() }));
vi.mock('../../../config/mongodb.js', () => ({ getMongoDB: () => state.db }));
vi.mock('../../../config/redis.js', () => ({ getRedisClient: async () => null, redisKey: key => key,
  redisGetJson: async key => state.shared.get(key) ?? null, redisSetJson: async (key, value) => { state.shared.set(key, value); } }));
vi.mock('../../../config/b2.js', () => ({ B2_BUCKET: 'test-bucket', b2Client: { send: vi.fn(async () => ({ Contents: [
  { Key: `quiz-pdfs/algebra/notes/v${state.version}.pdf`, Size: 100, LastModified: new Date() },
] })) } }));
let mongo, client;
beforeAll(async () => { mongo = await MongoMemoryServer.create(); client = new MongoClient(mongo.getUri()); await client.connect(); state.db = client.db('pdf_cache_tests'); }, 60000);
afterAll(async () => { await client.close(); await mongo.stop(); });
it('advances the durable generation so a warm second instance sees an upload immediately', async () => {
  const first = await import('../pdfCatalogService.js');
  expect((await first.listTopicPdfs('algebra'))[0].fileName).toBe('v1.pdf');
  vi.resetModules();
  const second = await import('../pdfCatalogService.js');
  expect((await second.listTopicPdfs('algebra'))[0].fileName).toBe('v1.pdf');
  state.version = 2;
  await first.invalidatePdfCache('algebra');
  expect((await second.listTopicPdfs('algebra'))[0].fileName).toBe('v2.pdf');
  expect(await state.db.collection('runtimeCacheRevisions').countDocuments()).toBe(1);
});
