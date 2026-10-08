import { expect, test } from '@playwright/test';

test('pending grouping polls only status and stops when the quiz unmounts', async ({ page, context }, info) => {
  await context.addCookies([{ name: 'access_session', value: 'local-fixture', url: 'http://127.0.0.1:3110' }]);
  const login = await context.request.post('http://127.0.0.1:3111/auth/login', { data: {
    email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!',
  } });
  expect(login.ok()).toBeTruthy();
  await page.clock.install();
  const metadata: string[] = [], statuses: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/questions/meta?')) metadata.push(request.url());
    if (request.url().includes('/api/questions/concept-groups/')) statuses.push(request.url());
  });
  await page.goto('/mathematics/advance/algebra/quiz');
  await expect(page.getByRole('button', { name: /^Start Quiz/ })).toBeEnabled();
  expect(metadata).toHaveLength(1); expect(statuses).toHaveLength(0);
  await page.clock.fastForward(10050);
  await expect.poll(() => statuses.length).toBe(1);
  await page.clock.fastForward(10100);
  await expect.poll(() => statuses.length).toBe(2);
  expect(metadata).toHaveLength(1);
  await page.goto('/mathematics/advance/geometry');
  await expect(page.locator('.sg-card').first()).toBeVisible();
  await page.clock.fastForward(30000);
  expect(statuses).toHaveLength(2); expect(metadata).toHaveLength(1);
});
