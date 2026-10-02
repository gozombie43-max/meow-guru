import { withTrace } from './tracing.js';
import { dependencyLatency, dependencyErrors } from './metrics.js';

const busy = () => Object.assign(new Error('Dependency is temporarily busy'), { statusCode: 503, retryAfter: 3 });
const boundaries = new Map();
export function dependencyHealth() { return Object.fromEntries([...boundaries].map(([name, boundary]) => [name, boundary.snapshot()])); }

export function createDependencyBoundary(name, { concurrency = 8, maxQueued = 16, queueTimeoutMs = 250, timeoutMs = 5000, failureThreshold = 5, cooldownMs = 30000, now = Date.now } = {}) {
  let active = 0, failures = 0, openUntil = 0, probing = false;
  const waiting = [];
  function release() {
    active--;
    const next = waiting.shift();
    if (next) { clearTimeout(next.timer); active++; next.resolve(); }
  }
  function acquire() {
    if (active < concurrency) { active++; return Promise.resolve(); }
    if (waiting.length >= maxQueued) return Promise.reject(busy());
    return new Promise((resolve, reject) => {
      const entry = { resolve, timer: setTimeout(() => { const index = waiting.indexOf(entry); if (index >= 0) waiting.splice(index, 1); reject(busy()); }, queueTimeoutMs) };
      waiting.push(entry);
    });
  }
  const boundary = {
    snapshot: () => ({ active, queued: waiting.length, limit: concurrency, circuit: openUntil > now() ? 'open' : probing ? 'half-open' : 'closed' }),
    async execute(work, { signal: parentSignal, timeoutMs: operationTimeoutMs = timeoutMs } = {}) {
      if (parentSignal?.aborted) throw parentSignal.reason;
      if (openUntil > now() || (openUntil && probing)) throw busy();
      const probe = Boolean(openUntil);
      if (probe) probing = true;
      try { await acquire(); }
      catch (error) { if (probe) probing = false; throw error; }
      return withTrace(`dependency.${name}`, { 'dependency.name': name }, async () => {
        const started = performance.now();
        const controller = new AbortController();
        let rejectAbort;
        const cancelled = new Promise((_, reject) => { rejectAbort = reject; });
        const onAbort = () => { controller.abort(parentSignal.reason); rejectAbort(parentSignal.reason || Object.assign(new Error('Dependency cancelled'), { name: 'AbortError' })); };
        parentSignal?.addEventListener('abort', onAbort, { once: true });
        let timer;
        const workPromise = Promise.resolve().then(() => { if (parentSignal?.aborted) throw parentSignal.reason; return work(controller.signal); });
        // Retain the slot until the real work settles, even if it ignores abort.
        workPromise.then(release, release);
        try {
          const result = await Promise.race([workPromise, cancelled, new Promise((_, reject) => {
            timer = setTimeout(() => { const error = Object.assign(new Error('Dependency deadline exceeded'), { statusCode: 504 }); controller.abort(error); reject(error); }, operationTimeoutMs);
          })]);
          failures = 0; openUntil = 0;
          return result;
        } catch (error) {
          dependencyErrors.inc({ dependency: name });
          const status = error.statusCode || error.status;
          if (!controller.signal.aborted || error.statusCode === 504) {
            if (!status || status === 429 || status >= 500) { failures++; if (failures >= failureThreshold) openUntil = now() + cooldownMs; }
          }
          throw error;
        } finally { dependencyLatency.observe({ dependency: name, operation: 'execute' }, (performance.now() - started) / 1000); clearTimeout(timer); parentSignal?.removeEventListener('abort', onAbort); if (probe) probing = false; }
      });
    },
  };
  boundaries.set(name, boundary);
  return boundary;
}

export const heavyMongo = createDependencyBoundary('mongo.metadata', { concurrency: 10, maxQueued: 20, timeoutMs: 10000 });
export const aiProvider = createDependencyBoundary('ai', { concurrency: 3, maxQueued: 6, timeoutMs: 45000 });
export const objectStorage = createDependencyBoundary('storage', { concurrency: 8, maxQueued: 8, timeoutMs: 10000 });
export const ocrBudget = createDependencyBoundary('ocr', { concurrency: 2, maxQueued: 2, timeoutMs: 120000 });
export const pdfBudget = createDependencyBoundary('pdf', { concurrency: 2, maxQueued: 2, timeoutMs: 120000 });
export const imageBudget = createDependencyBoundary('image', { concurrency: 3, maxQueued: 3, timeoutMs: 30000 });
export const firebaseProvider = createDependencyBoundary('firebase', { concurrency: 8, maxQueued: 8, timeoutMs: 15000 });
export const backgroundAi = createDependencyBoundary('ai.grouping', { concurrency: 2, maxQueued: 2, timeoutMs: 300000 });

// Retry is explicitly restricted to idempotent reads. Mutation retries belong
// to their transactional/idempotency protocol, never a generic wrapper.
export async function retryRead(boundary, work, { retries = 2, signal } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await boundary.execute(work, { signal }); }
    catch (error) {
      if (signal?.aborted || attempt >= retries || (error.statusCode && ![429, 502, 504].includes(error.statusCode))) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.round(100 * 2 ** attempt * (0.8 + Math.random() * 0.6))));
    }
  }
}
