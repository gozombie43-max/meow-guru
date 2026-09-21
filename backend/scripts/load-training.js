import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import express from 'express';

// Deliberately no dotenv or remote-target option: this command can only create
// and load an isolated local replica set. Production credentials are ignored.
const stages = (process.env.TRAINING_LOAD_STAGES || '1,5,10,25,50').split(',').map(Number);
const count = Number(process.env.TRAINING_LOAD_QUESTIONS || 20);
if (stages.some(n => !Number.isInteger(n) || n < 1 || n > 100) || ![10,20,25,50].includes(count)) throw new Error('Invalid load stages or question count');
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = randomUUID();
process.env.REFRESH_TOKEN_SECRET = randomUUID();
process.env.LOG_LEVEL = 'error';
process.env.TRAINING_INDEXED_QUESTIONS = 'true';
process.env.TRAINING_LOCAL_INGRESS = 'true';

let mongo, server, disconnect, stopMetrics;
const report = { environment: 'isolated local Mongo replica set', questionsPerLearner: count, stages: [] };
try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = `training_load_${Date.now()}`;
  const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
  disconnect = disconnectMongoDB;
  const db = await connectMongoDB();
  for (const file of ['005-training', '007-training-hardening', '008-training-performance']) {
    await (await import(`../migrations/${file}.js`)).up(db);
  }
  const { trainingQuestionMetadata } = await import('../services/training/domain/questionMetadata.js');
  await db.collection('questions').insertMany(Array.from({ length: 3500 }, (_, i) => {
    const q = { id: `load_q${i}`, exam: 'SSC CGL / CHSL', subject: 'Mathematics', topic: `Topic ${i % 25}`, question: `Question ${i}: ${'Content '.repeat(100)}`, options: ['Option A', 'Option B', 'Option C', 'Option D'], solution: 'Explanation '.repeat(100), correctAnswer: i % 4, difficulty: 1 + i % 5, expectedTime: 60, updatedAt: new Date(1700000000000 + i * 1000) };
    return { ...q, ...trainingQuestionMetadata(q) };
  }));
  const { createSession } = await import('../auth/sessions.js');
  const { globalLimiter, trainingIngressLimiter } = await import('../middleware/rateLimiter.js');
  const { startRuntimeMetrics } = await import('../infrastructure/logger.js');
  stopMetrics = startRuntimeMetrics();
  const app = express();
  app.use(express.json(), trainingIngressLimiter, globalLimiter);
  app.use('/api/training', (await import('../routes/training.js')).default);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/training`;
  for (const concurrency of stages) {
    // Separate quota windows for stages, without bypassing quota middleware.
    await trainingIngressLimiter.resetKey('127.0.0.1');
    const samples = {};
    const measure = async (operation, token, path, body) => {
      const start = performance.now();
      const sample = { ok: false, bytes: 0, ms: 0 };
      (samples[operation] ||= []).push(sample);
      try {
        const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
        const text = await response.text();
        sample.bytes = Buffer.byteLength(text);
        sample.status = response.status;
        if (!response.ok) throw new Error(`${operation} HTTP ${response.status}`);
        sample.ok = true;
        return JSON.parse(text);
      } finally { sample.ms = performance.now() - start; }
    };
    const started = performance.now();
    const learners = await Promise.allSettled(Array.from({ length: concurrency }, async (_, i) => {
      const user = { id: `load_${concurrency}_${i}_${randomUUID()}`, status: 'active', role: 'user' };
      await db.collection('users').insertOne(user);
      const token = (await createSession(user)).token;
      await measure('dashboard', token, '/dashboard?exam=ssc-cgl');
      let session = await measure('create', token, '/sessions', { mode: 'section', exam: 'ssc-cgl', subject: 'mathematics', count });
      for (let index = 0; index < session.questions.length; index++) {
        if (index) {
          const delta = await measure('visit', token, `/sessions/${session.id}/actions?response=delta`, { type: 'visit', index, revision: session.revision });
          session = { ...session, ...delta };
        }
        const delta = await measure('answer', token, `/sessions/${session.id}/actions?response=delta`, { type: 'answer', choice: index % 4, confidence: 'sure', revision: session.revision });
        session = { ...session, ...delta };
      }
      const completed = await measure('finish', token, `/sessions/${session.id}/actions?response=delta`, { type: 'finish', revision: session.revision });
      if (completed.status !== 'completed' || completed.result.attempted !== count) throw new Error('Incomplete learner lifecycle');
      await measure('dashboard', token, '/dashboard?exam=ssc-cgl');
    }));
    const summary = { concurrency, durationMs: Math.round(performance.now() - started), failedLearners: learners.filter(r => r.status === 'rejected').length, operations: {} };
    for (const [operation, rows] of Object.entries(samples)) {
      const sorted = rows.map(r => r.ms).sort((a,b) => a-b);
      const percentile = n => Math.round(sorted[Math.max(0, Math.ceil(sorted.length * n) - 1)] * 100) / 100;
      summary.operations[operation] = { requests: rows.length, errors: rows.filter(r => !r.ok).length, errorRate: rows.filter(r => !r.ok).length / rows.length, p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), meanResponseBytes: Math.round(rows.reduce((n,r) => n+r.bytes, 0) / rows.length) };
    }
    report.stages.push(summary);
    console.log(JSON.stringify(summary));
    if (summary.failedLearners) process.exitCode = 1;
  }
  if (process.env.TRAINING_LOAD_REPORT) await writeFile(process.env.TRAINING_LOAD_REPORT, JSON.stringify(report, null, 2) + '\n');
} finally {
  stopMetrics?.();
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnect?.();
  await mongo?.stop();
}
