// backend/index.js

import 'dotenv/config';

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

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

import cognitiveMapperRouter from './agents/cognitiveMapperRouter.js';
import adaptiveQuizRouter from './agents/adaptiveQuiz/adaptiveQuizRouter.js';

import {
  initBattleSocket,
} from './battle/battleSocket.js';

import {
  connectMongoDB,
} from './config/mongodb.js';


const app = express();

const httpServer =
  createServer(app);

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
  return res
    .status(
      isReady
        ? 200
        : 503
    )
    .json({
      ok:
        isReady,

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

const PORT =
  process.env.PORT ||
  10000;


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


    // ── Authentication ─────────────────────────────────

    initPassport();


    // ── Socket.IO ──────────────────────────────────────

    initBattleSocket(
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

    console.error(
      'Server initialization failed ❌',
      err
    );

    process.exit(1);
  }
}

initWithRetry();