import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

// This probe intentionally does not load dotenv. A remote target, its safety
// classification, synthetic credentials and an output artifact must all be
// supplied explicitly by the operator running it.
const TARGETS = new Set(['staging', 'production']);
const PRODUCTION_MAX_RUNS = 3;
const STAGING_MAX_CONCURRENCY = 20;
const PRODUCTION_MAX_CONCURRENCY = 3;
const QUESTION_COUNT = 10;
const thresholds = {
  dashboard: 750,
  create: 1500,
  answer: 400,
  visit: 400,
  finish: 1000,
};

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

function boundedInteger(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return value;
}

function remoteBaseUrl() {
  const value = required('TRAINING_REMOTE_BASE_URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TRAINING_REMOTE_BASE_URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('TRAINING_REMOTE_BASE_URL must be an absolute HTTP(S) URL without credentials');
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error('TRAINING_REMOTE_BASE_URL must be an API origin without a path, query or fragment');
  return { origin: url.origin, hostname: url.hostname.toLowerCase() };
}

function verifyTargetHost(hostname, target) {
  const expectedHost = required('TRAINING_REMOTE_EXPECTED_HOST').toLowerCase();
  if (expectedHost !== hostname)
    throw new Error('TRAINING_REMOTE_BASE_URL hostname must exactly match TRAINING_REMOTE_EXPECTED_HOST');
  if (target === 'production' && required('TRAINING_REMOTE_PRODUCTION_CONFIRM').toLowerCase() !== hostname)
    throw new Error('Production probes require TRAINING_REMOTE_PRODUCTION_CONFIRM to exactly match the target hostname');
  return expectedHost;
}

function syntheticCredentials() {
  const numbered = Object.keys(process.env)
    .map(name => /^TRAINING_REMOTE_EMAIL_(\d+)$/.exec(name))
    .filter(Boolean)
    .map(match => Number(match[1]))
    .sort((a, b) => a - b);
  const credentials = numbered.length
    ? numbered.map(index => ({
      email: required(`TRAINING_REMOTE_EMAIL_${index}`),
      password: required(`TRAINING_REMOTE_PASSWORD_${index}`),
    }))
    : [{ email: required('TRAINING_REMOTE_EMAIL'), password: required('TRAINING_REMOTE_PASSWORD') }];
  if (new Set(credentials.map(({ email }) => email.toLowerCase())).size !== credentials.length)
    throw new Error('Synthetic probe accounts must have distinct email addresses');
  return credentials;
}

function percentile(samples, fraction) {
  const ordered = samples.slice().sort((a, b) => a - b);
  return Math.round(ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] * 100) / 100;
}

function summarize(samples) {
  const summary = {};
  for (const [operation, rows] of Object.entries(samples)) {
    const durations = rows.map(row => row.durationMs);
    const errors = rows.filter(row => !row.ok).length;
    summary[operation] = {
      requests: rows.length,
      errors,
      errorRate: errors / rows.length,
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      p99Ms: percentile(durations, 0.99),
      meanResponseBytes: Math.round(rows.reduce((total, row) => total + row.responseBytes, 0) / rows.length),
      maxResponseBytes: Math.max(...rows.map(row => row.responseBytes)),
      investigationThresholdMs: thresholds[operation] || null,
      withinInvestigationThreshold: thresholds[operation] ? percentile(durations, 0.95) < thresholds[operation] : null,
    };
  }
  return summary;
}

function targetConfig() {
  const target = required('TRAINING_REMOTE_TARGET');
  if (!TARGETS.has(target)) throw new Error('TRAINING_REMOTE_TARGET must be staging or production');
  const concurrency = boundedInteger('TRAINING_REMOTE_CONCURRENCY', 1, 1, target === 'production' ? PRODUCTION_MAX_CONCURRENCY : STAGING_MAX_CONCURRENCY);
  const runs = boundedInteger('TRAINING_REMOTE_RUNS', 1, 1, target === 'production' ? PRODUCTION_MAX_RUNS : 20);
  if (target === 'production' && concurrency > 1 && process.env.TRAINING_REMOTE_ALLOW_PRODUCTION_CONCURRENCY !== 'true')
    throw new Error('Production probes require TRAINING_REMOTE_CONCURRENCY=1 unless TRAINING_REMOTE_ALLOW_PRODUCTION_CONCURRENCY=true');
  return { target, concurrency, runs };
}

const remote = remoteBaseUrl();
const config = targetConfig();
const expectedHost = verifyTargetHost(remote.hostname, config.target);
const baseUrl = remote.origin;
const credentials = syntheticCredentials();
if (credentials.length < config.concurrency)
  throw new Error(`Provide ${config.concurrency} distinct synthetic account(s) for this probe`);
const reportPath = required('TRAINING_REMOTE_REPORT');
if (!reportPath.toLowerCase().endsWith('.json')) throw new Error('TRAINING_REMOTE_REPORT must name a .json file');

