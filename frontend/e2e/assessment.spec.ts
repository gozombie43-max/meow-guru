import { test, expect } from '@playwright/test';

test('authenticated assessment survives reload and submits without leaking answers', async ({ page, context, request }, testInfo) => {
  const login = await request.post('http://127.0.0.1:3111/auth/login', { data: { email: `browser-${testInfo.project.name}@example.test`, password: 'Browser-fixture-123!' } });
  expect(login.ok()).toBeTruthy();
  const refreshCookie = login.headers()['set-cookie'].split(';')[0].slice('refreshToken='.length);
  await context.addCookies([
    { name: 'refreshToken', value: refreshCookie, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'access_session', value: 'local-navigation-fixture', domain: '127.0.0.1', path: '/' },
  ]);
  // Send browser API traffic to the disposable fixture, regardless of the build's
  // backend rewrite. No production service receives browser test traffic.
  await context.route('**/backend-api/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/backend-api', '');
    return route.fetch({ url: `http://127.0.0.1:3111${path}${new URL(route.request().url()).search}` }).then(response => route.fulfill({ response }));
  });
  await page.goto('/mock-test/ssc-cgl/browser-test/attempt');
  await expect(page.getByRole('radio').nth(1)).toBeVisible();
  await page.getByRole('radio').nth(1).check();
  const save = page.waitForResponse(response => response.url().includes('/autosave') && response.status() === 200);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await save;
  await page.reload();
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
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
