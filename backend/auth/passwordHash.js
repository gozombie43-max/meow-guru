import os from 'node:os';
import { Worker } from 'node:worker_threads';
import bcrypt from 'bcryptjs';

const DEFAULT_BCRYPT_ROUNDS = 12;
const WORKER_SCRIPT_URL = new URL('./passwordWorker.js', import.meta.url);
const MAX_POOL_SIZE = Math.min(
  4,
  Math.max(1, (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length) - 1),
);
const MAX_QUEUE_LENGTH = 256;

const workers = [];
const queue = [];
let nextTaskId = 1;

function shouldUseWorkerPool(options = {}) {
  if (typeof options.useWorker === 'boolean') return options.useWorker;
  if (process.env.AUTH_BCRYPT_WORKERS === '0' || process.env.AUTH_BCRYPT_WORKERS === 'false') {
    return false;
  }
  if (process.env.AUTH_BCRYPT_WORKERS === '1' || process.env.AUTH_BCRYPT_WORKERS === 'true') {
    return true;
  }
  if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) {
    return false;
  }
  return true;
}

function pumpQueue() {
  if (!queue.length) return;
  let idleEntry = workers.find((entry) => !entry.busy);
  if (!idleEntry && workers.length < MAX_POOL_SIZE) {
    idleEntry = spawnPoolWorker();
  }
  if (!idleEntry) return;

  const task = queue.shift();
  if (!task) return;
  idleEntry.busy = true;
  idleEntry.activeTask = task;
  idleEntry.worker.postMessage({
    id: task.id,
    op: task.op,
    password: task.password,
    hashOrRounds: task.hashOrRounds,
  });
}

function removeWorkerEntry(entry, error) {
  const idx = workers.indexOf(entry);
  if (idx !== -1) workers.splice(idx, 1);
  if (entry.activeTask) {
    const task = entry.activeTask;
    entry.activeTask = null;
    entry.busy = false;
    task.fallback(error);
  }
  pumpQueue();
}

function spawnPoolWorker() {
  try {
    const worker = new Worker(WORKER_SCRIPT_URL);
    if (typeof worker.unref === 'function') worker.unref();
    const entry = { worker, busy: false, activeTask: null };
    worker.on('message', (msg) => {
      const task = entry.activeTask;
      entry.activeTask = null;
      entry.busy = false;
      if (task && msg && msg.id === task.id) {
        if (msg.ok) task.resolve(msg.result);
        else task.reject(new Error(msg.error || 'Password worker failed'));
      }
      pumpQueue();
    });
    worker.on('error', (err) => {
      removeWorkerEntry(entry, err);
    });
    worker.on('exit', (code) => {
      if (code !== 0 || entry.activeTask) {
        removeWorkerEntry(entry, new Error(`Password worker exited with code ${code}`));
      } else {
        const idx = workers.indexOf(entry);
        if (idx !== -1) workers.splice(idx, 1);
      }
    });
    workers.push(entry);
    return entry;
  } catch {
    return null;
  }
}

function runInWorkerPool(op, password, hashOrRounds, directFallback) {
  if (queue.length >= MAX_QUEUE_LENGTH) {
    return directFallback();
  }
  return new Promise((resolve, reject) => {
    const id = nextTaskId++;
    queue.push({
      id,
      op,
      password,
      hashOrRounds,
      resolve,
      reject,
      fallback: () => {
        Promise.resolve().then(directFallback).then(resolve, reject);
      },
    });
    pumpQueue();
  });
}

export async function hashPassword(password, rounds = DEFAULT_BCRYPT_ROUNDS, options = {}) {
  const direct = () => bcrypt.hash(password, rounds);
  if (!shouldUseWorkerPool(options)) {
    return direct();
  }
  return runInWorkerPool('hash', password, rounds, direct);
}

export async function verifyPassword(password, hash, options = {}) {
  const direct = () => bcrypt.compare(password, hash);
  if (!shouldUseWorkerPool(options)) {
    return direct();
  }
  return runInWorkerPool('compare', password, hash, direct);
}

export async function shutdownPasswordWorkers() {
  const active = workers.splice(0, workers.length);
  await Promise.all(active.map((entry) => entry.worker.terminate().catch(() => {})));
}
