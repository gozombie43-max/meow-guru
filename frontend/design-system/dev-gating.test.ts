import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { createAccessSessionToken, proxy } from '@/proxy';

describe('P0-C dev route gating & proxy removal', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('no longer exempts /preview-palette in proxy access gate', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ACCESS_CODE', 'secret-access-code');
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-32-chars-long-security');
    vi.stubEnv('ALLOW_LOCAL_ACCESS_FIXTURES', '0');

    const req = new NextRequest('http://localhost:3000/preview-palette');
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/access-code?redirect=%2Fpreview-palette',
    );
  });

  it('allows valid access_session cookie through proxy so route guard owns 404 in prod', async () => {
    const secret = 'test-session-secret-32-chars-long-security';
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ACCESS_CODE', 'secret-access-code');
    vi.stubEnv('SESSION_SECRET', secret);

    const cookie = createAccessSessionToken('access', Date.now(), secret);
    expect(cookie).toBeTruthy();

    const req = new NextRequest('http://localhost:3000/preview-palette', {
      headers: { cookie: `access_session=${cookie}` },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('calls notFound() outside development on /glass-test and /preview-palette', async () => {
    const { default: GlassTestPage } = await import('@/app/(app)/glass-test/page');
    const { default: PalettePreviewPage } = await import('@/app/(app)/preview-palette/page');

    vi.stubEnv('NODE_ENV', 'production');

    for (const renderPage of [GlassTestPage, PalettePreviewPage]) {
      let thrown: { digest?: string; message?: string } | null = null;
      try {
        renderPage();
      } catch (error) {
        thrown = error as { digest?: string; message?: string };
      }
      expect(thrown).not.toBeNull();
      expect(`${thrown?.message ?? ''} ${thrown?.digest ?? ''}`).toMatch(
        /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/,
      );
    }
  });

  it('renders dev preview content only when NODE_ENV === "development"', async () => {
    const { default: GlassTestPage } = await import('@/app/(app)/glass-test/page');
    const { default: PalettePreviewPage } = await import('@/app/(app)/preview-palette/page');

    vi.stubEnv('NODE_ENV', 'development');

    expect(GlassTestPage()).toBeTruthy();
    expect(PalettePreviewPage()).toBeTruthy();
  });

  it('removes orphaned /ai-test layout', () => {
    const orphanPath = path.resolve(process.cwd(), 'app/ai-test/layout.tsx');
    expect(fs.existsSync(orphanPath)).toBe(false);
  });
});
