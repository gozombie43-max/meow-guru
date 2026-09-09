import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { initPassport } from './auth/passport.js';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import { checkReadiness } from './infrastructure/readiness.js';
import { startRuntimeMetrics, logger } from './infrastructure/logger.js';

let socketServer = null, httpServer;
let isShuttingDown = false, isReady = false;
let stopBattleOutbox;
let stopWorkers;
let stopAttachmentWorker;
let waitForAttachmentWorkerIdle;
let setNotificationRealtimeServer;

const quizOnlyMode = process.env.QUIZ_ONLY_MODE === 'true';
const runEmbeddedWorkers = !quizOnlyMode && process.env.RUN_EMBEDDED_WORKERS !== 'false';
const stopMetrics = quizOnlyMode ? () => {} : startRuntimeMetrics();
const PORT = process.env.PORT || 10000;

const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 20_000;

async function gracefulShutdown(signal, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  isReady = false;

  logger.info({ signal, quizOnlyMode }, 'starting graceful shutdown');

  const forceTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceTimer.unref();

  try {
    if (runEmbeddedWorkers && stopWorkers && stopAttachmentWorker && waitForAttachmentWorkerIdle) {
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
        logger.warn({ err: error }, 'Socket shutdown notice failed');
      }

      const closingIo = socketServer;
      socketServer = null;

      await new Promise((resolve) => {
        closingIo.close(resolve);
      });

      setNotificationRealtimeServer?.(null);
      logger.info('HTTP + Socket.IO closed');
    } else if (httpServer?.listening) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
      logger.info('HTTP server closed');
    }

    stopMetrics();
    await disconnectMongoDB();
    logger.info('Graceful shutdown complete');

    clearTimeout(forceTimer);
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, 'Graceful shutdown failed');
    clearTimeout(forceTimer);
    process.exit(1);
  }
}

async function connectWithRetry(fn, name, retries = 5, delay = 3000) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      logger.info({ dependency: name }, 'dependency connected');
      return result;
    } catch (err) {
      lastError = err;
      logger.warn({ err, dependency: name, attempt, retries }, 'dependency connection attempt failed');

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`${name} failed after ${retries} retries`);
}

async function initWithRetry() {
  try {
    await connectWithRetry(connectMongoDB, 'MongoDB Atlas');

    if (isShuttingDown) {
      return;
    }

    await checkReadiness();

    initPassport();
    const { app, corsOrigin } = await createApp({
      isReady: () => isReady,
      isShuttingDown: () => isShuttingDown,
      quizOnlyMode,
    });
    httpServer = createServer(app);

    if (!quizOnlyMode) {
      const [battleSocketModule, notificationRealtimeModule] = await Promise.all([
        import('./battle/battleSocket.js'),
        import('./services/notificationRealtime.js'),
      ]);
      setNotificationRealtimeServer = notificationRealtimeModule.setNotificationRealtimeServer;
      socketServer = battleSocketModule.initBattleSocket(httpServer, corsOrigin);
    }

    if (runEmbeddedWorkers) {
      const [workerRegistry, battleOutbox, attachmentWorker] = await Promise.all([
        import('./infrastructure/workerRegistry.js'),
        import('./infrastructure/battleOutbox.js'),
        import('./infrastructure/attachmentWorker.js'),
      ]);

      stopWorkers = workerRegistry.stopWorkers;
      stopAttachmentWorker = attachmentWorker.stopAttachmentWorker;
      waitForAttachmentWorkerIdle = attachmentWorker.waitForAttachmentWorkerIdle;

      await workerRegistry.startWorkers();

      if (isShuttingDown) {
        return;
      }

      stopBattleOutbox = battleOutbox.startBattleOutbox({ localApi: true });
      await attachmentWorker.startAttachmentWorker();

      if (isShuttingDown) {
        return;
      }

      logger.info('Embedded maintenance and attachment workers ready');
    }

    isReady = true;

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info({ port: PORT, quizOnlyMode, embeddedWorkers: runEmbeddedWorkers }, 'server ready');
    });
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
  logger.fatal({ err: error }, 'Uncaught exception');
  void gracefulShutdown('uncaughtException', 1);
});

process.once('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection');
  void gracefulShutdown('unhandledRejection', 1);
});

initWithRetry();
