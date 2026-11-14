import { expect, test } from '@playwright/test';

const DEV_ONLY_ROUTES = [
  '/glass-test',
  '/preview-palette',
  '/dev/convex-auth',
  '/ai-test',
] as const;

test.describe('P0-C development route gating in production build', () => {
  test('unauthenticated request to /preview-palette no longer bypasses access gate', async ({
    request,
  }) => {
    const response = await request.get('/preview-palette', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toBe('/access-code?redirect=%2Fpreview-palette');
  });

  for (const route of DEV_ONLY_ROUTES) {
    test(`returns 404 for authenticated request to ${route}`, async ({ context, page }, testInfo) => {
      await context.addCookies([
        {
          name: 'access_session',
          value: 'screenshot-fixture',
          url: testInfo.project.use.baseURL!,
        },
      ]);
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(404);
    });
  }
});
