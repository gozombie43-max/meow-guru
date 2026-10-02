import { afterEach, expect, it, vi } from 'vitest';
import { createDependencyBoundary } from '../dependencyBoundary.js';
import { featureEnabled } from '../featureRollout.js';
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

it('bounds active work and rejects queued overload without accumulating promises', async () => {
  const boundary = createDependencyBoundary('test.queue', { concurrency: 1, maxQueued: 1, queueTimeoutMs: 10 });
  let release;
  const first = boundary.execute(() => new Promise(resolve => { release = resolve; }));
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const second = boundary.execute(async () => 2);
  const check = expect(second).rejects.toMatchObject({ statusCode: 503 });
  await expect(boundary.execute(async () => 3)).rejects.toMatchObject({ statusCode: 503 });
  await check;
  release(1);
  expect(await first).toBe(1);
  expect(boundary.snapshot().active).toBe(0);
});

it('retains concurrency until timed-out work really settles and opens/recover circuits', async () => {
  let time = 0, release;
  const boundary = createDependencyBoundary('test.timeout', { concurrency: 1, maxQueued: 0, timeoutMs: 10, failureThreshold: 1, cooldownMs: 100, now: () => time });
  await expect(boundary.execute(() => new Promise(resolve => { release = resolve; }))).rejects.toMatchObject({ statusCode: 504 });
  expect(boundary.snapshot()).toMatchObject({ active: 1, circuit: 'open' });
  time = 200;
  await expect(boundary.execute(async () => 2)).rejects.toMatchObject({ statusCode: 503 });
  release();
  await vi.waitFor(() => expect(boundary.snapshot().active).toBe(0));
  expect(await boundary.execute(async () => 2)).toBe(2);
  expect(boundary.snapshot().circuit).toBe('closed');
});

it('rolls out stable user cohorts and handles invalid configuration safely', () => {
  vi.stubEnv('FEATURE_PERCENT', '50');
  const first = Array.from({ length: 1000 }, (_, i) => featureEnabled('FEATURE', String(i)));
  expect(first).toEqual(Array.from({ length: 1000 }, (_, i) => featureEnabled('FEATURE', String(i))));
  expect(first.filter(Boolean).length).toBeGreaterThan(400);
  expect(first.filter(Boolean).length).toBeLessThan(600);
  vi.stubEnv('FEATURE', 'false');
  expect(featureEnabled('FEATURE', 'one')).toBe(false);
});

it('aborts a caller promptly while retaining the slot for uncooperative work', async () => {
  const boundary = createDependencyBoundary('test.cancel', { concurrency: 1, maxQueued: 0, failureThreshold: 1 });
  const controller = new AbortController();
  let release;
  const operation = boundary.execute(() => new Promise(resolve => { release = resolve; }), { signal: controller.signal });
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const rejected = expect(operation).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort(); await rejected;
  expect(boundary.snapshot()).toMatchObject({ active: 1, circuit: 'closed' });
  release();
  await vi.waitFor(() => expect(boundary.snapshot().active).toBe(0));
});
