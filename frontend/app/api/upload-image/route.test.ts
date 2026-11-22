// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_BYTES, POST } from './route';
import * as httpModule from '@/lib/api/http';

vi.mock('@/lib/api/http', () => ({
  fetchWithRetry: vi.fn(),
}));

describe('POST /api/upload-image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const req = new Request('https://app.example.test/api/upload-image', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects payloads exceeding 10 MB via Content-Length with 413', async () => {
    const req = new Request('https://app.example.test/api/upload-image', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Length': String(MAX_UPLOAD_BYTES + 1024),
      },
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(httpModule.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('forwards req.signal and X-Request-ID and preserves non-JSON 502/504 upstream status codes', async () => {
    vi.mocked(httpModule.fetchWithRetry).mockResolvedValueOnce(
      new Response('<html><body>504 Gateway Time-out</body></html>', {
        status: 504,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    const formData = new FormData();
    formData.append('image', new Blob(['hello'], { type: 'image/png' }), 'test.png');

    const req = new Request('https://app.example.test/api/upload-image?examMode=jam', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-jwt',
        'X-Request-ID': 'req-corr-123',
      },
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: 'Upload service returned status 504',
    });

    expect(httpModule.fetchWithRetry).toHaveBeenCalledWith(
      expect.stringContaining('/api/upload/image-question?examMode=jam'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-jwt',
          'X-Request-ID': 'req-corr-123',
        }),
        signal: expect.any(AbortSignal),
      }),
      expect.any(Object)
    );
  });
});
