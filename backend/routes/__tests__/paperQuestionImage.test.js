import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import express from 'express';
import sharp from 'sharp';
const { send } = vi.hoisted(() => ({ send: vi.fn(async () => ({})) }));
vi.mock('../../config/b2.js', () => ({ b2Client: { send }, B2_BUCKET: 'image-test' }));
vi.mock('../../middleware/auth.js', () => ({ default: (req, res, next) => req.headers['x-test-admin'] === '1' ? next() : res.sendStatus(403) }));
import imageRoutes from '../imageUpload.js';
let server, base, png;
beforeAll(async () => {
  png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#007aff' } }).png().toBuffer();
  const app = express(); app.use('/api/upload', imageRoutes);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
const upload = async (route, admin = true) => {
  const body = new FormData(); body.append('image', new Blob([png], { type: 'image/png' }), 'question.png');
  return fetch(`${base}/api/upload/${route}`, { method: 'POST', headers: admin ? { 'x-test-admin': '1' } : {}, body });
};

it('uploads question images as WebP in the question namespace and returns a stable preview URL', async () => {
  const response = await upload('question-image');
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.key).toMatch(/^question-images\/question_.*\/question.webp$/);
  expect(data.url).toContain('/api/upload/image/');
  const stored = send.mock.calls.at(-1)[0].input;
  expect(stored.Key).toBe(data.key); expect(stored.ContentType).toBe('image/webp');
  expect(await sharp(stored.Body).metadata()).toMatchObject({ format: 'webp', width: 20, height: 10 });
});

it('retains solution uploads and requires admin authentication for question uploads', async () => {
  expect((await upload('question-image', false)).status).toBe(403);
  const response = await upload('solution-image');
  expect(response.status).toBe(200);
  expect((await response.json()).key).toMatch(/^solution-images\/solution_.*\/solution.webp$/);
  const missing = await fetch(`${base}/api/upload/question-image`, { method: 'POST', headers: { 'x-test-admin': '1' } });
  expect(missing.status).toBe(400); expect((await missing.json()).error).toBe('Question image required');
});
