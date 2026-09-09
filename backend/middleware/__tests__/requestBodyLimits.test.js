import { afterAll, beforeAll, expect, it } from 'vitest';
import express from 'express';
import { requestBodyLimits } from '../requestBodyLimits.js';
let server, base;
beforeAll(async () => {
  const app = express();
  app.use(requestBodyLimits);
  app.post('/api/ai/explain', (_req, res) => res.json({ ok: true }));
  app.post('/api/questions/bulk', (_req, res) => res.json({ ok: true }));
  app.post('/api/mocktest/admin/upload-paper', (_req, res) => res.json({ ok: true }));
  app.use((err, _req, res, _next) => res.status(err.status || 500).end());
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
it('rejects oversized ordinary JSON and preserves explicit upload limits', async () => {
  const body = JSON.stringify({ content: 'x'.repeat(300000) });
  const post = path => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  expect((await post('/api/ai/explain')).status).toBe(413);
  expect((await post('/api/questions/bulk')).status).toBe(200);
  expect((await post('/api/mocktest/admin/upload-paper')).status).toBe(200);
});
