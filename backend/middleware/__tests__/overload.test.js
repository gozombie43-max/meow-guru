import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
const health = vi.hoisted(() => ({ runtime: { rssBytes: 0, eventLoopP99Ms: 0 }, waiting: 0, ai: {} }));
vi.mock('../../infrastructure/logger.js', () => ({ getRuntimeHealth: () => health.runtime }));
vi.mock('../../config/mongodb.js', () => ({ mongoPoolHealth: () => ({ waiting: health.waiting }) }));
vi.mock('../../infrastructure/dependencyBoundary.js', () => ({ dependencyHealth: () => ({ ai: health.ai }) }));
import { optionalWorkAdmission } from '../overload.js';

afterEach(() => { vi.unstubAllEnvs(); health.runtime = { rssBytes: 0, eventLoopP99Ms: 0 }; health.waiting = 0; health.ai = {}; });
async function exercise(check) {
  const app = express();
  app.use(optionalWorkAdmission);
  app.use((_req, res) => res.json({ accepted: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await check(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

it('sheds optional work under each measured pressure while admitting quiz, auth and progress', async () => {
  vi.stubEnv('USE_OVERLOAD_SHEDDING', 'true');
  await exercise(async base => {
    for (const pressure of ['memory', 'lag', 'mongo', 'ai']) {
      health.runtime = { rssBytes: pressure === 'memory' ? 1024 ** 3 : 0, eventLoopP99Ms: pressure === 'lag' ? 500 : 0 };
      health.waiting = pressure === 'mongo' ? 10 : 0;
      health.ai = pressure === 'ai' ? { active: 3, limit: 3, queued: 3 } : {};
      const optional = await fetch(`${base}/api/ai/generate`, { method: 'POST' });
      expect(optional.status).toBe(503);
      expect(optional.headers.get('Retry-After')).toBe('3');
      for (const path of ['/api/training/sessions/one/actions', '/api/mocktest/one/submit', '/auth/login', '/api/progress']) {
        expect((await fetch(`${base}${path}`, { method: 'POST' })).status).toBe(200);
      }
    }
  });
});

it('admits optional work when the gate is disabled or dependencies have recovered', async () => {
  health.waiting = 20;
  await exercise(async base => {
    expect((await fetch(`${base}/api/ai/generate`, { method: 'POST' })).status).toBe(200);
    vi.stubEnv('USE_OVERLOAD_SHEDDING', 'true'); health.waiting = 0;
    expect((await fetch(`${base}/api/ai/generate`, { method: 'POST' })).status).toBe(200);
  });
});
