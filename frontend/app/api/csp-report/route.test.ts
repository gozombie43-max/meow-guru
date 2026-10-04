// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { POST } from './route';
afterEach(() => vi.restoreAllMocks());
const request = (body: string, headers = {}) => new Request('https://example.test/api/csp-report', { method: 'POST', body, headers });
it('logs bounded CSP reports with query strings removed', async () => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const response = await POST(request(JSON.stringify({ 'csp-report': { 'effective-directive': 'connect-src', 'blocked-uri': 'https://other.test/path?token=sensitive', 'script-sample': 'sensitive' } })));
  expect(response.status).toBe(204); expect(log).toHaveBeenCalledWith('CSP report', { directive: 'connect-src', blockedOrigin: 'https://other.test' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive');
});
it('rejects malformed reports and oversized bodies, including a missing size header', async () => {
  expect((await POST(request('not-json'))).status).toBe(400);
  expect((await POST(request('{}'))).status).toBe(400);
  expect((await POST(request('a'.repeat(20000)))).status).toBe(413);
  expect((await POST(request('{}', { 'content-length': '20000' }))).status).toBe(413);
});