const runId = `perf-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const samples = {};
let requestNumber = 0;

async function request(operation, method, path, body, token) {
  const requestId = `${runId}-${++requestNumber}-${operation}`;
  const start = performance.now();
  const sample = { ok: false, durationMs: 0, responseBytes: 0 };
  (samples[operation] ||= []).push(sample);
  try {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    sample.responseBytes = Buffer.byteLength(text);
    sample.status = response.status;
    if (!response.ok) { const err = new Error(`${operation} returned HTTP ${response.status}`); err.operation = operation; throw err; }
    try {
      const parsed = JSON.parse(text);
      sample.ok = true;
      return parsed;
    } catch {
      const err = new Error(`${operation} returned invalid JSON`); err.operation = operation; throw err;
    }
  } finally {
    sample.durationMs = performance.now() - start;
  }
}

async function runLifecycle(token) {
  await request('dashboard', 'GET', '/api/training/dashboard?exam=ssc-cgl', undefined, token);
  let session = await request('create', 'POST', '/api/training/sessions', {
    mode: 'section', exam: 'ssc-cgl', subject: 'mathematics', count: QUESTION_COUNT,
  }, token);
  if (!Array.isArray(session.questions) || session.questions.length !== QUESTION_COUNT)
    throw new Error(`Expected a ${QUESTION_COUNT}-question synthetic session`);
  for (let index = 0; index < session.questions.length; index++) {
    if (index) session = { ...session, ...await request('visit', 'POST', `/api/training/sessions/${session.id}/actions?response=delta`, { type: 'visit', index, revision: session.revision }, token) };
    session = { ...session, ...await request('answer', 'POST', `/api/training/sessions/${session.id}/actions?response=delta`, { type: 'answer', choice: index % 4, confidence: 'sure', revision: session.revision }, token) };
  }
  const completed = await request('finish', 'POST', `/api/training/sessions/${session.id}/actions?response=delta`, { type: 'finish', revision: session.revision }, token);
  if (completed.status !== 'completed' || completed.result?.attempted !== QUESTION_COUNT)
    throw new Error('Synthetic lifecycle did not complete every question');
  await request('dashboard', 'GET', '/api/training/dashboard?exam=ssc-cgl', undefined, token);
}

async function verifyHealth() {
  const health = await request('health', 'GET', '/api/health');
  if (health.ok !== true || health.state !== 'ready')
    throw new Error('Target /api/health is not ready');
  if (typeof health.releaseId !== 'string' || !health.releaseId)
    throw new Error('Target /api/health did not provide a releaseId');
  if (!TARGETS.has(health.environment) || health.environment !== config.target)
    throw new Error('Target /api/health environment does not match TRAINING_REMOTE_TARGET');
  const expectedReleaseId = process.env.TRAINING_REMOTE_EXPECTED_RELEASE_ID?.trim() || null;
  if (expectedReleaseId && health.releaseId !== expectedReleaseId)
    throw new Error('Target /api/health releaseId does not match TRAINING_REMOTE_EXPECTED_RELEASE_ID');
  return {
    deployedReleaseId: health.releaseId,
    deployedEnvironment: health.environment,
    healthState: health.state,
    serviceMode: typeof health.mode === 'string' ? health.mode : null,
    expectedReleaseId,
  };
}

let health = null;
try {
  health = await verifyHealth();
  const actors = await Promise.all(
    credentials.slice(0, config.concurrency).map(async ({ email, password }) => {
      const login = await request('login', 'POST', '/auth/login', { email, password });
      if (typeof login.token !== 'string' || !login.token)
        throw new Error('Login response did not include an access token');
      return { token: login.token };
    })
  );
  for (let run = 0; run < config.runs; run++)
    await Promise.all(actors.map(actor => runLifecycle(actor.token)));
  const operations = summarize(samples);
  const report = {
    schemaVersion: 1,
    status: 'completed',
    runId,
    timestamp: new Date().toISOString(),
    expectedHost,
    deployedReleaseId: health.deployedReleaseId,
    deployedEnvironment: health.deployedEnvironment,
    expectedReleaseId: health.expectedReleaseId,
    healthState: health.healthState,
    serviceMode: health.serviceMode,
    target: config.target,
    scenario: 'authenticated-training-lifecycle',
    runs: config.runs,
    concurrency: config.concurrency,
    questionsPerSession: QUESTION_COUNT,
    operations,
    errors: Object.values(operations).reduce((total, operation) => total + operation.errors, 0),
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ runId, reportPath, target: config.target, operations, errors: report.errors }));
  if (report.errors) process.exitCode = 1;
} catch (error) {
  console.error(`Remote training probe failed: ${error.message}`);
  const failureReport = {
    schemaVersion: 1,
    status: 'failed',
    runId,
    timestamp: new Date().toISOString(),
    expectedHost,
    ...(health ? {
      deployedReleaseId: health.deployedReleaseId,
      deployedEnvironment: health.deployedEnvironment,
      expectedReleaseId: health.expectedReleaseId,
      healthState: health.healthState,
      serviceMode: health.serviceMode,
    } : {}),
    target: config.target,
    scenario: 'authenticated-training-lifecycle',
    failure: {
      operation: error.operation ?? null,
      message: error.message,
    },
    runs: config.runs,
    concurrency: config.concurrency,
    questionsPerSession: QUESTION_COUNT,
    operations: summarize(samples),
  };
  try {
    await writeFile(reportPath, JSON.stringify(failureReport, null, 2) + '\n', { flag: 'wx' });
  } catch {
    // Report file may already exist or path may be invalid; do not mask the original error.
  }
  process.exitCode = 1;
}
