import 'dotenv/config';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js';
import { assertMigrations } from './migrations/runner.js';
import { claimJob, renewJob, completeJob, failJob } from './infrastructure/durableQueue.js';
import { deleteObject } from './infrastructure/objectStorage.js';
import { logger, startRuntimeMetrics } from './infrastructure/logger.js';

let stopping = false, activeChild;
const stopMetrics = startRuntimeMetrics();
let lastHeartbeat = 0;
const workerId = randomUUID();
function stop() { stopping = true; activeChild?.kill(); }
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
function runChild(job) {
  return new Promise((resolve, reject) => {
    const child = fork(new URL('./infrastructure/tutorJobChild.js', import.meta.url), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true, execArgv: ['--max-old-space-size=512'] });
    activeChild = child;
    let message;
    const timer = setTimeout(() => child.kill(), 120000);
    child.once('message', value => { message = value; });
    child.once('error', error => { clearTimeout(timer); if (activeChild === child) activeChild = null; reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      activeChild = null;
      if (code === 0 && message?.result) resolve(message.result);
      else reject(new Error('Attachment child failed or timed out'));
    });
    child.send({ key: job.inputKey });
  });
}
try {
  const db = await connectMongoDB();
  await assertMigrations(db);
  const jobs = db.collection('runtimeJobs');
  while (!stopping) {
    if (Date.now() - lastHeartbeat > 15000) {
      await db.collection('runtimeHealth').updateOne({ _id: workerId }, { $set: { role: 'attachments', releaseId: process.env.RELEASE_ID || 'local', updatedAt: new Date(), expiresAt: new Date(Date.now() + 180000) } }, { upsert: true });
      const oldest = await jobs.findOne({ kind: 'tutor', status: 'queued' }, { sort: { availableAt: 1 }, projection: { availableAt: 1 } });
      logger.info({ queued: await jobs.countDocuments({ kind: 'tutor', status: 'queued' }), oldestWaitMs: oldest ? Math.max(0, Date.now() - oldest.availableAt) : 0 }, 'attachment queue');
      lastHeartbeat = Date.now();
    }
    const cleanup = await jobs.find({ kind: 'tutor', status: { $in: ['completed', 'failed', 'cancelled'] }, inputDeleted: { $ne: true } }).limit(20).toArray();
    for (const old of cleanup) {
      try {
        await deleteObject(old.inputKey);
        await jobs.updateOne({ _id: old._id }, { $set: { inputDeleted: true } });
      } catch (err) { logger.warn({ jobId: old._id }, 'attachment input cleanup will retry'); }
    }
    const job = await claimJob(jobs, 'tutor');
    if (!job) { await new Promise(resolve => setTimeout(resolve, 1000)); continue; }
    const started = performance.now();
    const heartbeat = setInterval(() => {
      const renewingChild = activeChild;
      void renewJob(jobs, job).then(owned => { if (!owned) renewingChild?.kill(); }).catch(() => renewingChild?.kill());
    }, 10000);
    try {
      const result = await runChild(job);
      await completeJob(jobs, job, result);
      logger.info({ jobId: job._id, attempt: job.attempts, durationMs: Math.round(performance.now() - started) }, 'attachment job finished');
    } catch (err) {
      await failJob(jobs, job);
      logger.warn({ jobId: job._id, attempt: job.attempts }, 'attachment job failed');
    } finally { clearInterval(heartbeat); }
  }
} catch (err) { logger.error({ err }, 'attachment worker failed'); process.exitCode = 1; }
finally { stopMetrics(); activeChild?.kill(); await disconnectMongoDB(); }
