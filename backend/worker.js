import { startBattleOutbox } from "./infrastructure/battleOutbox.js";
import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB, getMongoDB } from './config/mongodb.js';
import { assertMigrations } from './migrations/runner.js';
import { logger, startRuntimeMetrics } from './infrastructure/logger.js';
import { startWorkerRealtime } from './infrastructure/workerRealtime.js';
import { startWorkers, stopWorkers } from './infrastructure/workerRegistry.js';
import { startWorkerHealthServer } from './infrastructure/workerHealthServer.js';
import { randomUUID } from 'node:crypto';

const workerId = randomUUID();
let stopping = false, ready = false, healthServer, closeRealtime, heartbeat, stopMetrics, stopOutbox;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  ready = false;
  clearInterval(heartbeat);
  const deadline = setTimeout(() => process.exit(1), 20000);
  deadline.unref();
  try {
    await stopWorkers();
    await stopOutbox?.();
    await closeRealtime?.();
    stopMetrics?.();
    await disconnectMongoDB();
    await healthServer?.close();
  } catch (err) { logger.error({ err }, 'worker shutdown failed'); code = 1; }
  clearTimeout(deadline);
  process.exit(code);
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
process.once('uncaughtException', err => { logger.fatal({ err }, 'worker crash'); void shutdown(1); });
process.once('unhandledRejection', err => { logger.fatal({ err }, 'worker rejection'); void shutdown(1); });
try {
  healthServer = await startWorkerHealthServer('maintenance', () => ready && !stopping);
  const db = await connectMongoDB();
  await assertMigrations(db);
  closeRealtime = startWorkerRealtime();
  stopMetrics = startRuntimeMetrics();
  await startWorkers();
  stopOutbox = startBattleOutbox();
  const beat = () => getMongoDB().collection('runtimeHealth').updateOne({ _id: workerId }, { $set: { role: 'maintenance', releaseId: process.env.RELEASE_ID || 'local', updatedAt: new Date(), expiresAt: new Date(Date.now() + 60000) } }, { upsert: true });
  await beat();
  if (!stopping) heartbeat = setInterval(() => void beat().catch(err => logger.error({ err }, 'worker heartbeat failed')), 15000);
  ready = true;
  logger.info({ workerId }, 'maintenance worker ready');
} catch (err) { logger.error({ err }, 'worker startup failed'); await shutdown(1); }
