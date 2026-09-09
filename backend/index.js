import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { initPassport } from './auth/passport.js';
import { initBattleSocket } from './battle/battleSocket.js';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import { setNotificationRealtimeServer } from './services/notificationRealtime.js';
import { checkReadiness } from './infrastructure/readiness.js';
import { startRuntimeMetrics, logger } from './infrastructure/logger.js';
import { startBattleOutbox } from './infrastructure/battleOutbox.js';
import { startWorkers, stopWorkers } from './infrastructure/workerRegistry.js';
import {
  startAttachmentWorker,
  stopAttachmentWorker,
  waitForAttachmentWorkerIdle,
} from './infrastructure/attachmentWorker.js';
let socketServer = null, httpServer;
let isShuttingDown = false, isReady = false;
let stopBattleOutbox;
const stopMetrics = startRuntimeMetrics();
const runEmbeddedWorkers = process.env.RUN_EMBEDDED_WORKERS !== 'false';
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
    if (runEmbeddedWorkers) {
      stopAttachmentWorker();
      const [, , attachmentIdle] = await Promise.all([
        stopWorkers(),
        stopBattleOutbox?.(),
        waitForAttachmentWorkerIdle(12_000),
      ]);
      if (!attachmentIdle) {
        throw new Error('Attachment worker failed to drain');
      }
    }

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
    } else if (httpServer?.listening) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
      console.log('HTTP server closed ✅');
    }

    stopMetrics();
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

    await checkReadiness();

    // ── Authentication ─────────────────────────────────

    initPassport();
    const { app, corsOrigin } = createApp({ isReady: () => isReady, isShuttingDown: () => isShuttingDown });
    httpServer = createServer(app);


    // ── Socket.IO ──────────────────────────────────────

    socketServer = initBattleSocket(
      httpServer,
      corsOrigin
    );

    if (runEmbeddedWorkers) {
      await startWorkers();

      if (isShuttingDown) {
        return;
      }

      stopBattleOutbox = startBattleOutbox({ localApi: true });
      await startAttachmentWorker();

      if (isShuttingDown) {
        return;
      }

      logger.info('Embedded maintenance and attachment workers ready');
    }

    // ── Routes ─────────────────────────────────────────

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

    if (isShuttingDown) {
      return;
    }

    logger.error({ err }, 'API startup failed');

    await gracefulShutdown('startup failure', 1);
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
