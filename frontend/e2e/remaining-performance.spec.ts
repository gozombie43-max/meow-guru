import { expect, test, type BrowserContext } from '@playwright/test';
const fixture = 'http://127.0.0.1:3111';

async function routeFixture(context: BrowserContext, token: string) {
  await context.addCookies([{ name: 'access_session', value: 'remaining-performance', url: 'http://127.0.0.1:3110' }]);
  await context.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/backend-api/, '');
    if (path === '/auth/refresh') return route.fulfill({ json: { token } });
    if (path === '/api/ai/tutor-chat') return route.fulfill({ json: { success: true, reply: 'Fixture answer' } });
    const response = await route.fetch({ url: `${fixture}${path}${url.search}` });
    await route.fulfill({ response });
  });
}

test('question 241 resumes in one question request and earlier navigation remains available', async ({ page, context, request }, info) => {
  await page.setViewportSize({ width: 360, height: 844 });
  const login = await request.post(`${fixture}/auth/login`, { data: { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' } });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const seed = await request.patch(`${fixture}/users/me/recent-quizzes`, { headers, data: {
    quizKey: 'mathematics:algebra', title: 'Algebra', subject: 'mathematics', href: '/mathematics/advance/algebra/quiz',
    mode: 'concept', currentIndex: 240, totalQuestions: 250, selectedAnswers: { 239: 1 }, submittedQuestions: [239], results: [],
  } });
  expect(seed.ok()).toBeTruthy();
  await routeFixture(context, token);
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', req => { if (req.url().includes('/api/questions/session?')) requests.push(req.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/mathematics/advance/algebra/quiz?resume=1');
  await expect(page.getByText(/x \+ 241 = 243/)).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain('resumeIndex=240');
  await page.getByRole('button', { name: /Open question navigator/ }).click();
  await page.getByRole('button', { name: 'Go to question 1', exact: true }).click();
  await expect(page.getByText(/x \+ 1 = 3/)).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toContain('windowOffset=0');
  expect(errors).toEqual([]);
});

test('chat persists appended messages with small acknowledgements and survives normal reconnects', async ({ page, context, request }, info) => {
  const login = await request.post(`${fixture}/auth/login`, { data: { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' } });
  const { token } = await login.json();
  await routeFixture(context, token);
  const writes: Array<{ sequence: number; messages: unknown[] }> = [];
  const acknowledgements: unknown[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (req.url().endsWith('/messages')) writes.push(req.postDataJSON()); });
  page.on('response', async response => { if (response.url().endsWith('/messages')) acknowledgements.push(await response.json()); });
  await page.goto('/ai-chat');
  const input = page.getByRole('textbox', { name: 'Ask ChatGPT' });
  await input.fill('First question');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Fixture answer', { exact: true })).toBeVisible();
  await expect.poll(() => acknowledgements.length).toBe(2);
  await input.fill('Second question');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => acknowledgements.length).toBe(4);
  expect(writes.map(write => write.sequence)).toEqual([1, 2, 3, 4]);
  expect(writes.every(write => write.messages.length === 1)).toBe(true);
  expect(acknowledgements).toEqual([1, 2, 3, 4].map(revision => ({ saved: true, revision })));
  let documents = 0;
  page.on('request', req => { if (req.isNavigationRequest() && req.resourceType() === 'document') documents++; });
  await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
  await page.waitForTimeout(1000);
  expect(documents).toBe(0);
  await expect(page.getByText('Second question', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
