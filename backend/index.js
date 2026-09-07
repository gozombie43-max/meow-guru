// backend/index.js

import 'dotenv/config';

import { createServer } from 'http';
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

import passport, {
  initPassport,
} from './auth/passport.js';

import {
  initAuthRoutes,
} from './routes/auth.routes.js';

import {
  initUserRoutes,
} from './routes/user.routes.js';

import questionRoutes from './routes/questionRoutes.js';
import mocktestRoutes from './routes/mocktest.js';
import notesRoutes from './routes/notes.routes.js';
import imageUploadRoutes from './routes/imageUpload.js';
import uploadNoteImageRoutes from './routes/uploadNoteImage.js';
import massUploadImages from './routes/massUploadImages.js';
import massUploadSolutions from './routes/massUploadSolutions.js';
import aiRoutes from './routes/aiRoutes.js';
import pdfRoutes from './routes/pdfs.js';
import accessCodeRoutes from './routes/accessCodes.js';
import notificationRoutes from "./routes/notifications.routes.js";
import examUpdatesRouter from "./routes/examUpdates.routes.js";
import battleRoutes from "./routes/battle.routes.js";

import cognitiveMapperRouter from './agents/cognitiveMapperRouter.js';
import adaptiveQuizRouter from './agents/adaptiveQuiz/adaptiveQuizRouter.js';

import adminUsersRoutes from './routes/adminUsers.routes.js';

import {
  initBattleSocket,
} from './battle/battleSocket.js';

import {
  connectMongoDB,
  disconnectMongoDB,
} from './config/mongodb.js';

import {
  startScheduledNotificationWorker,
  stopScheduledNotificationWorker,
  waitForScheduledNotificationWorkerIdle,
} from './services/scheduledNotificationWorker.js';

import {
  startDailyPracticeReminderWorker,
  stopDailyPracticeReminderWorker,
  waitForDailyPracticeReminderWorkerIdle,
} from './services/dailyPracticeReminderWorker.js';

import {
  startStreakProtectionWorker,
  stopStreakProtectionWorker,
  waitForStreakProtectionWorkerIdle,
} from './services/streakProtectionWorker.js';

import {
  startBattlePresenceWorker,
  stopBattlePresenceWorker,
  waitForBattlePresenceWorkerIdle,
} from './services/battlePresenceWorker.js';
import {
  startBattleMatchmakingWorker,
  stopBattleMatchmakingWorker,
  waitForBattleMatchmakingWorkerIdle,
} from './services/battleMatchmakingWorker.js';
import {
  startBattleSeasonWorker,
  stopBattleSeasonWorker,
  waitForBattleSeasonWorkerIdle,
} from './services/battleSeasonWorker.js';

import {
  setNotificationRealtimeServer,
} from './services/notificationRealtime.js';


const app = express();

const httpServer =
  createServer(app);

let socketServer = null;
let isShuttingDown = false;

app.set('trust proxy', 1);

const __dirname =
  path.dirname(
    fileURLToPath(
      import.meta.url
    )
  );


// ───────────────────────────────────────────────────────
// CORS
// ───────────────────────────────────────────────────────

const allowedOrigins =
  new Set([
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'http://localhost:5500',

    ...(process.env.FRONTEND_URL
      ? [
          process.env.FRONTEND_URL,
        ]
      : []),
  ]);

const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/\[::1\]:\d+$/,
];

const isOriginAllowed = (
  origin
) => {
  if (!origin) {
    return true;
  }

  if (
    allowedOrigins.has(
      origin
    )
  ) {
    return true;
  }

  return allowedOriginPatterns.some(
    (pattern) =>
      pattern.test(origin)
  );
};

const corsOrigin = (
  origin,
  callback
) => {
  if (
    isOriginAllowed(origin)
  ) {
    return callback(
      null,
      true
    );
  }

  return callback(
    new Error(
      'Not allowed by CORS'
    )
  );
};

const corsOptions = {
  origin:
    corsOrigin,

  credentials:
    true,
};


// ───────────────────────────────────────────────────────
// Middleware
// ───────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy:
      false,

    crossOriginResourcePolicy: {
      policy:
        'cross-origin',
    },
  })
);

