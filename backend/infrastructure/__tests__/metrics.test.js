import { afterAll, expect, it, vi } from 'vitest';
import express from 'express';
import { metricsHandler, recordHttp, registry } from '../metrics.js';
afterAll(() => vi.unstubAllEnvs());
it('exports bounded route metrics and requires a dedicated scrape token', async () => {
  recordHttp({ method: 'GET', path: '/questions/private-id', baseUrl: '/api/questions', route: { path: '/:id' } }, { statusCode: 200 }, 100);
  const metrics = await registry.metrics();
  expect(metrics).toContain('route="/api/questions/:id"');
  expect(metrics).not.toContain('private-id');
  const app = express(); app.get('/metrics', metricsHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/metrics`;
  try {
    vi.stubEnv('METRICS_TOKEN', ''); expect((await fetch(url)).status).toBe(404);
    vi.stubEnv('METRICS_TOKEN', 'test-scrape-token'); expect((await fetch(url)).status).toBe(401);
    const response = await fetch(url, { headers: { Authorization: 'Bearer test-scrape-token' } });
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
