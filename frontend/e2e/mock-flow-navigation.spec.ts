import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { verifyFixtureEmail } from './helpers/verify-fixture-email';

test.beforeEach(async ({ context, request }, testInfo) => {
  const credentials = { email: `mock-flow-${testInfo.project.name}-${randomUUID()}@example.test`, password: 'Browser-fixture-123!' };
  expect((await request.post('http://127.0.0.1:3111/auth/register', { data: { name: 'Flow Student', ...credentials } })).ok()).toBeTruthy();
  await verifyFixtureEmail(request, credentials.email);
  const login = await request.post('http://127.0.0.1:3111/auth/login', { data: credentials });
  expect(login.ok()).toBeTruthy();
  const value = login.headers()['set-cookie'].split(';')[0].slice('refreshToken='.length);
  await context.addCookies([
    { name: 'refreshToken', value, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    { name: 'access_session', value: 'local-navigation-fixture', domain: '127.0.0.1', path: '/' },
  ]);
  await context.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    // Forward the browser request directly so navigation can cancel it without
    // leaving a separate fetch callback trying to fulfill an already handled route.
    await route.continue({ url: `http://127.0.0.1:3111${url.pathname.replace('/backend-api', '')}${url.search}` });
  });
});

test.afterEach(async ({ context }) => { await context.unrouteAll({ behavior: 'wait' }); });

