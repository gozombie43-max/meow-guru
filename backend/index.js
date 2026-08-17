// backend/index.js
import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { globalLimiter, authLimiter, aiLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import passport from './auth/passport.js';
import { initPassport } from './auth/passport.js';
import { initDB, initUsersDB, initNotesDB, initAccessCodesDB, initMockAttemptsDB, initMockSlotsDB } from './cosmos.js';
import { initAuthRoutes } from './routes/auth.routes.js';
import { initUserRoutes } from './routes/user.routes.js';
import questionRoutes from './routes/questionRoutes.js';
import mocktestRoutes from './routes/mocktest.js';
import notesRoutes from './routes/notes.routes.js';
import imageUploadRoutes from './routes/imageUpload.js';
import uploadNoteImageRoutes from './routes/uploadNoteImage.js';
import massUploadImages from './routes/massUploadImages.js';
import massUploadSolutions from './routes/massUploadSolutions.js';
import aiRoutes from './routes/aiRoutes.js';
import videoRoutes from './routes/videos.js';
import pdfRoutes from './routes/pdfs.js';
import accessCodeRoutes from './routes/accessCodes.js';
import cognitiveMapperRouter from './agents/cognitiveMapperRouter.js';
import adaptiveQuizRouter from './agents/adaptiveQuiz/adaptiveQuizRouter.js';
import { setQuestionsContainer, setUsersContainer, setNotesContainer, setAccessCodesContainer, setMockAttemptsContainer, setMockSlotsContainer } from './containerStore.js';
import { initBattleSocket } from './battle/battleSocket.js';

const app = express();
const httpServer = createServer(app);
const isProd = process.env.NODE_ENV === 'production';
app.set('trust proxy', 1);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'null',
  'https://brave-island-0a237e400.6.azurestaticapps.net',
]);

const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/\[::1\]:\d+$/,
];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
};

const corsOrigin = (origin, cb) => {
  if (isOriginAllowed(origin)) return cb(null, true);
  return cb(new Error('Not allowed by CORS'));
};

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
};

// ── Middleware ──────────────────────────────────────────
// CORS must be first — before every other middleware
app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions)); // handle preflight for all routes

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(globalLimiter);

app.use(passport.initialize());

// ── Health checks ──────────────────────────────────────
let isReady = false;
app.get('/', (req, res) => res.send('Server running 🚀'));
const healthCheck = (req, res) => {
  res.status(isReady ? 200 : 503).json({
    ok: isReady,
    service: 'backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

const PORT = process.env.PORT || 10000;

// ── Retry helper ───────────────────────────────────────
async function connectWithRetry(fn, name, retries = 5, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fn();
      console.log(`${name} Connected ✅`);
      return result;
    } catch (err) {
      console.warn(`${name} attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`${name} failed after ${retries} retries`);
}

// ── Init DB + Routes, then start listening ───────────
async function initWithRetry() {
  try {
    const questionsContainer    = await connectWithRetry(initDB, 'Questions DB');
    const usersContainer       = await connectWithRetry(initUsersDB, 'Users DB');
    const notesContainer       = await connectWithRetry(initNotesDB, 'Notes DB');
    const accessCodesContainer = await connectWithRetry(initAccessCodesDB, 'Access Codes DB');
    const mockAttemptsContainer = await connectWithRetry(initMockAttemptsDB, 'Mock Attempts DB');
    const mockSlotsContainer    = await connectWithRetry(initMockSlotsDB, 'Mock Slots DB');

    setQuestionsContainer(questionsContainer);
    setUsersContainer(usersContainer);
    setNotesContainer(notesContainer);
    setAccessCodesContainer(accessCodesContainer);
    setMockAttemptsContainer(mockAttemptsContainer);
    setMockSlotsContainer(mockSlotsContainer);

    initPassport(usersContainer);

    initBattleSocket(httpServer, corsOrigin);

    app.use('/api/questions', questionRoutes);
    app.use('/api/mocktest', mocktestRoutes);
    app.use('/api/ai', aiLimiter, aiRoutes);
    app.use('/api/agent', cognitiveMapperRouter);
    app.use('/api/adaptive-quiz', adaptiveQuizRouter);
    app.use('/api/upload', uploadLimiter, imageUploadRoutes);
    app.use('/api', massUploadImages);
    app.use('/api', massUploadSolutions);
    app.use('/api/upload-note-image', uploadLimiter, uploadNoteImageRoutes);
    app.use('/api/notes', notesRoutes);
    app.use('/auth', authLimiter, initAuthRoutes(usersContainer));
    app.use('/users', initUserRoutes(usersContainer));
    app.use('/api/videos', videoRoutes);
    app.use('/api/pdfs', pdfRoutes);
    app.use('/api/access-code', accessCodeRoutes);

    // Global error handler — must be registered AFTER all routes
    app.use(errorHandler);

    console.log('All routes registered ✅');
    isReady = true;

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT} 🚀`);
    });

  } catch (err) {
    console.error('DB init failed ❌', err.message);
    process.exit(1);
  }
}

initWithRetry();
