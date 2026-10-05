// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicTopicCounts } from './publicCatalog';

const catalog = {
  subject: 'mathematics',
  revision: 7,
  updatedAt: '2026-10-05T00:00:00.000Z',
  totals: { Algebra: 12, Geometry: 0 },
};

beforeEach(() => {
  vi.stubEnv('API_URL', 'https://api.example.test///');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('public catalog seed', () => {
  it('requests shared counts without credentials and returns only public fields', async () => {
    const payload = { ...catalog, userProgress: { completed: 4 }, accessToken: 'private-token' };
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal('fetch', fetcher);

    expect(await getPublicTopicCounts('mathematics')).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      'https://api.example.test/api/questions/topic-counts?subject=mathematics',
      {
        credentials: 'omit',
        next: { revalidate: 60, tags: ['question-catalog'] },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it('encodes the subject when constructing the backend request', async () => {
    const subject = 'general awareness';
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...catalog, subject }));
    vi.stubGlobal('fetch', fetcher);

    expect(await getPublicTopicCounts(subject)).toEqual({ ...catalog, subject });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.example.test/api/questions/topic-counts?subject=general%20awareness');
  });

  it('leaves the seed absent without a backend URL', async () => {
    vi.stubEnv('API_URL', undefined);
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    expect(await getPublicTopicCounts('mathematics')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['a different subject', { ...catalog, subject: 'english' }],
    ['a negative count', { ...catalog, totals: { Algebra: -1 } }],
    ['a fractional count', { ...catalog, totals: { Algebra: 1.5 } }],
    ['an invalid revision', { ...catalog, revision: 1.5 }],
    ['an incomplete response', { subject: 'mathematics' }],
  ])('leaves the seed absent for %s', async (_reason, payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));

    expect(await getPublicTopicCounts('mathematics')).toBeNull();
  });

  it('leaves the seed absent on HTTP, JSON, and transport failures', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response('Invalid JSON'))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(await getPublicTopicCounts('mathematics')).toBeNull();
    }
  });
});