app.use(
  cors(corsOptions)
);

app.options(
  /(.*)/,
  cors(corsOptions)
);

app.use(compression());

app.use(
  express.json({
    limit:
      '10mb',
  })
);

app.use(
  cookieParser()
);

app.use(
  '/uploads',
  express.static(
    path.join(
      __dirname,
      'uploads'
    )
  )
);

app.use(
  globalLimiter
);

app.use(
  passport.initialize()
);


// ───────────────────────────────────────────────────────
// Health checks
// ───────────────────────────────────────────────────────

let isReady = false;

app.get(
  '/',
  (req, res) =>
    res.send(
      'Server running 🚀'
    )
);

const healthCheck = (
  req,
  res
) => {
  const healthy =
    isReady &&
    !isShuttingDown;

  return res
    .status(
      healthy
        ? 200
        : 503
    )
    .json({
      ok:
        healthy,

      state:
        isShuttingDown
          ? 'draining'
          : isReady
            ? 'ready'
            : 'starting',

      service:
        'backend',

      uptimeSeconds:
        Math.round(
          process.uptime()
        ),

      timestamp:
        new Date()
          .toISOString(),
    });
};

app.get(
  '/health',
  healthCheck
);

app.get(
  '/api/health',
  healthCheck
);

app.use((req, res, next) => {
  if (!isShuttingDown) {
    return next();
  }

  return res.status(503).json({
    ok: false,
    state: 'draining',
  });
});

const PORT =
  process.env.PORT ||
  10000;

const SHUTDOWN_TIMEOUT_MS =
  Number(process.env.SHUTDOWN_TIMEOUT_MS) ||
  20_000;

async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  isReady = false;

  console.log(`${signal} received — starting graceful shutdown`);

  const forceTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out ❌');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceTimer.unref();

  try {
    stopScheduledNotificationWorker();
    stopDailyPracticeReminderWorker();
    stopStreakProtectionWorker();
    stopBattlePresenceWorker();
    stopBattleMatchmakingWorker();
    stopBattleSeasonWorker();
    console.log('Notification worker timers stopped');

    if (socketServer) {
      try {
        socketServer.emit('server:shutdown', {
          message: 'Server is restarting.',
          retryAfterMs: 3000,
        });
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        console.warn('Socket shutdown notice failed:', error);
      }
    }

    if (socketServer) {
      const closingIo = socketServer;
      socketServer = null;

      await new Promise((resolve) => {
        closingIo.close(resolve);
      });

      setNotificationRealtimeServer(null);
      console.log('HTTP + Socket.IO closed ✅');
    } else if (httpServer.listening) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
      console.log('HTTP server closed ✅');
    }

    const [scheduledIdle, dailyIdle, streakIdle, battlePresenceIdle, battleMatchmakingIdle, battleSeasonIdle] = await Promise.all([
      waitForScheduledNotificationWorkerIdle(12_000),
      waitForDailyPracticeReminderWorkerIdle(12_000),
      waitForStreakProtectionWorkerIdle(12_000),
      waitForBattlePresenceWorkerIdle(12_000),
      waitForBattleMatchmakingWorkerIdle(12_000),
      waitForBattleSeasonWorkerIdle(12_000),
    ]);

    console.log('Worker drain:', {
      scheduledIdle,
      dailyIdle,
      streakIdle,
      battlePresenceIdle,
      battleMatchmakingIdle,
      battleSeasonIdle,
    });

    if (!scheduledIdle || !dailyIdle || !streakIdle || !battlePresenceIdle || !battleMatchmakingIdle || !battleSeasonIdle) {
      console.warn('One or more workers did not drain before timeout');
    }

    await disconnectMongoDB();
    console.log('Graceful shutdown complete ✅');

    clearTimeout(forceTimer);
    process.exit(exitCode);
  } catch (error) {
    console.error('Graceful shutdown failed:', error);
    clearTimeout(forceTimer);
    process.exit(1);
  }
}


// ───────────────────────────────────────────────────────
// Retry helper
// ───────────────────────────────────────────────────────

