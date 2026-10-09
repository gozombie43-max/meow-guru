import { expect, test, type BrowserContext } from '@playwright/test';
const fixture = 'http://127.0.0.1:3111';

// Drain forwarded autosaves before Playwright closes the context and its request
// client, so an unfinished route callback cannot fail the following test.
test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: 'wait' });
});

for (const resume of [false, true]) {
  test(`public quiz data overlaps blocked auth restoration; resume=${resume}`, async ({ page, context, request }, info) => {
    const login = await request.post(`${fixture}/auth/login`, { data: { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' } });
    const { token } = await login.json();
    if (resume) {
      const seed = await request.patch(`${fixture}/users/me/recent-quizzes`, { headers: { Authorization: `Bearer ${token}` }, data: {
        quizKey: 'mathematics:algebra', title: 'Algebra', subject: 'mathematics', href: '/mathematics/advance/algebra/quiz',
        mode: 'concept', currentIndex: 240, totalQuestions: 250, selectedAnswers: {}, submittedQuestions: [], results: [], questionAnchor: '',
      } });
      expect(seed.ok()).toBeTruthy();
    }
    await routeFixture(context, token);
    let release!: () => void, authReleased = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await context.route('**/backend-api/auth/refresh', async route => {
      await gate;
      await route.fulfill({ json: { token } });
    });
    const queries: Array<{ url: string; beforeAuth: boolean; authorization?: string; cookie?: string }> = [];
    page.on('request', async req => {
      if (!/\/api\/questions\/(meta|session)\?/.test(req.url())) return;
      const beforeAuth = !authReleased, headers = await req.allHeaders();
      queries.push({ url: req.url(), beforeAuth, authorization: headers.authorization, cookie: headers.cookie });
    });
    try {
      await page.goto(`/mathematics/advance/algebra/quiz${resume ? '?resume=1' : ''}`);
      await expect.poll(() => queries.filter(query => query.url.includes('/meta?')).length).toBe(1);
      if (resume) expect(queries.filter(query => query.url.includes('/session?'))).toHaveLength(0);
      else {
        await expect.poll(() => queries.filter(query => query.url.includes('/session?')).length).toBe(1);
        await expect(page.getByRole('button', { name: /^Loading/ })).toBeDisabled();
      }
      expect(queries.every(query => query.beforeAuth && !query.authorization && !query.cookie)).toBe(true);
      authReleased = true; release();
      if (resume) await expect(page.getByText(/x \+ 241 = 243/)).toBeVisible();
      else await expect(page.getByRole('button', { name: /^Start Quiz/ })).toBeEnabled();
      const sessions = queries.filter(query => query.url.includes('/session?'));
      expect(sessions).toHaveLength(1);
      expect(sessions[0].beforeAuth).toBe(!resume);
      if (resume) expect(sessions[0].url).toContain('resumeIndex=240');
    } finally { release(); }
  });
}

test('quiz answer retries a lost response with one key and no duplicate counters or history save', async ({ page, context, request }, info) => {
  const login = await request.post(`${fixture}/auth/login`, { data: { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' } });
  const { token } = await login.json();
  await routeFixture(context, token);
  const commands: unknown[] = [], checkpoints: string[] = [];
  let submitted = false;
  page.on('request', req => { if (submitted && req.method() === 'PATCH' && req.url().includes('/recent-quizzes')) checkpoints.push(req.url()); });
  await context.route('**/backend-api/api/questions/answer', async route => {
    commands.push(route.request().postDataJSON());
    const response = await route.fetch({ url: `${fixture}/api/questions/answer` });
    expect(response.ok()).toBeTruthy();
    if (commands.length === 1) await route.abort('failed');
    else await route.fulfill({ response });
  });
  await page.goto('/mathematics/advance/algebra/quiz');
  await page.getByRole('button', { name: /^Start Quiz/ }).click();
  await page.getByText('2', { exact: true }).last().click();
  submitted = true;
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await expect.poll(() => commands.length).toBe(2);
  await expect.poll(async () => {
    const profile = await (await request.get(`${fixture}/users/me`, { headers: { Authorization: `Bearer ${token}` } })).json();
    return profile.progress.Addition;
  }).toEqual({ attempted: 1, correct: 1 });
  await page.waitForTimeout(900);
  expect(commands[0]).toEqual(commands[1]); expect(checkpoints).toEqual([]);
  const detail = await (await request.get(`${fixture}/users/me/recent-quizzes/mathematics%3Aalgebra`, { headers: { Authorization: `Bearer ${token}` } })).json();
  expect(detail.quiz.results).toHaveLength(1); expect(detail.quiz.results[0]).toMatchObject({ isCorrect: true, selected: 1 });
});

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
    questionAnchor: '',
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

test('Mathematics loads private progress separately from its public catalog', async ({ page, context, request }, info) => {
  const login = await request.post(`${fixture}/auth/login`, { data: { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' } });
  const { token } = await login.json(); await routeFixture(context, token);
  const reads: string[] = [];
  page.on('request', req => { if (/\/api\/(progress\/topics|questions\/topic-counts)/.test(req.url())) reads.push(req.url()); });
  await page.goto('/mathematics');
  await expect.poll(() => reads.filter(url => url.includes('/topics/private?')).length).toBe(1);
  expect(reads.filter(url => url.includes('/progress/topics?'))).toEqual([]);
  expect(reads.filter(url => url.includes('/questions/topic-counts?')).length).toBeLessThanOrEqual(1);
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('topic-counts')).map(key => localStorage.getItem(key)));
  expect(stored.every(value => !value?.includes('userProgress'))).toBe(true);
});
test('mock history replays a 401 once without refetching when its token rotates', async ({ page, context, request }, info) => {
  const credentials = { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' };
  const { token } = await (await request.post(`${fixture}/auth/login`, { data: credentials })).json();
  const { token: rotated } = await (await request.post(`${fixture}/auth/login`, { data: credentials })).json();
  await routeFixture(context, token);
  let refreshes = 0, histories = 0;
  await context.route('**/backend-api/auth/refresh', route => route.fulfill({ json: { token: ++refreshes === 1 ? token : rotated } }));
  await context.route('**/backend-api/api/mocktest/ssc-cgl/history', async route => {
    histories++;
    if (histories === 1) return route.fulfill({ status: 401, json: { error: 'Expired token' } });
    expect(route.request().headers().authorization).toBe(`Bearer ${rotated}`);
    await route.fulfill({ json: { attempts: [] } });
  });
  await page.goto('/mock-test/ssc-cgl');
  await expect.poll(() => histories).toBe(2);
  await page.waitForTimeout(400);
  expect(histories).toBe(2); expect(refreshes).toBe(2);
});
test('quiz translates question text ahead and solution only after opening it', async ({ page, context, request }, info) => {
  const { token } = await (await request.post(`${fixture}/auth/login`, { data: { email: `browser-${info.project.name}@example.test`, password: 'Browser-fixture-123!' } })).json();
  await routeFixture(context, token);
  const batches: string[][] = [];
  await context.route('**/api/translate/**', async route => {
    const data = route.request().postDataJSON(); batches.push(data.texts);
    await route.fulfill({ json: data.texts.map((text: string) => ({ translations: [{ text, to: 'bn' }] })) });
  });
  await page.goto('/mathematics/advance/algebra/quiz');
  await page.getByRole('button', { name: /^Start Quiz/ }).click();
  await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
  await expect.poll(() => batches.length).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(200);
  const initialBatches = batches.length;
  expect(initialBatches).toBeLessThanOrEqual(2);
  expect(batches.flat().some(text => text.includes('Subtract the constant'))).toBe(false);
  await page.getByText('2', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  expect(batches.flat().some(text => text.includes('Subtract the constant'))).toBe(false);
  await page.getByRole('button', { name: /^View solution$/i }).click();
  await expect.poll(() => batches.flat().some(text => text.includes('Subtract the constant'))).toBe(true);
  expect(batches.length).toBe(initialBatches + 1);
});
