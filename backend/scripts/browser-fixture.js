// Local-only disposable fixture. Never imports .env files or connects to Atlas.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { generateKeyPairSync } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.METRICS_TOKEN = 'local-browser-metrics-not-for-deployment';
process.env.JWT_SECRET = 'local-browser-access-secret-not-for-deployment';
process.env.REFRESH_TOKEN_SECRET = 'local-browser-refresh-secret-not-for-deployment';
process.env.DEPLOYMENT_ENVIRONMENT = 'test';
process.env.REDIS_URL = '';
process.env.BACKEND_PUBLIC_URL = '';
process.env.B2_ENDPOINT = 'http://127.0.0.1:3112';
process.env.B2_REGION = 'fixture';
process.env.B2_ACCESS_KEY_ID = 'fixture-access-key';
process.env.B2_SECRET_ACCESS_KEY = 'fixture-storage-secret';
process.env.B2_BUCKET = 'note-fixture';
process.env.GOOGLE_CLIENT_ID = 'fixture'; process.env.GOOGLE_CLIENT_SECRET = 'fixture';
process.env.GOOGLE_CALLBACK_URL = 'http://127.0.0.1:3111/auth/google/callback';
process.env.FIREBASE_PROJECT_ID = 'browser-fixture'; process.env.FIREBASE_CLIENT_EMAIL = 'fixture@example.test';
process.env.FIREBASE_PRIVATE_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = mongo.getUri(); process.env.MONGODB_DB = 'browser_fixture';
const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
const db = await connectMongoDB();
const { migrate } = await import('../migrations/runner.js'); await migrate(db);
const { initPassport } = await import('../auth/passport.js'); initPassport();
const { default: passport } = await import('../auth/passport.js');
const { default: auth } = await import('../routes/auth.routes.js');
const { default: mocktest } = await import('../routes/mocktest.js');
const { default: progress } = await import('../routes/progress.routes.js');
const { default: questionsRouter } = await import('../routes/questionRoutes.js');
const { protect } = await import('../middleware/protect.js');
const { getMe, getRecentQuiz, updateRecentQuizzes, getAiChats, getAiChat, appendAiMessages, updateAiChat, deleteAiChat } = await import('../controllers/userController.js');
const passwordHash = await bcrypt.hash('Browser-fixture-123!', 4);
await db.collection('users').insertMany(['desktop', 'mobile', 'lighthouse', 'performance-desktop', 'performance-mobile', 'admin', 'superadmin'].map(device => ({ id: `browser-${device}`, name: 'Browser Student', email: `browser-${device}@example.test`, passwordHash, role: ['admin', 'superadmin'].includes(device) ? device : 'student', progress: {}, bookmarks: [], recentQuizzes: [{ quizKey: 'mathematics:algebra', title: 'Algebra', subject: 'mathematics', href: '/mathematics/advance/algebra/quiz', mode: 'concept', totalQuestions: 250, currentIndex: 0, status: 'in-progress', selectedAnswers: {}, submittedQuestions: [] }] })));
const { migrateUserHistory } = await import('../repositories/userHistoryRepository.js');
for (const user of await db.collection('users').find({}).toArray()) await migrateUserHistory(db, user, { apply: true });
const { normalizedQuestionKeys } = await import('../services/questions/questionNormalizer.js');
const { trainingQuestionMetadata } = await import('../services/training/domain/questionMetadata.js');
await db.collection('questions').insertMany(Array.from({ length: 250 }, (_, i) => {
  const row = { id: `fixture-${i}`, topic: 'algebra', subject: 'Mathematics', exam: 'SSC CGL', quizName: 'PYQ', concept: 'Addition', question: `Solve the equation: x + ${i + 1} = ${i + 3}. What is x?`, options: ['1', '2', '3', '4'], correctAnswer: 'B', solution: 'Subtract the constant from both sides to get x = 2.', difficulty: 'easy', expectedTime: 60 };
  return { ...row, ...normalizedQuestionKeys(row), ...trainingQuestionMetadata(row) };
}));
const { initializePublicCatalogs } = await import('../services/questions/topicCountSnapshot.js');
await initializePublicCatalogs();
const { createTrainingSessionCommand } = await import('../services/training/application/createTrainingSession.js');
const { session: trainingSession } = await createTrainingSessionCommand('browser-lighthouse', { mode: 'adaptive', exam: 'ssc-cgl', tier: '1', count: 10, minutes: 10 }, Date.now());
await db.collection('trainingSessions').updateOne({ id: trainingSession.id }, { $set: { id: 'lighthouse-training', deadline: new Date(Date.now() + 3600000).toISOString() } });
const questions = ['ga', 'reasoning', 'quant', 'english'].flatMap(sectionKey => Array.from({ length: 25 }, (_, index) => ({
  id: `${sectionKey}-${index}`, sectionKey, question: `Two plus two? ${index + 1}`, options: ['three', 'four', 'five', 'six'], correctAnswer: 'B', solution: 'Private worked solution',
})));
await db.collection('mockSlots').insertOne({ id: 'browser-test', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', title: 'Browser assessment', assessmentMode: 'confidential', timingPolicy: 'composite', fixedQuestions: questions });
const { requestLogging } = await import('../infrastructure/logger.js');
const { metricsHandler } = await import('../infrastructure/metrics.js');
const app = express(); app.use(requestLogging); app.use(express.json()); app.use(cookieParser()); app.use(passport.initialize());
app.get('/metrics', metricsHandler);
// Disposable S3-compatible storage: real SDK requests stay entirely on loopback.
const storageObjects = new Map();
const storageApp = express();
storageApp.put('/{*key}', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
  storageObjects.set(req.path, { body: req.body, type: req.get('Content-Type') });
  res.set('ETag', '"fixture"').status(200).end();
});
storageApp.get('/{*key}', (req, res) => {
  const object = storageObjects.get(req.path);
  if (!object) return res.status(404).end();
  return res.type(object.type || 'application/octet-stream').send(object.body);
});
const storageServer = storageApp.listen(3112, '127.0.0.1');
app.use('/api/notes', (await import('../routes/notes.routes.js')).default);
app.use('/api/upload-note-image', (await import('../routes/uploadNoteImage.js')).default);
app.use('/api/upload', (await import('../routes/imageUpload.js')).default);
app.get('/live', (_req, res) => res.json({ ok: true }));
// Use real refresh rotation so each browser keeps its own identity and attempts.
app.use('/auth', auth); app.use('/api/mocktest', mocktest);
app.use('/api/training', (await import('../routes/training.js')).default);
app.use('/api/progress', progress);
const { fetchQuestions, fetchQuestionsSession, fetchQuestionsMeta, fetchQuestionCounts } = await import('../services/questionService.js');
const { fetchTopicCountSnapshot } = await import('../services/questions/topicCountSnapshot.js');
app.get('/api/questions', async (req, res) => res.json(await fetchQuestions(req.query)));
app.get('/api/questions/session', async (req, res) => res.json(await fetchQuestionsSession(req.query)));
app.get('/api/questions/meta', async (req, res) => res.json(await fetchQuestionsMeta(req.query)));
app.get('/api/questions/counts', async (req, res) => res.json(await fetchQuestionCounts(req.query)));
app.use('/api/questions', questionsRouter);
app.get('/api/questions/topic-counts', async (req, res) => {
  try {
    res.json(await fetchTopicCountSnapshot(req.query.subject));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});
app.patch('/users/me/usage', protect, (_req, res) => res.json({ ok: true }));
app.patch('/users/me/recent-quizzes', protect, updateRecentQuizzes);
app.get('/users/me/recent-quizzes/:quizKey', protect, getRecentQuiz);
app.get('/users/me', protect, getMe);
app.get('/users/me/ai-chats', protect, getAiChats);
app.get('/users/me/ai-chats/:chatId', protect, getAiChat);
app.post('/users/me/ai-chats/:chatId/messages', protect, appendAiMessages);
app.put('/users/me/ai-chats/:chatId', protect, updateAiChat);
app.delete('/users/me/ai-chats/:chatId', protect, deleteAiChat);
app.use((_req, res) => res.status(404).json({ error: 'Fixture route not found' }));
const server = app.listen(3111, '127.0.0.1');
let stopping = false;
async function stop() { if (stopping) return; stopping = true; server.closeAllConnections(); storageServer.closeAllConnections(); await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => storageServer.close(resolve))]); await disconnectMongoDB(); await mongo.stop(); }
process.once('SIGTERM', () => void stop()); process.once('SIGINT', () => void stop());
// Owned local harnesses can stop Mongo cleanly on Windows through Node IPC.
process.on('message', message => {
  if (message === 'stop') void stop().finally(() => process.disconnect?.());
});
