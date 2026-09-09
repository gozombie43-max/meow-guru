import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';
import { claimJob, renewJob, completeJob, failJob } from './durableQueue.js';
import { deleteObject } from './objectStorage.js';
import { logger } from './logger.js';

const workerId = randomUUID();
let stopping = true;
let ready = false;
let activeChild;
let loopPromise;
let wakeDelay;

function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      if (wakeDelay === done) wakeDelay = undefined;
      clearTimeout(timer);
      resolve();
    }
    wakeDelay = done;
  });
}

function runChild(job) {
  return new Promise((resolve, reject) => {
    const child = fork(new URL('./tutorJobChild.js', import.meta.url), [], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      windowsHide: true,
      execArgv: ['--max-old-space-size=512'],
    });
    activeChild = child;
    let message;
    const timer = setTimeout(() => child.kill(), 120_000);
    child.once('message', (value) => { message = value; });
    child.once('error', (error) => {
      clearTimeout(timer);
      if (activeChild === child) activeChild = undefined;
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (activeChild === child) activeChild = undefined;
      if (code === 0 && message?.result) resolve(message.result);
      else reject(new Error('Attachment child failed or timed out'));
    });
    child.send({ key: job.inputKey });
  });
}

async function reportHealth(db, jobs) {
  const now = new Date();
  await db.collection('runtimeHealth').updateOne(
    { _id: workerId },
    {
      $set: {
        role: 'attachments',
        releaseId: process.env.RELEASE_ID || 'local',
        updatedAt: now,
        expiresAt: new Date(+now + 180_000),
      },
    },
    { upsert: true },
  );
  const oldest = await jobs.findOne(
    { kind: 'tutor', status: 'queued' },
    { sort: { availableAt: 1 }, projection: { availableAt: 1 } },
  );
  logger.info({
    queued: await jobs.countDocuments({ kind: 'tutor', status: 'queued' }),
    oldestWaitMs: oldest ? Math.max(0, Date.now() - oldest.availableAt) : 0,
  }, 'attachment queue');
}

async function processJobs(db, jobs) {
  let lastHeartbeat = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastHeartbeat > 15_000) {
        await reportHealth(db, jobs);
        lastHeartbeat = Date.now();
      }

      const cleanup = await jobs.find({
        kind: 'tutor',
        status: { $in: ['completed', 'failed', 'cancelled'] },
        inputDeleted: { $ne: true },
      }).limit(20).toArray();
      for (const old of cleanup) {
        if (stopping) break;
        try {
          await deleteObject(old.inputKey);
          await jobs.updateOne({ _id: old._id }, { $set: { inputDeleted: true } });
        } catch {
          logger.warn({ jobId: old._id }, 'attachment input cleanup will retry');
        }
      }

      if (stopping) break;
      const job = await claimJob(jobs, 'tutor');
      if (!job) {
        await delay(1_000);
        continue;
      }

      const started = performance.now();
      const heartbeat = setInterval(() => {
        const renewingChild = activeChild;
        void renewJob(jobs, job)
          .then((owned) => { if (!owned) renewingChild?.kill(); })
          .catch(() => renewingChild?.kill());
      }, 10_000);
      try {
        const result = await runChild(job);
        await completeJob(jobs, job, result);
        logger.info({
          jobId: job._id,
          attempt: job.attempts,
          durationMs: Math.round(performance.now() - started),
        }, 'attachment job finished');
      } catch {
        await failJob(jobs, job);
        logger.warn({ jobId: job._id, attempt: job.attempts }, 'attachment job failed');
      } finally {
        clearInterval(heartbeat);
      }
    } catch (error) {
      logger.error({ err: error }, 'attachment worker iteration failed');
      if (!stopping) await delay(1_000);
    }
  }
}

export function isAttachmentWorkerReady() {
  return ready && !stopping;
}

export async function startAttachmentWorker() {
  if (loopPromise) return;
  const db = getMongoDB();
  const jobs = db.collection('runtimeJobs');
  stopping = false;
  await reportHealth(db, jobs);
  ready = true;
  loopPromise = processJobs(db, jobs).finally(() => {
    ready = false;
    loopPromise = undefined;
  });
}

export function stopAttachmentWorker() {
  stopping = true;
  ready = false;
  activeChild?.kill();
  wakeDelay?.();
}

export async function waitForAttachmentWorkerIdle(timeoutMs = 12_000) {
  if (!loopPromise) return true;
  const activeLoop = loopPromise;
  return Promise.race([
    activeLoop.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}
