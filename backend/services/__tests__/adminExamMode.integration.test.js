import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
vi.mock('../../middleware/auth.js', () => ({ default: (_req, _res, next) => next() }));
import questionRoutes from '../../routes/questionRoutes.js';
import mockRoutes from '../../routes/mocktest.js';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { questionsQueryCache, questionCountsCache } from '../questions/questionCache.js';
import { normalizedQuestionKeys } from '../questions/questionNormalizer.js';
import { patchQuestionImage, patchSolutionImage } from '../../repositories/questionImageRepository.js';

let mongo, db, server, base;
const ssc = { id: 'ssc-1', subject: 'mathematics', topic: 'algebra', exam: 'SSC CGL', quizName: 'CareerWill', question: 'SSC question', options: ['1', '2'], correctAnswer: '1' };
const jam = { id: 'jam-1', subject: 'iit-jam-physics', topic: 'iit-jam-mathematical-methods', exam: 'IIT JAM Physics', quizName: 'Concept Drill', question: 'JAM question', options: ['1', '2'], correctAnswer: '1' };
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'admin_exam_mode');
  db = await connectMongoDB();
  const app = express();
  app.use(express.json());
  app.use('/api/questions', questionRoutes);
  app.use('/api/mocktest', mockRoutes);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
beforeEach(async () => {
  questionsQueryCache.clear(); questionCountsCache.clear(); clearSharedLocalCaches();
  await db.collection('questions').deleteMany({});
  await db.collection('mockSlots').deleteMany({});
  await db.collection('questions').insertMany([ssc, { ...ssc, id: 'ssc-2' }, jam, { ...jam, id: 'jam-2' }].map(row => ({ ...row, ...normalizedQuestionKeys(row) })));
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); vi.unstubAllEnvs(); });
const get = async path => {
  const response = await fetch(`${base}${path}`);
  expect(response.status, await response.clone().text()).toBe(200);
  return response.json();
};
const write = (path, method, data) => fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

it.each(['true', 'false'])('separates lists, totals, facets, pagination and fallback queries (normalized %s)', async normalized => {
  vi.stubEnv('QUESTIONS_NORMALIZED_KEYS', normalized);
  for (const pagination of ['', '&pagination=cursor&sort=asc']) {
    for (const mode of ['iit-jam', 'ssc', 'iit-jam']) {
      const page = await get(`/api/questions?examMode=${mode}&includeTotal=true&includeFacets=true&limit=1${pagination}`);
      expect(page.total).toBe(2);
      expect(page.questions[0].subject).toBe(mode === 'ssc' ? ssc.subject : jam.subject);
      expect(page.facets.topics).toEqual([mode === 'ssc' ? ssc.topic : jam.topic]);
      expect(page.facets.exams).toEqual([mode === 'ssc' ? ssc.exam : jam.exam]);
      expect(page.facets.quizNames).toEqual([mode === 'ssc' ? ssc.quizName : jam.quizName]);
      if (pagination) {
        const next = await get(`/api/questions?examMode=${mode}&pagination=cursor&sort=asc&limit=1&cursor=${page.nextCursor}`);
        expect(next.questions[0].subject).toBe(page.questions[0].subject);
        expect(next.questions[0].id).not.toBe(page.questions[0].id);
        const otherMode = mode === 'ssc' ? 'iit-jam' : 'ssc';
        expect((await fetch(`${base}/api/questions?examMode=${otherMode}&pagination=cursor&sort=asc&limit=1&cursor=${page.nextCursor}`)).status).toBe(400);
      }
    }
    const oppositeTopic = await get(`/api/questions?examMode=ssc&topic=${jam.topic}&includeTotal=true${pagination}`);
    expect(oppositeTopic.questions).toEqual([]);
    expect(oppositeTopic.total).toBe(0);
  }
  expect((await get('/api/questions?includeTotal=true')).total).toBe(4);
});

it('rejects mixed uploads before insertion and prevents moving an existing question between banks', async () => {
  expect((await write('/api/questions/bulk?examMode=iit-jam', 'POST', [{ ...jam, id: 'jam-new' }, { ...ssc, id: 'ssc-new' }])).status).toBe(400);
  expect(await db.collection('questions').countDocuments({})).toBe(4);
  expect((await write('/api/questions/bulk?examMode=iit-jam', 'POST', [null])).status).toBe(400);
  expect((await write('/api/questions/bulk?examMode=iit-jam', 'POST', [{ ...jam, subjectId: 'english' }])).status).toBe(400);
  expect((await write('/api/questions?examMode=ssc', 'POST', jam)).status).toBe(400);
  expect((await write('/api/questions/jam-1?examMode=ssc', 'PATCH', { question: 'Wrong bank' })).status).toBe(404);
  expect((await write('/api/questions/ssc-1?examMode=ssc', 'PATCH', { subject: jam.subject, topic: jam.topic })).status).toBe(400);
  const created = await write('/api/questions?examMode=iit-jam', 'POST', jam);
  expect(created.status).toBe(201);
  expect((await created.json()).question.topic).toBe(jam.topic);
  const updated = await write('/api/questions/jam-2?examMode=iit-jam', 'PATCH', { question: 'Updated physics question' });
  expect(updated.status).toBe(200);
  expect((await updated.json()).question.subject).toBe(jam.subject);
});

it('scopes duplicate checks, bulk deletion and image patch targets to the active bank', async () => {
  const duplicates = await write('/api/questions/check-duplicates?examMode=ssc', 'POST', { questions: [jam, ssc] });
  expect((await duplicates.json()).results.map(row => row.id)).toEqual([ssc.id]);
  await expect(patchQuestionImage(jam.id, '/wrong.png', 'wrong', 'ssc')).rejects.toThrow('not found');
  await expect(patchSolutionImage(ssc.id, '/wrong.png', 'wrong', {}, 'iit-jam')).rejects.toThrow('not found');
  const deletion = await write('/api/questions/bulk-delete?examMode=ssc', 'POST', { ids: [ssc.id, jam.id] });
  expect((await deletion.json()).deleted).toBe(1);
  expect(await db.collection('questions').countDocuments({ subject: jam.subject })).toBe(2);
  expect((await fetch(`${base}/api/questions/jam-1?examMode=ssc`, { method: 'DELETE' })).status).toBe(404);
  expect((await fetch(`${base}/api/questions/jam-1?examMode=ssc`)).status).toBe(404);
});

it('separates mock admin catalogs and rejects a paper in the opposite mode', async () => {
  await db.collection('mockSlots').insertMany([{ id: 'ssc-paper', examSlug: 'ssc-cgl' }, { id: 'jam-paper', examSlug: 'iit-jam-physics' }]);
  expect((await get('/api/mocktest/admin/all-slots?examMode=iit-jam')).slots.map(slot => slot.id)).toEqual(['jam-paper']);
  expect((await get('/api/mocktest/admin/all-slots?examMode=ssc')).slots.map(slot => slot.id)).toEqual(['ssc-paper']);
  expect((await get('/api/mocktest/admin/all-slots?examMode=iit-jam&exam=ssc-cgl')).slots).toEqual([]);
  expect((await write('/api/mocktest/admin/upload-paper?examMode=ssc', 'POST', { slot: { examSlug: 'iit-jam-physics' }, questions: [jam] })).status).toBe(400);
  expect((await write('/api/mocktest/admin/upload-paper?examMode=iit-jam', 'POST', { slot: { id: 'jam-new', examSlug: 'iit-jam-physics', configKey: 'iit-jam-physics', title: 'JAM Paper' }, questions: [ssc] })).status).toBe(400);
});
