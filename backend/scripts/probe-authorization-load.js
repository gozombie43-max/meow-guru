import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { summarizeAuthorizationMetrics } from './lib/authorization-metrics.js';

// Explicit remote credentials only; never load the developer's .env implicitly.
const required = name => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
};
const target = required('AUTH_PROBE_TARGET');
if (!['local', 'staging', 'production'].includes(target)) throw new Error('Invalid AUTH_PROBE_TARGET');
const base = new URL(required('AUTH_PROBE_API_URL'));
if (base.username || base.password || base.pathname !== '/' || base.search || base.hash
  || !['http:', 'https:'].includes(base.protocol)) throw new Error('Supply a credential-free API origin');
if (base.hostname !== required('AUTH_PROBE_EXPECTED_HOST')) throw new Error('Unexpected target host');
if (target === 'production' && base.protocol !== 'https:') throw new Error('Production requires HTTPS');
if (target === 'local' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Local probes require loopback');
const rounds = Number(process.env.AUTH_PROBE_ROUNDS || 10);
const concurrency = Number(process.env.AUTH_PROBE_CONCURRENCY || 1);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new Error('Use 1-20 rounds and 1-3 concurrent requests');
const output = required('AUTH_PROBE_REPORT');
const runId = `auth-${randomUUID()}`;
const healthResponse = await fetch(`${base.origin}/${target === 'local' ? 'live' : 'health'}`, { signal: AbortSignal.timeout(15000) });
if (!healthResponse.ok) throw new Error('Target health failed');
const health = await healthResponse.json();
if (health.ok !== true || (target !== 'local' && health.environment !== target)) throw new Error('Target environment mismatch');
if (process.env.AUTH_PROBE_EXPECTED_RELEASE && health.releaseId !== process.env.AUTH_PROBE_EXPECTED_RELEASE) throw new Error('Target release mismatch');
const login = await fetch(`${base.origin}/auth/login`, {
  method: 'POST', signal: AbortSignal.timeout(15000),
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: required('AUTH_PROBE_EMAIL'), password: required('AUTH_PROBE_PASSWORD') }),
});
if (!login.ok) throw new Error(`Login failed: ${login.status}`);
const { token } = await login.json();
if (typeof token !== 'string' || !token) throw new Error('Login returned no access token');
let metricsInstance;
async function metrics() {
  if (!process.env.AUTH_PROBE_METRICS_TOKEN) return null;
  const response = await fetch(`${base.origin}/metrics`, { headers: { Authorization: `Bearer ${process.env.AUTH_PROBE_METRICS_TOKEN}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Metrics failed: ${response.status}`);
  const instance = response.headers.get('x-metrics-instance');
  if (!instance) throw new Error('Metrics instance identity unavailable; deploy measurement instrumentation first');
  if (metricsInstance && instance !== metricsInstance) throw new Error('Scrapes reached different API replicas; pin metrics to one process');
  metricsInstance = instance;
  return (await response.text()).split('\n').filter(line => /^meow_(auth_validation|mongo_command)/.test(line));
}
let sequence = 0;
async function read(round) {
  const requestId = `${runId}-${++sequence}`, start = performance.now();
  try {
    // Static policy after protect: isolates auth from domain database queries.
    const response = await fetch(`${base.origin}/api/training/capabilities`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Request-ID': requestId }, signal: AbortSignal.timeout(15000),
    });
    await response.arrayBuffer();
    return { round, requestId, serverRequestId: response.headers.get('x-request-id'), status: response.status, durationMs: performance.now() - start };
  } catch { return { round, requestId, status: 0, durationMs: performance.now() - start }; }
}
if ((await read('warmup')).status !== 200) throw new Error('Protected warmup failed');
const metricsStart = performance.now(), before = await metrics(), startedAt = new Date().toISOString(), start = performance.now(), samples = [];
for (let round = 1; round <= rounds; round++) {
  samples.push(...await Promise.all(Array.from({ length: concurrency }, () => read(round))));
  if (samples.some(row => row.status !== 200)) break;
  if (round < rounds) await new Promise(resolve => setTimeout(resolve, 1000));
}
const elapsedMs = performance.now() - start, after = await metrics();
const metricsElapsedMs = performance.now() - metricsStart;
const sorted = samples.map(row => row.durationMs).sort((a, b) => a - b);
await writeFile(output, JSON.stringify({ runId, target, apiOrigin: base.origin, label: process.env.AUTH_PROBE_RELEASE || 'unspecified', releaseId: health.releaseId || null, startedAt,
  elapsedMs, concurrency, samples, requests: samples.length, errors: samples.filter(row => row.status !== 200).length,
  httpP95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], httpRequestsPerSecond: samples.length * 1000 / elapsedMs,
  metrics: { before, after, instance: metricsInstance, elapsedMs: metricsElapsedMs, authorization: summarizeAuthorizationMetrics(before, after, metricsElapsedMs), scope: 'Whole scraped API instance; includes ambient traffic. Pin scrapes to one replica; aggregate all replicas separately.' },
}, null, 2) + '\n');
console.log(`Authorization probe wrote ${samples.length} request samples to ${output}`);
if (samples.some(row => row.status !== 200)) process.exitCode = 1;
