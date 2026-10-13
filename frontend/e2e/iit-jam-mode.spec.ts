import { test, expect, type BrowserContext } from '@playwright/test';
const frontend = process.env.JAM_UI_ORIGIN || 'http://127.0.0.1:3110';
const backend = 'http://127.0.0.1:3111';
async function connect(context: BrowserContext, token: string) {
  await context.addCookies([{ name: 'access_session', value: 'local-jam-fixture', url: frontend }]);
  await context.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/backend-api/, '');
    if (path === '/auth/refresh') return route.fulfill({ json: { token } });
    const response = await route.fetch({ url: `${backend}${path}${url.search}` });
    await route.fulfill({ response });
  });
}
test.afterEach(async ({ context }) => { await context.unrouteAll({ behavior: 'wait' }); });
for (const width of [320, 390, 1366]) for (const theme of ['dark', 'light']) {
  test(`JAM mode shared pages ${width}px ${theme}`, async ({ page, context, request }, info) => {
    test.setTimeout(180000);
    const login = await request.post(`${backend}/auth/login`, { data: { email: 'browser-mobile@example.test', password: 'Browser-fixture-123!' } });
    expect(login.ok()).toBeTruthy();
    const { token } = await login.json();
    await connect(context, token);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(theme => { localStorage.setItem('ui-theme', theme); }, theme);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Your profile', exact: true }).filter({ visible: true })).toBeVisible({ timeout: 30000 });
    if (width < 768) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'true');
    }
    const toggle = page.getByRole('switch', { name: 'IIT JAM Mode' }).filter({ visible: true });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect((await toggle.boundingBox())!.width).toBeGreaterThan(200);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    if (width < 768) {
      await page.screenshot({ path: info.outputPath('jam-sidebar.png') });
      await page.getByRole('button', { name: 'Close sidebar' }).click();
      await expect(page.getByRole('button', { name: 'Close sidebar' })).not.toBeInViewport();
    }
    await expect(page.getByRole('heading', { name: /Big breakthroughs/ }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all', exact: true }).filter({ visible: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('jam-home.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Big breakthroughs/ }).filter({ visible: true })).toBeVisible();
    await page.goto('/mock-test');
    await expect(page.getByRole('heading', { name: 'IIT JAM Physics Mock Test', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /20 questions per test/ })).toHaveCount(7);
    await page.screenshot({ path: info.outputPath('jam-mocks.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Previous Years', exact: true }).click();
    await expect(page.getByRole('link', { name: /Previous year papers/ })).toHaveAttribute('href', '/mock-test/iit-jam-physics?tab=prev');
    await page.getByRole('link', { name: /Previous year papers/ }).click();
    await expect(page.getByRole('heading', { name: 'IIT JAM Physics', exact: true })).toBeVisible();
    await page.goto('/mock-test/iit-jam-physics-mathematical-methods');
    await expect(page.getByRole('heading', { name: 'Mathematical Methods', exact: true })).toBeVisible();
    await page.goto('/subjects/iit-jam-physics/mathematical-methods');

    await expect(page.getByRole('heading', { name: 'Mathematical Methods', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /Vector Algebra and Vector Calculus/ }).filter({ visible: true }).click();
    await expect(page.getByRole('heading', { name: 'Vector Algebra and Vector Calculus', exact: true })).toBeVisible();
    await expect(page.getByText('Formula practice', { exact: true })).toBeVisible();
    const removedOverview = await page.goto('/subjects/iit-jam-physics');
    expect(removedOverview?.status()).toBe(404);
    await page.goto('/resource');
    await expect(page.getByText('Mathematical Methods', { exact: true }).first()).toBeVisible();
    await page.goto('/ai-chat');
    await expect(page.getByText('IIT JAM Physics study assistant')).toBeVisible();
    await page.goto('/play');
    await expect(page.getByText('IIT JAM Physics', { exact: true }).first()).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Your profile', exact: true }).filter({ visible: true })).toBeVisible({ timeout: 30000 });
    if (width < 768) {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'true');
    }
    await page.getByRole('switch', { name: 'IIT JAM Mode' }).filter({ visible: true }).click();
    if (width < 768) await page.getByRole('button', { name: 'Close sidebar' }).click();
    await expect(page.getByRole('heading', { name: /Big breakthroughs/ })).toHaveCount(0);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('study-guru:exam-mode'))).toBe('ssc');
    await page.goto('/mock-test');
    await expect(page.getByText('SSC CGL', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('JAM fixed paper saves mixed answer types and grades with the real API and Mongo fixture', async ({ request }) => {
  test.skip(process.env.JAM_MODE_FIXTURE !== '1', 'Requires the opt-in disposable JAM fixture');
  const login = await request.post(`${backend}/auth/login`, { data: { email: 'browser-desktop@example.test', password: 'Browser-fixture-123!' } });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const start = await request.post(`${backend}/api/mocktest/iit-jam-physics/jam-browser-test/start`, { headers });
  expect(start.ok(), await start.text()).toBeTruthy();
  const attempt = await start.json();
  expect(attempt.paper.sections.flatMap((s: { questions: unknown[] }) => s.questions)).toHaveLength(60);
  expect(JSON.stringify(attempt.paper)).not.toContain('correctAnswer');
  const answers = { 'jam-a1-0': '0', 'jam-a2-0': '1', 'jam-b-0': ['0', '2'], 'jam-c1-0': '0', 'jam-c2-0': '2' };
  const save = await request.patch(`${backend}/api/mocktest/attempt/${attempt.attemptId}/autosave`, { headers, data: { revision: 1, baseRevision: 0, answers, questionStatuses: {}, currentSection: 0, currentQuestion: 0 } });
  expect(save.ok(), await save.text()).toBeTruthy();
  const submit = await request.post(`${backend}/api/mocktest/attempt/${attempt.attemptId}/submit`, { headers });
  expect(submit.ok(), await submit.text()).toBeTruthy();
  const review = await request.get(`${backend}/api/mocktest/attempt/${attempt.attemptId}`, { headers });
  const result = await review.json();
  expect(result.answers).toEqual(answers);
  expect(result.result.totalScore).toBe(3.33);
  expect(result.result.maxScore).toBe(100);
});
