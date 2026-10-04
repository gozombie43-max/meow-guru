import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';
import { claimJob, renewJob, completeJob, failJob } from './durableQueue.js';
import { purgeObjectVersions } from './objectStorage.js';
import { acquireTutorSlot, releaseTutorSlot } from '../repositories/tutorQuotaRepository.js';
import { listExpiredTutorObjects, forgetTutorObject, claimTutorInputCleanup, finishTutorInputCleanup } from '../repositories/tutorJobRepository.js';
import { logger } from './logger.js';
import { getReleaseId } from './releaseInfo.js';
import { withTrace, withTraceCarrier } from './tracing.js';

const workerId = randomUUID();
let stopping = true;
let ready = false;
let activeChild;
let loopPromise;
let startPromise;
let wakeDelay;
let stopWhenIdle = false;
let idleTimeoutMs = 10_000;
let lastActivityAt = 0;

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
      execArgv: ['--max-old-space-size=512', '--import', new URL('../instrumentation.js', import.meta.url).href],
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
    child.send({ job, trace: job.trace });
  });
}

async function reportHealth(db, jobs) {
  const now = new Date();
  await db.collection('runtimeHealth').updateOne(
    { _id: workerId },
    {
      $set: {
        role: 'attachments',
        releaseId: getReleaseId(),
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

      for (let count = 0; count < 20; count++) {
        if (stopping) break;
        const old = await claimTutorInputCleanup();
        if (!old) break;
        try {
          await purgeObjectVersions(old.attachmentKey || old.inputKey);
          await forgetTutorObject(old.attachmentKey || old.inputKey);
          if (old.queueSlot) await releaseTutorSlot(old.queueSlot);
          await finishTutorInputCleanup(old);
        } catch {
          logger.warn({ jobId: old._id }, 'attachment input cleanup will retry');
        }
      }

      for (const old of await listExpiredTutorObjects()) {
        await purgeObjectVersions(old.key);
        await forgetTutorObject(old._id);
      }

      if (stopping) break;
      const job = await claimJob(jobs, 'tutor');
      if (!job) {
        if (stopWhenIdle && Date.now() - lastActivityAt >= idleTimeoutMs) {
          logger.info({ idleTimeoutMs }, 'attachment worker stopped after idle window');
          break;
        }
        await delay(1_000);
        continue;
      }

      let processingSlot;
      try { processingSlot = await acquireTutorSlot(job.userId, 'running', job.owner); }
      catch (error) {
        await jobs.updateOne({ _id: job._id, owner: job.owner }, { $set: { status: 'queued', availableAt: new Date(Date.now() + 1000) }, $inc: { attempts: -1 }, $unset: { owner: '', leaseUntil: '' } });
        if (error.statusCode !== 429) throw error;
        await delay(1000);
        continue;
      }

      lastActivityAt = Date.now();
      const started = performance.now();
      const heartbeat = setInterval(() => {
        const renewingChild = activeChild;
        void renewJob(jobs, job)
          .then((owned) => { if (!owned) renewingChild?.kill(); })
          .catch(() => renewingChild?.kill());
      }, 10_000);
      try {
        const result = await withTraceCarrier(job.trace, () => withTrace('job.tutor', { 'job.attempt': job.attempts }, () => runChild(job)));
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
        await releaseTutorSlot(processingSlot);
        lastActivityAt = Date.now();
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

export function startAttachmentWorker(options = {}) {
  const requestedStopWhenIdle = options.stopWhenIdle === true;
  const requestedIdleTimeoutMs = Number(options.idleTimeoutMs);

  if (loopPromise) {
    // A persistent/full-runtime start request takes precedence over F1 idle-stop mode.
    if (!requestedStopWhenIdle) stopWhenIdle = false;
    return Promise.resolve();
  }

  if (startPromise) {
    if (!requestedStopWhenIdle) stopWhenIdle = false;
    return startPromise;
  }

  const db = getMongoDB();
  const jobs = db.collection('runtimeJobs');
  stopping = false;
  stopWhenIdle = requestedStopWhenIdle;
  idleTimeoutMs = Number.isFinite(requestedIdleTimeoutMs)
    ? Math.max(1_000, requestedIdleTimeoutMs)
    : 10_000;
  lastActivityAt = Date.now();

  startPromise = (async () => {
    await reportHealth(db, jobs);
    if (stopping) return;

    ready = true;
    loopPromise = processJobs(db, jobs).finally(() => {
      ready = false;
      stopping = true;
      loopPromise = undefined;
    });
  })().finally(() => {
    startPromise = undefined;
  });

  return startPromise;
}

export function stopAttachmentWorker() {
  stopping = true;
  ready = false;
  activeChild?.kill();
  wakeDelay?.();
}

export async function waitForAttachmentWorkerIdle(timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;

  if (startPromise) {
    const startupFinished = await Promise.race([
      startPromise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    if (!startupFinished) return false;
  }

  if (!loopPromise) return true;

  const remainingMs = Math.max(0, deadline - Date.now());
  return Promise.race([
    loopPromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), remainingMs)),
  ]);
}
