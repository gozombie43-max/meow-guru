import 'dotenv/config';
import { validateEnvironment } from './config/environment.js';
import { assertProcessRole, embeddedWorkersEnabled, standaloneConceptGroupingEnabled } from './config/processRole.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { initPassport } from './auth/passport.js';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import { closeRedisClient } from './config/redis.js';
import { startSessionInvalidationSubscriber, closeSessionInvalidationSubscriber } from './auth/sessions.js';
import { checkReadiness } from './infrastructure/readiness.js';
import { startCacheInvalidationSubscriber, closeCacheInvalidationSubscriber } from './infrastructure/cacheInvalidation.js';
import { startRuntimeMetrics, logger } from './infrastructure/logger.js';
import { listenServer } from './infrastructure/httpListen.js';
import { startOptionalService, stopOptionalServices, optionalServiceReady } from './infrastructure/optionalServices.js';
import { maintenanceQueueHealth } from './infrastructure/maintenanceQueue.js';
import { initializePublicCatalogs, startTopicCountPrewarm } from './services/questions/topicCountSnapshot.js';

let socketServer = null, httpServer;
let isShuttingDown = false, isReady = false;
let stopBattleOutbox;
let stopWorkers;
let stopAttachmentWorker;
let closeBattleRedisAdapter;
let waitForAttachmentWorkerIdle;
let setNotificationRealtimeServer;
let battleRedisReady = () => true;

const quizOnlyMode = process.env.QUIZ_ONLY_MODE === 'true';
validateEnvironment();
assertProcessRole('api');
const runEmbeddedWorkers = embeddedWorkersEnabled();
const stopMetrics = startRuntimeMetrics();
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
    await stopOptionalServices();
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
    await closeSessionInvalidationSubscriber();
    await closeCacheInvalidationSubscriber();
    await closeBattleRedisAdapter?.();
    await closeRedisClient();
    await disconnectMongoDB();
    await globalThis.__shutdownTelemetry?.();
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
    await initializePublicCatalogs();
    initPassport();
    const { app, corsOrigin } = await createApp({
      isReady: () => isReady,
      isShuttingDown: () => isShuttingDown,
      quizOnlyMode,
    });
    httpServer = createServer(app);

    const startBattle = async () => {
      const [battleSocketModule, notificationRealtimeModule] = await Promise.all([
        import('./battle/battleSocket.js'),
        import('./services/notificationRealtime.js'),
      ]);
      setNotificationRealtimeServer = notificationRealtimeModule.setNotificationRealtimeServer;
      const { prepareBattleRedisAdapter } = await import('./battle/redisSocketAdapter.js');
      const battleAdapter = await prepareBattleRedisAdapter();
      closeBattleRedisAdapter = battleAdapter?.close;
      battleRedisReady = battleAdapter?.isReady || (() => true);
      socketServer = battleSocketModule.initBattleSocket(httpServer, corsOrigin, battleAdapter?.adapter);
    };
    // Once Socket.IO owns the HTTP server, gracefulShutdown closes that server
    // and its adapter before destroying Redis. Here clean only partial startup.
    const cleanupBattle = async () => { if (!socketServer) await closeBattleRedisAdapter?.(); };

    const startEmbeddedWorkers = async () => {
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

      await startOptionalService('battle', startBattle, { enabled: !quizOnlyMode, critical: process.env.BATTLE_REDIS_CRITICAL === 'true', ready: () => battleRedisReady(), cleanup: cleanupBattle });
      if (optionalServiceReady('battle')) stopBattleOutbox = battleOutbox.startBattleOutbox({ localApi: true });
      await attachmentWorker.startAttachmentWorker();

      if (isShuttingDown) {
        return;
      }

      logger.info('Embedded maintenance and attachment workers ready');
    };

    const stopEmbeddedWorkers = async () => {
      stopAttachmentWorker?.();
      const [, , idle] = await Promise.all([stopWorkers?.(), stopBattleOutbox?.(), waitForAttachmentWorkerIdle?.(12000)]);
      if (idle === false) throw new Error('Attachment worker failed to drain');
      stopWorkers = stopBattleOutbox = stopAttachmentWorker = waitForAttachmentWorkerIdle = undefined;
    };
    // Explicitly critical features retain fail-closed startup. Ordinary optional
    // integrations start after the core listener and cannot retire API readiness.
    const battleCritical = process.env.BATTLE_REDIS_CRITICAL === 'true';
    const workersCritical = process.env.EMBEDDED_WORKERS_CRITICAL === 'true';
    const workersReady = () => process.env.USE_DURABLE_QUEUE !== 'true' || maintenanceQueueHealth() === 'healthy';
    if (!quizOnlyMode && battleCritical) await startOptionalService('battle', startBattle, { critical: true, ready: () => battleRedisReady(), cleanup: cleanupBattle });
    if (runEmbeddedWorkers && workersCritical) await startOptionalService('workers', startEmbeddedWorkers, { critical: true, ready: workersReady, cleanup: stopEmbeddedWorkers });

    await listenServer(httpServer, PORT);
    isReady = true;
    logger.info({ port: PORT, quizOnlyMode, embeddedWorkers: runEmbeddedWorkers }, 'server ready');
    await startOptionalService('conceptGrouping', async () => {
      if (!process.env.AZURE_OPENAI_KEY && !process.env.OPENAI_API_KEY) throw new Error('Concept grouping requires an AI API key');
      const worker = await import('./services/conceptGroupingWorker.js');
      worker.startConceptGroupingWorker();
    }, {
      enabled: standaloneConceptGroupingEnabled(),
      cleanup: async () => {
        const worker = await import('./services/conceptGroupingWorker.js');
        worker.stopConceptGroupingWorker();
        if (!await worker.waitForConceptGroupingWorkerIdle(12000)) throw new Error('Concept grouping worker failed to drain');
      },
    });
    let stopCatalogPrewarm;
    void startOptionalService('catalogPrewarm', async () => {
      stopCatalogPrewarm = startTopicCountPrewarm();
    }, { cleanup: async () => { await stopCatalogPrewarm?.(); } });
    void startOptionalService('cacheSubscribers', async () => {
      await Promise.all([startSessionInvalidationSubscriber(), startCacheInvalidationSubscriber()]);
    }, { enabled: Boolean(process.env.REDIS_URL), cleanup: async () => { await closeSessionInvalidationSubscriber(); await closeCacheInvalidationSubscriber(); } });
    if (!battleCritical || quizOnlyMode) void startOptionalService('battle', startBattle, { enabled: !quizOnlyMode, ready: () => battleRedisReady(), cleanup: cleanupBattle });
    if (!workersCritical || !runEmbeddedWorkers) void startOptionalService('workers', startEmbeddedWorkers, { enabled: runEmbeddedWorkers, ready: workersReady, cleanup: stopEmbeddedWorkers });
  } catch (err) {
    isReady = false;

    if (isShuttingDown) {
      return;
    }

    logger.error({ err, port: PORT }, err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use. Stop the existing backend before starting another instance.`
      : 'API startup failed');
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
