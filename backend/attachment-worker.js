import 'dotenv/config';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import { assertMigrations } from './migrations/runner.js';
import { logger, startRuntimeMetrics } from './infrastructure/logger.js';
import { startWorkerHealthServer } from './infrastructure/workerHealthServer.js';
import {
  isAttachmentWorkerReady,
  startAttachmentWorker,
  stopAttachmentWorker,
  waitForAttachmentWorkerIdle,
} from './infrastructure/attachmentWorker.js';

let stopping = false, healthServer;
const stopMetrics = startRuntimeMetrics();

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 20_000);
  deadline.unref();
  stopAttachmentWorker();
  try {
    if (!await waitForAttachmentWorkerIdle()) code = 1;
    stopMetrics();
    await disconnectMongoDB();
    await healthServer?.close();
  } catch (error) {
    logger.error({ err: error }, 'attachment worker shutdown failed');
    code = 1;
  }
  clearTimeout(deadline);
  process.exit(code);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
process.once('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'attachment worker crash');
  void shutdown(1);
});
process.once('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'attachment worker rejection');
  void shutdown(1);
});

try {
  healthServer = await startWorkerHealthServer(
    'attachments',
    () => isAttachmentWorkerReady() && !stopping,
  );
  const db = await connectMongoDB();
  await assertMigrations(db);
  await startAttachmentWorker();
  logger.info('attachment worker ready');
} catch (error) {
  logger.error({ err: error }, 'attachment worker failed');
  await shutdown(1);
}
