// Local-only disposable fixture. Never imports .env files or connects to Atlas.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { generateKeyPairSync } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-browser-access-secret-not-for-deployment';
process.env.REFRESH_TOKEN_SECRET = 'local-browser-refresh-secret-not-for-deployment';
process.env.GOOGLE_CLIENT_ID = 'fixture'; process.env.GOOGLE_CLIENT_SECRET = 'fixture';
process.env.GOOGLE_CALLBACK_URL = 'http://127.0.0.1:3111/auth/google/callback';
process.env.FIREBASE_PROJECT_ID = 'browser-fixture'; process.env.FIREBASE_CLIENT_EMAIL = 'fixture@example.test';
process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri(); process.env.MONGODB_DB = 'browser_fixture';
const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
const db = await connectMongoDB();
const { migrate } = await import('../migrations/runner.js'); await migrate(db);
const { initPassport } = await import('../auth/passport.js'); initPassport();
const { default: passport } = await import('../auth/passport.js');
const { default: auth } = await import('../routes/auth.routes.js');
const { default: mocktest } = await import('../routes/mocktest.js');
const { protect } = await import('../middleware/protect.js');
const passwordHash = await bcrypt.hash('Browser-fixture-123!', 4);
await db.collection('users').insertMany(['desktop', 'mobile', 'lighthouse', 'performance-desktop', 'performance-mobile'].map(device => ({ id: `browser-${device}`, name: 'Browser Student', email: `browser-${device}@example.test`, passwordHash, role: 'student', progress: {}, bookmarks: [], recentQuizzes: [{ quizKey: 'mathematics:algebra', currentIndex: 0, status: 'in-progress', selectedAnswers: {}, submittedQuestions: [] }] })));
const { normalizedQuestionKeys } = await import('../services/questions/questionNormalizer.js');
const { trainingQuestionMetadata } = await import('../services/training/domain/questionMetadata.js');
await db.collection('questions').insertMany(Array.from({ length: 250 }, (_, i) => {
  const row = { id: `fixture-${i}`, topic: 'algebra', subject: 'Mathematics', exam: 'SSC CGL', quizName: 'PYQ', concept: 'Addition', question: `Solve the equation: x + ${i + 1} = ${i + 3}. What is x?`, options: ['1', '2', '3', '4'], correctAnswer: 'B', solution: 'Subtract the constant from both sides to get x = 2.', difficulty: 'easy', expectedTime: 60 };
  return { ...row, ...normalizedQuestionKeys(row), ...trainingQuestionMetadata(row) };
}));
const { createTrainingSessionCommand } = await import('../services/training/application/createTrainingSession.js');
const { session: trainingSession } = await createTrainingSessionCommand('browser-lighthouse', { mode: 'adaptive', exam: 'ssc-cgl', tier: '1', count: 10, minutes: 10 }, Date.now());
await db.collection('trainingSessions').updateOne({ id: trainingSession.id }, { $set: { id: 'lighthouse-training', deadline: new Date(Date.now() + 3600000).toISOString() } });
const questions = ['ga', 'reasoning', 'quant', 'english'].flatMap(sectionKey => Array.from({ length: 25 }, (_, index) => ({
  id: `${sectionKey}-${index}`, sectionKey, question: `Two plus two? ${index + 1}`, options: ['three', 'four', 'five', 'six'], correctAnswer: 'B', solution: 'Private worked solution',
})));
await db.collection('mockSlots').insertOne({ id: 'browser-test', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', title: 'Browser assessment', assessmentMode: 'confidential', timingPolicy: 'composite', fixedQuestions: questions });
const app = express(); app.use(express.json()); app.use(cookieParser()); app.use(passport.initialize());
app.get('/live', (_req, res) => res.json({ ok: true }));
// Use real refresh rotation so each browser keeps its own identity and attempts.
app.use('/auth', auth); app.use('/api/mocktest', mocktest);
app.use('/api/training', (await import('../routes/training.js')).default);
const { fetchQuestions, fetchQuestionsSession, fetchQuestionsMeta, fetchQuestionCounts } = await import('../services/questionService.js');
app.get('/api/questions', async (req, res) => res.json(await fetchQuestions(req.query)));
app.get('/api/questions/session', async (req, res) => res.json(await fetchQuestionsSession(req.query)));
app.get('/api/questions/meta', async (req, res) => res.json(await fetchQuestionsMeta(req.query)));
app.get('/api/questions/counts', async (req, res) => res.json(await fetchQuestionCounts(req.query)));
app.patch('/users/me/usage', protect, (_req, res) => res.json({ ok: true }));
app.patch('/users/me/recent-quizzes', protect, (_req, res) => res.json({ ok: true }));
app.get('/users/me', protect, async (req, res) => res.json(await db.collection('users').findOne({ id: req.user.id }, { projection: { passwordHash: 0, _id: 0 } })));
app.use((_req, res) => res.status(404).json({ error: 'Fixture route not found' }));
const server = app.listen(3111, '127.0.0.1');
let stopping = false;
async function stop() { if (stopping) return; stopping = true; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); }
process.once('SIGTERM', () => void stop()); process.once('SIGINT', () => void stop());