async function connectWithRetry(
  fn,
  name,
  retries = 5,
  delay = 3000
) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= retries;
    attempt++
  ) {
    try {
      const result =
        await fn();

      console.log(
        `${name} Connected ✅`
      );

      return result;

    } catch (err) {
      lastError = err;

      console.warn(
        `${name} attempt ${attempt}/${retries} failed: ${err.message}`
      );

      if (
        attempt < retries
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              delay
            )
        );
      }
    }
  }

  throw (
    lastError ||
    new Error(
      `${name} failed after ${retries} retries`
    )
  );
}


// ───────────────────────────────────────────────────────
// Application initialization
// ───────────────────────────────────────────────────────

async function initWithRetry() {
  try {

    // MongoDB must be connected before
    // Passport/routes begin using collections.
    await connectWithRetry(
      connectMongoDB,
      'MongoDB Atlas'
    );

    if (isShuttingDown) {
      return;
    }

    // ── Authentication ─────────────────────────────────

    initPassport();


    // ── Socket.IO ──────────────────────────────────────

    socketServer = initBattleSocket(
      httpServer,
      corsOrigin
    );


    // ── Routes ─────────────────────────────────────────

    app.use(
      '/api/questions',
      questionRoutes
    );

    app.use(
      '/api/mocktest',
      mocktestRoutes
    );

    app.use(
      '/api/ai',
      aiLimiter,
      aiRoutes
    );

    app.use(
      '/api/agent',
      agentLimiter,
      cognitiveMapperRouter
    );

    app.use(
      '/api/adaptive-quiz',
      agentLimiter,
      adaptiveQuizRouter
    );

    app.use(
      '/api/upload',
      uploadLimiter,
      imageUploadRoutes
    );

    app.use(
      '/api',
      uploadLimiter,
      massUploadImages
    );

    app.use(
      '/api',
      uploadLimiter,
      massUploadSolutions
    );

    app.use(
      '/api/upload-note-image',
      uploadLimiter,
      uploadNoteImageRoutes
    );

    app.use(
      '/api/notes',
      notesRoutes
    );

    app.use(
      '/auth',
      authLimiter,
      initAuthRoutes()
    );

    app.use(
      '/users',
      initUserRoutes()
    );

    app.use(
      '/api/pdfs',
      pdfRoutes
    );

    app.use(
      '/api/access-code',
      authLimiter,
      accessCodeRoutes
    );

    app.use(
      '/api/admin',
      adminUsersRoutes
    );

    app.use(
      "/api/notifications",
      notificationRoutes
    );

    app.use(
      "/api/exam-updates",
      examUpdatesRouter
    );

    app.use("/api/battle", battleRoutes);


    // Global error handler must remain last
    app.use(
      errorHandler
    );

    console.log(
      'All routes registered ✅'
    );


    // Only healthy after database + routes
    // have successfully initialized.
    isReady = true;

    await startScheduledNotificationWorker();

    if (isShuttingDown) {
      return;
    }

    await startDailyPracticeReminderWorker();

    if (isShuttingDown) {
      return;
    }

    await startStreakProtectionWorker();

    if (isShuttingDown) {
      return;
    }

    await startBattlePresenceWorker();

    if (isShuttingDown) {
      return;
    }

    await startBattleMatchmakingWorker();

    if (isShuttingDown) {
      return;
    }

    await startBattleSeasonWorker();

    if (isShuttingDown) {
      return;
    }

    httpServer.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `Server running on port ${PORT} 🚀`
        );
      }
    );

  } catch (err) {
    isReady = false;

    if (isShuttingDown) {
      return;
    }

    console.error(
      'Server initialization failed ❌',
      err
    );

    process.exit(1);
  }
}

process.once('SIGTERM', () => {
  void gracefulShutdown('SIGTERM', 0);
});

process.once('SIGINT', () => {
  void gracefulShutdown('SIGINT', 0);
});

process.once('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  void gracefulShutdown('uncaughtException', 1);
});

process.once('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  void gracefulShutdown('unhandledRejection', 1);
});

initWithRetry();
