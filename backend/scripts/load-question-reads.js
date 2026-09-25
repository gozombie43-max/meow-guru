// Reproducible local benchmark: disposable Mongo only; no .env or cloud access.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import express from 'express';
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB = 'question_read_load';
process.env.NODE_ENV = 'production';
process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
let server;
try {
  const db = await connectMongoDB();
  const collection = db.collection('questions');
  await collection.createIndex({ topicKey: 1, modeKey: 1, _id: 1 });
  await collection.insertMany(Array.from({ length: 20000 }, (_, i) => ({
    id: `load-${i}`, subject: 'Mathematics', subjectKey: 'mathematics', topic: 'algebra', topicKey: 'algebra', modeKey: 'concept',
    question: `Question ${i}: ${'Question content. '.repeat(30)}`, options: ['A', 'B', 'C', 'D'], solution: 'Explanation. '.repeat(30),
  })));
  const { fetchQuestionsSession } = await import('../services/questions/questionSessionService.js');
  const app = express();
  app.get('/session', async (req, res) => res.json(await fetchQuestionsSession(req.query)));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/session?topic=algebra&mode=concept&limit=50`;
  await fetch(url).then(response => response.arrayBuffer());
  const report = { environment: 'disposable local Mongo; not Azure capacity evidence', records: 20000, stages: [] };
  for (const concurrency of [5, 10, 25]) {
    const durations = [], sizes = [];
    await Promise.all(Array.from({ length: concurrency }, async () => {
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const response = await fetch(url);
        const body = await response.text();
        if (!response.ok) throw new Error(`Read failed: ${response.status}`);
        const parsed = JSON.parse(body);
        if (parsed.questions.length !== 50 || !parsed.hasMore || parsed.totalCount !== undefined) throw new Error('Pagination contract failed');
        durations.push(performance.now() - start);
        sizes.push(Buffer.byteLength(body));
      }
    }));
    durations.sort((a, b) => a - b);
    report.stages.push({ concurrency, requests: durations.length, p95Ms: Math.round(durations[Math.ceil(durations.length * 0.95) - 1]), maxBytes: Math.max(...sizes) });
  }
  const plan = await collection.find({ topicKey: 'algebra', modeKey: 'concept' }).sort({ _id: 1 }).limit(51).explain('executionStats');
  report.documentsExaminedPerPage = plan.executionStats.totalDocsExamined;
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/question-read-load.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await disconnectMongoDB();
  await mongo.stop();
}
