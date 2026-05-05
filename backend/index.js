// backend/index.js
import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from './auth/passport.js';
import { initPassport } from './auth/passport.js';
import { initDB, initUsersDB, initNotesDB } from './cosmos.js';
import { initAuthRoutes } from './routes/auth.routes.js';
import { initUserRoutes } from './routes/user.routes.js';
import questionRoutes from './routes/questionRoutes.js';
import notesRoutes from './routes/notes.routes.js';
import imageUploadRoutes from './routes/imageUpload.js';
import uploadNoteImageRoutes from './routes/uploadNoteImage.js';
import massUploadImages from './routes/massUploadImages.js';
import massUploadSolutions from './routes/massUploadSolutions.js';
import aiRoutes from './routes/aiRoutes.js';
import { setQuestionsContainer, setUsersContainer, setNotesContainer } from './containerStore.js';
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

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// ── Middleware ──────────────────────────────────────────
// CORS must be first — before every other middleware
app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions)); // handle preflight for all routes

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());

// ── Health checks ──────────────────────────────────────
app.get('/', (req, res) => res.send('Server running 🚀'));
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'backend',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── Start server ───────────────────────────────────────
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

// ── Init DB + Routes after server is up ───────────────
async function initWithRetry() {
  try {
    const questionsContainer = await connectWithRetry(initDB, 'Questions DB');
    const usersContainer     = await connectWithRetry(initUsersDB, 'Users DB');
    const notesContainer     = await connectWithRetry(initNotesDB, 'Notes DB');

    setQuestionsContainer(questionsContainer);
    setUsersContainer(usersContainer);
    setNotesContainer(notesContainer);

    initPassport(usersContainer);

    initBattleSocket(httpServer, allowedOrigins);

    app.use('/api/questions', questionRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/upload', imageUploadRoutes);
    app.use('/api', massUploadImages);
    app.use('/api', massUploadSolutions);
    app.use('/api/upload-note-image', uploadNoteImageRoutes);
    app.use('/api/notes', notesRoutes);
    app.use('/auth', initAuthRoutes(usersContainer));
    app.use('/users', initUserRoutes(usersContainer));

    console.log('All routes registered ✅');

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT} 🚀`);
    });

  } catch (err) {
    console.error('DB init failed ❌', err.message);
  }
}

initWithRetry();
