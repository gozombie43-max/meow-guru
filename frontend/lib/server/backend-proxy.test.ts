import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxyBackendPost } from './backend-proxy';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('forwards authorization and upstream errors without a separate quota request', async () => {
  vi.stubEnv('API_URL', 'https://api.example.test/');
  const fetcher = vi.fn().mockResolvedValue(new Response('quota exceeded', { status: 429, headers: { 'Retry-After': '3' } }));
  vi.stubGlobal('fetch', fetcher);
  const req = new NextRequest('https://app.example.test/api/translate', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json', Cookie: 'private=secret', 'X-Request-ID': 'request-1' }, body: '{}' });
  const res = await proxyBackendPost(req, '/api/ai/translate');
  expect(res.status).toBe(429); expect(res.headers.get('retry-after')).toBe('3');
  expect(await res.text()).toBe('quota exceeded'); expect(fetcher).toHaveBeenCalledOnce();
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/ai/translate');
  expect(options.headers.get('authorization')).toBe('Bearer test'); expect(options.headers.has('cookie')).toBe(false);
});
it('preserves binary responses and converts transport failures', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([0, 255, 1]), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=300' } })).mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', fetcher);
  const req = () => new NextRequest('https://app.example.test/api/tts', { method: 'POST', body: '{}' });
  const response = await proxyBackendPost(req(), '/api/ai/tts');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0, 255, 1]));
  expect(response.headers.get('cache-control')).toContain('private');
  expect((await proxyBackendPost(req(), '/api/ai/tts')).status).toBe(502);
});
