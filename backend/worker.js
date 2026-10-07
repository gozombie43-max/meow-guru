import { startBattleOutbox } from "./infrastructure/battleOutbox.js";
import 'dotenv/config';
import { validateEnvironment } from './config/environment.js';
import { assertProcessRole } from './config/processRole.js';
assertProcessRole('worker');
validateEnvironment();
import { connectMongoDB, disconnectMongoDB, getMongoDB } from './config/mongodb.js';
import { assertMigrations } from './migrations/runner.js';
import { logger, startRuntimeMetrics } from './infrastructure/logger.js';
import { startWorkerRealtime } from './infrastructure/workerRealtime.js';
import { prepareBattleRedisAdapter } from './battle/redisSocketAdapter.js';
import { startWorkers, stopWorkers } from './infrastructure/workerRegistry.js';
import { startWorkerHealthServer } from './infrastructure/workerHealthServer.js';
import { getReleaseId } from './infrastructure/releaseInfo.js';
import { randomUUID } from 'node:crypto';
import { startCacheInvalidationSubscriber, closeCacheInvalidationSubscriber } from './infrastructure/cacheInvalidation.js';
import { closeRedisClient } from './config/redis.js';
import { startOptionalService, stopOptionalServices, optionalServiceReady } from './infrastructure/optionalServices.js';
import { maintenanceQueueHealth } from './infrastructure/maintenanceQueue.js';

const workerId = randomUUID();
let stopping = false, ready = false, healthServer, closeRealtime, closeBattleRedisAdapter, heartbeat, stopMetrics, stopOutbox;
let battleRedisReady = () => true;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  ready = false;
  clearInterval(heartbeat);
  const deadline = setTimeout(() => process.exit(1), 20000);
  deadline.unref();
  try {
    await stopWorkers();
    await stopOptionalServices();
    await stopOutbox?.();
    await closeRealtime?.();
    await closeBattleRedisAdapter?.();
    await closeCacheInvalidationSubscriber();
    await closeRedisClient();
    stopMetrics?.();
    await disconnectMongoDB();
    await healthServer?.close();
    await globalThis.__shutdownTelemetry?.();
  } catch (err) { logger.error({ err }, 'worker shutdown failed'); code = 1; }
  clearTimeout(deadline);
  process.exit(code);
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
process.once('uncaughtException', err => { logger.fatal({ err }, 'worker crash'); void shutdown(1); });
process.once('unhandledRejection', err => { logger.fatal({ err }, 'worker rejection'); void shutdown(1); });
try {
  healthServer = await startWorkerHealthServer('maintenance', () => ready && !stopping
    && (process.env.USE_DURABLE_QUEUE !== 'true' || maintenanceQueueHealth() === 'healthy')
    && (process.env.QUIZ_ONLY_MODE === 'true' || process.env.BATTLE_REDIS_CRITICAL !== 'true' || optionalServiceReady('battle')));
  const db = await connectMongoDB();
  await assertMigrations(db);
  await startCacheInvalidationSubscriber();
  await startOptionalService('battle', async () => {
    const battleAdapter = await prepareBattleRedisAdapter();
    closeBattleRedisAdapter = battleAdapter?.close;
    battleRedisReady = battleAdapter?.isReady || (() => true);
    closeRealtime = startWorkerRealtime(battleAdapter?.adapter);
  }, { enabled: process.env.QUIZ_ONLY_MODE !== 'true', critical: process.env.BATTLE_REDIS_CRITICAL === 'true', ready: () => battleRedisReady(), cleanup: async () => { await closeRealtime?.(); closeRealtime = undefined; await closeBattleRedisAdapter?.(); closeBattleRedisAdapter = undefined; } });
  stopMetrics = startRuntimeMetrics();
  await startWorkers();
  if (optionalServiceReady('battle')) stopOutbox = startBattleOutbox();
  const beat = () => getMongoDB().collection('runtimeHealth').updateOne({ _id: workerId }, { $set: { role: 'maintenance', releaseId: getReleaseId(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 60000) } }, { upsert: true });
  await beat();
  if (!stopping) heartbeat = setInterval(() => void beat().catch(err => logger.error({ err }, 'worker heartbeat failed')), 15000);
  ready = true;
  logger.info({ workerId }, 'maintenance worker ready');
} catch (err) { logger.error({ err }, 'worker startup failed'); await shutdown(1); }