for (const kind of ['mock', 'pyq']) {
  test(`${kind}: Resume waits for the current attempt before running a cached timer`, async ({ page }) => {
    test.setTimeout(90000);
    await page.clock.install();
    const title = kind === 'pyq' ? 'Browser PYQ 2025' : 'Browser practice mock';
    const testId = kind === 'pyq' ? 'browser-pyq' : 'browser-practice';
    let submissions = 0;
    page.on('request', request => {
      if (request.method() === 'POST' && request.url().endsWith('/submit')) submissions++;
    });
    // Restore a stale cached countdown while the server still has time left.
    // The fresh attempt GET must finish before this countdown can submit.
    await page.route(`**/backend-api/api/mocktest/ssc-cgl/${testId}/start`, async route => {
      const response = await route.fetch({ url: `http://127.0.0.1:3111/api/mocktest/ssc-cgl/${testId}/start` });
      await route.fulfill({ response, json: { ...await response.json(), timeLeft: 60 } });
    });
    await page.route('**/backend-api/api/mocktest/attempt/*', async route => {
      if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fallback();
    });
    await page.goto(`/mock-test/ssc-cgl${kind === 'pyq' ? '?tab=prev' : ''}`);
    const catalogUrl = page.url();
    const card = page.getByRole('article').filter({ hasText: title });
    await card.getByRole('button', { name: 'Start Mock', exact: true }).click();
    await page.getByRole('button', { name: 'Start Mock Test', exact: true }).click();
    await expect(page.getByRole('radio').first()).toBeVisible();
    const attemptUrl = new URL(page.url());
    attemptUrl.searchParams.delete('lang');
    await page.getByRole('button', { name: 'Leave mock test' }).click();
    await page.getByRole('button', { name: 'Exit quiz', exact: true }).click();
    await expect(page).toHaveURL(catalogUrl);
    await page.clock.fastForward(65000);
    await card.getByRole('button', { name: 'Resume Mock', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading test…' })).toBeVisible();
    await page.clock.fastForward(1000);
    expect(submissions).toBe(0);
    await expect(page.getByRole('radio').first()).toBeVisible();
    await page.clock.fastForward(5000);
    await expect(page).toHaveURL(attemptUrl.toString());
    await expect(page.getByRole('radio').first()).toBeVisible();
    expect(submissions).toBe(0);
  });

  test(`${kind}: instructions, exit, resume, submit, review and retake preserve parent history`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const mobile = testInfo.project.name === 'mobile';
    const title = kind === 'pyq' ? 'Browser PYQ 2025' : 'Browser practice mock';
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Slow data reads expose the actual destination loading UI in the browser.
    await page.route(/\/backend-api\/api\/mocktest\/(?:slots\/browser-|attempt\/[^/?]+(?:\?|$))/, async route => {
      if (route.request().method() === 'GET') await new Promise(resolve => setTimeout(resolve, 600));
      await route.fallback();
    });
    await page.goto('/mock-test');
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'SSC CGL', exact: true }) }).click();
    await expect(page).toHaveURL(/\/mock-test\/ssc-cgl$/);
    if (kind === 'pyq') await page.getByRole('button', { name: mobile ? /^PYQs/ : /^Previous Papers/ }).click();
    if (kind === 'pyq') await expect(page).toHaveURL(/tab=prev/);
    const catalogUrl = page.url();
    const card = page.getByRole('article').filter({ hasText: title });
    await card.getByRole('button', { name: 'Start Mock', exact: true }).click();
    const instructionsLoading = page.getByRole('status').filter({ hasText: 'Loading test instructions…' });
    await expect(instructionsLoading).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to all exams' })).not.toBeVisible();
    if (mobile) {
      const box = await instructionsLoading.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.y + box!.height / 2 - 422)).toBeLessThan(2);
    }
    await expect(page.getByRole('button', { name: 'Start Mock Test', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to mock tests', exact: true }).click();
    await expect(page).toHaveURL(catalogUrl);
    await card.getByRole('button', { name: 'Start Mock', exact: true }).click();
    await page.getByRole('button', { name: 'Start Mock Test', exact: true }).click();
    await expect(page.getByRole('radio').first()).toBeVisible();
    const firstAttemptUrl = page.url();
    await page.evaluate(() => history.back());
    await expect(page.getByRole('dialog', { name: 'Exit quiz?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page).toHaveURL(firstAttemptUrl);
    await page.getByRole('button', { name: 'Leave mock test' }).click();
    await page.getByRole('button', { name: 'Exit quiz', exact: true }).click();
    await expect(page).toHaveURL(catalogUrl);
    await card.getByRole('button', { name: 'Resume Mock', exact: true }).click();
    await expect(page.getByRole('radio').first()).toBeVisible();
    if (mobile) await page.getByRole('button', { name: /^Q / }).click();
    await page.getByRole('button', { name: 'Submit Test', exact: true }).first().click();
    await page.getByRole('button', { name: 'Submit Test', exact: true }).last().click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading results…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to all exams' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Test result', exact: true })).toBeVisible();
    const resultUrl = page.url();
    const sectionReview = page.getByRole('region', { name: 'Section results', exact: true }).getByRole('button', { name: /^Review / }).first();
    await sectionReview.click();
    await expect(page).toHaveURL(/\/review\/[^/?]+\?section=/);
    await expect(page.getByRole('combobox', { name: 'Section', exact: true })).toHaveValue('0');
    await page.getByRole('button', { name: 'Back to results', exact: true }).click();
    await expect(page).toHaveURL(resultUrl);
    await page.getByRole('button', { name: 'Review answers', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading answer review…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to all exams' })).not.toBeVisible();
    await expect(page.getByText('Answer review', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Questions/ }).click();
    await expect(page.getByRole('dialog', { name: 'Jump to question' })).toBeVisible();
    await page.evaluate(() => history.back());
    await expect(page.getByRole('dialog', { name: 'Jump to question' })).not.toBeVisible();
    await expect(page).toHaveURL(/\/review\//);
    await page.getByRole('button', { name: 'Back to results' }).click();
    await expect(page).toHaveURL(resultUrl);
    await page.evaluate(() => history.back());
    await card.getByRole('button', { name: 'View Result', exact: true }).click();
    await expect(page).toHaveURL(resultUrl);
    await page.getByRole('button', { name: 'Retake', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Test language' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Mock Test', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Mock Test', exact: true }).click();
    await expect(page.getByRole('radio').first()).toBeVisible();
    expect(page.url()).not.toBe(firstAttemptUrl);
    await page.getByRole('button', { name: 'Leave mock test' }).click();
    await page.getByRole('button', { name: 'Exit quiz', exact: true }).click();
    await expect(page).toHaveURL(catalogUrl);
    if (mobile) await page.getByRole('button', { name: 'Back to all exams' }).click();
    else await page.getByRole('button', { name: 'All Exams', exact: true }).first().click();
    await expect(page).toHaveURL(/\/mock-test$/);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${kind}-returned-to-exams.png`) });
  });
}

test('missing instructions show recovery instead of an endless loader', async ({ page }) => {
  await page.goto('/mock-test/ssc-cgl/missing-paper');
  await expect(page.getByRole('alert').filter({ hasText: 'Failed to fetch slot' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry loading instructions' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to mock tests' }).click();
  await expect(page).toHaveURL(/\/mock-test\/ssc-cgl$/);
});
