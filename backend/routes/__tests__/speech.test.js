import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import { signToken } from '../../auth/jwt.js';
import { synthesizeSpeech, translateTexts } from '../../services/speechService.js';
import speech from '../speech.js';
import { errorHandler } from '../../middleware/errorHandler.js';
const release = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../auth/sessions.js', () => ({ assertSession: vi.fn(async decoded => {
  if (decoded.id === 'revoked') throw Object.assign(new Error('Revoked'), { statusCode: 401 });
  return decoded;
}) }));
vi.mock('../../middleware/rateLimiter.js', () => ({ aiLimiter: (_req, _res, next) => next() }));
vi.mock('../../middleware/aiAdmission.js', () => ({ aiAdmission: (_req, res, next) => { res.once('finish', release); next(); } }));
vi.mock('../../services/speechService.js', () => ({ synthesizeSpeech: vi.fn(), translateTexts: vi.fn() }));
let server, base;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/ai', speech);
  app.get('/api/ai/poll', (_req, res) => res.json({ ok: true })); app.use(errorHandler);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => { vi.clearAllMocks(); synthesizeSpeech.mockResolvedValue(Buffer.from('mp3')); translateTexts.mockResolvedValue([{ translations: [{ text: 'translated', to: 'hi' }] }]); });
const post = (path, data, user = 'student') => fetch(`${base}/api/ai/${path}`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${signToken({ id: user })}` } : {}) }, body: JSON.stringify(data) });
it('rejects missing and revoked sessions before calling providers', async () => {
  expect((await post('tts', { text: 'hello' }, null)).status).toBe(401);
  expect((await post('translate', { texts: ['hello'], targetLang: 'hi' }, 'revoked')).status).toBe(401);
  expect(synthesizeSpeech).not.toHaveBeenCalled(); expect(translateTexts).not.toHaveBeenCalled();
});
it('validates payloads before acquiring admission or calling providers', async () => {
  for (const data of [{ texts: [], targetLang: 'hi' }, { texts: ['hello'], targetLang: 'fr' }, { texts: ['x'.repeat(2001)], targetLang: 'hi' }]) expect((await post('translate', data)).status).toBe(400);
  expect((await post('tts', { text: 'x'.repeat(5001) })).status).toBe(400);
  expect(release).not.toHaveBeenCalled(); expect(translateTexts).not.toHaveBeenCalled();
});
it('returns binary audio with private caching and releases admission', async () => {
  const response = await post('tts', { text: ' <hello> ', voice: 'invalid', rate: 'bad' });
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('audio/mpeg');
  expect(response.headers.get('cache-control')).toContain('private'); expect(await response.text()).toBe('mp3');
  expect(synthesizeSpeech).toHaveBeenCalledWith({ text: '<hello>', bengaliText: '', voice: 'en-IN-NeerjaNeural', rate: '0%' });
  expect(release).toHaveBeenCalledOnce();
});
it('returns translations and releases admission after provider failure', async () => {
  expect((await post('translate', { texts: ['hello'], targetLang: 'hi' })).status).toBe(200);
  translateTexts.mockRejectedValueOnce(Object.assign(new Error('Translation failed'), { statusCode: 502 }));
  expect((await post('translate', { texts: ['hello'], targetLang: 'hi' })).status).toBe(502);
  expect(release).toHaveBeenCalledTimes(2);
});
it('does not attach speech authentication to other AI endpoints', async () => {
  expect((await fetch(`${base}/api/ai/poll`)).status).toBe(200);
});
