import { requestLogging } from './infrastructure/logger.js';
import { checkReadiness } from './infrastructure/readiness.js';
import { requestBodyLimits } from './middleware/requestBodyLimits.js';

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';

import { errorHandler } from './middleware/errorHandler.js';
import {
  globalLimiter,
  authLimiter,
  aiLimiter,
  agentLimiter,
  uploadLimiter,
} from './middleware/rateLimiter.js';

import passport from './auth/passport.js';
import { initAuthRoutes } from './routes/auth.routes.js';
import { initUserRoutes } from './routes/user.routes.js';

import questionRoutes from './routes/questionRoutes.js';
import mocktestRoutes from './routes/mocktest.js';
import imageUploadRoutes from './routes/imageUpload.js';
import massUploadImages from './routes/massUploadImages.js';
import massUploadSolutions from './routes/massUploadSolutions.js';
import accessCodeRoutes from './routes/accessCodes.js';

export async function createApp({ isReady, isShuttingDown, quizOnlyMode = process.env.QUIZ_ONLY_MODE === 'true' }) {
  const app = express();
  app.use(requestLogging);
  app.set('trust proxy', 1);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
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

  const corsOrigin = (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  };

  const corsOptions = {
    origin: corsOrigin,
    credentials: true,
  };

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors(corsOptions));
  app.options(/(.*)/, cors(corsOptions));
  app.use(compression());
  app.use(requestBodyLimits);
  app.use(cookieParser());

  // Keep legacy question images readable while their stored references are migrated.
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use(globalLimiter);
  app.use(passport.initialize());

  app.get('/', (_req, res) =>
    res.send(quizOnlyMode ? 'Quiz API running' : 'Server running 🚀'),
  );

  const healthCheck = async (_req, res) => {
    let healthy = isReady() && !isShuttingDown();
    if (healthy) {
      try {
        await checkReadiness();
      } catch {
        healthy = false;
      }
    }

    return res.status(healthy ? 200 : 503).json({
      ok: healthy,
      state: isShuttingDown() ? 'draining' : healthy ? 'ready' : 'starting',
      service: 'backend',
      mode: quizOnlyMode ? 'quiz-only' : 'full',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/live', (_req, res) => res.json({ ok: true, mode: quizOnlyMode ? 'quiz-only' : 'full' }));
  app.get('/health', healthCheck);
  app.get('/api/health', healthCheck);

  app.use((req, res, next) => {
    if (!isShuttingDown()) return next();
    return res.status(503).json({ ok: false, state: 'draining' });
  });

  // Quiz-essential routes. These remain available on the Azure Free F1 runtime.
  app.use('/api/questions', questionRoutes);
  app.use('/api/mocktest', mocktestRoutes);
  app.use('/api/upload', uploadLimiter, imageUploadRoutes);
  app.use('/api', uploadLimiter, massUploadImages);
  app.use('/api', uploadLimiter, massUploadSolutions);
  app.use('/auth', authLimiter, initAuthRoutes());
  app.use('/users', initUserRoutes());
  app.use('/api/access-code', authLimiter, accessCodeRoutes);

  if (!quizOnlyMode) {
    const [
      { default: aiRoutes },
      { default: cognitiveMapperRouter },
      { default: adaptiveQuizRouter },
      { default: uploadNoteImageRoutes },
      { default: notesRoutes },
      { default: pdfRoutes },
      { default: adminUsersRoutes },
      { default: notificationRoutes },
      { default: examUpdatesRouter },
      { default: battleRoutes },
    ] = await Promise.all([
      import('./routes/aiRoutes.js'),
      import('./agents/cognitiveMapperRouter.js'),
      import('./agents/adaptiveQuiz/adaptiveQuizRouter.js'),
      import('./routes/uploadNoteImage.js'),
      import('./routes/notes.routes.js'),
      import('./routes/pdfs.js'),
      import('./routes/adminUsers.routes.js'),
      import('./routes/notifications.routes.js'),
      import('./routes/examUpdates.routes.js'),
      import('./routes/battle.routes.js'),
    ]);

    app.use('/api/ai', aiLimiter, aiRoutes);
    app.use('/api/agent', agentLimiter, cognitiveMapperRouter);
    app.use('/api/adaptive-quiz', agentLimiter, adaptiveQuizRouter);
    app.use('/api/upload-note-image', uploadLimiter, uploadNoteImageRoutes);
    app.use('/api/notes', notesRoutes);
    app.use('/api/pdfs', pdfRoutes);
    app.use('/api/admin', adminUsersRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/exam-updates', examUpdatesRouter);
    app.use('/api/battle', battleRoutes);
  }

  app.use(errorHandler);

  return { app, corsOrigin };
}
