import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('authenticated assessment survives reload and submits without leaking answers', async ({ page, context, request }, testInfo) => {
  // Confidential tests allow one attempt per user. Screenshot captures submit
  // the seeded user's attempt, so each assessment run needs its own account.
  const credentials = { email: `assessment-${testInfo.project.name}-${randomUUID()}@example.test`, password: 'Browser-fixture-123!' };
  const registration = await request.post('http://127.0.0.1:3111/auth/register', {
    data: { name: 'Assessment Student', ...credentials },
  });
  expect(registration.ok(), 'Create an isolated assessment account').toBeTruthy();
  const login = await request.post('http://127.0.0.1:3111/auth/login', { data: credentials });
  expect(login.ok()).toBeTruthy();
  const refreshCookie = login.headers()['set-cookie'].split(';')[0].slice('refreshToken='.length);
  await context.addCookies([
    { name: 'refreshToken', value: refreshCookie, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'access_session', value: 'local-navigation-fixture', domain: '127.0.0.1', path: '/' },
  ]);
  // Send browser API traffic to the disposable fixture, regardless of the build's
  // backend rewrite. No production service receives browser test traffic.
  const startup = { posts: 0, attemptReads: 0 };
  await context.route('**/backend-api/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/backend-api', '');
    if (path.endsWith('/start') && route.request().method() === 'POST') startup.posts++;
    if (/\/api\/mocktest\/attempt\/[^/]+$/.test(path) && route.request().method() === 'GET') startup.attemptReads++;
    return route.fetch({ url: `http://127.0.0.1:3111${path}${new URL(route.request().url()).search}` }).then(response => route.fulfill({ response }));
  });
  const profile = page.waitForResponse(response => response.url().endsWith('/users/me') && response.ok());
  await page.goto('/mock-test/ssc-cgl/browser-test');
  await profile;
  await page.getByRole('button', { name: /Start Test/ }).click();
  await expect(page.getByRole('radio').nth(1)).toBeVisible();
  expect(startup).toEqual({ posts: 1, attemptReads: 0 });
  await page.getByRole('radio').nth(1).check();
  const save = page.waitForResponse(response => response.url().includes('/autosave') && response.status() === 200);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await save;
  await page.reload();
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  expect(startup).toEqual({ posts: 1, attemptReads: 1 });
  await expect(page.getByText('Private worked solution')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('assessment.png'), fullPage: true });
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: /^Q / }).click();
  await page.getByRole('button', { name: 'Submit Test', exact: true }).first().click();
  await page.getByRole('button', { name: 'Submit Test', exact: true }).last().click();
  await expect(page.getByText('Your Result Summary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review Questions & Solutions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retake Test' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
