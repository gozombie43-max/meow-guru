import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { authorizeAiRequest, releaseAiRequest } from './ai-route-security';
afterEach(() => vi.unstubAllGlobals());
it('obtains and releases a shared lease with the authenticated user token', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ leaseId: 'lease-1' }), { status: 200 })).mockResolvedValueOnce(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  const req = new NextRequest('http://localhost/api/translate', { headers: { Authorization: 'Bearer test' } });
  expect(await authorizeAiRequest(req)).toBeNull();
  await releaseAiRequest(req);
  expect(fetchMock.mock.calls[0][0]).toContain('/api/ai/quota');
  expect(fetchMock.mock.calls[1][0]).toContain('/api/ai/quota/lease-1');
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE', headers: { Authorization: 'Bearer test' } });
  await releaseAiRequest(req);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('preserves quota and service failures instead of reporting them as invalid credentials', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '30' } })));
  const req = new NextRequest('http://localhost/api/diagram', { headers: { Authorization: 'Bearer test' } });
  const denied = await authorizeAiRequest(req);
  expect(denied?.status).toBe(429); expect(denied?.headers.get('retry-after')).toBe('30');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  expect((await authorizeAiRequest(req))?.status).toBe(503);
});
