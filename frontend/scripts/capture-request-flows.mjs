import { chromium, devices, expect as expectBase } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const expect = expectBase.configure({ timeout: 30000 });

// No .env loading, traces, HAR, screenshots, request bodies or credential headers.
const required = name => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}`);
  return value;
};
const target = required('FLOW_TARGET');
if (!['local', 'staging', 'production'].includes(target)) throw new Error('Invalid FLOW_TARGET');
function origin(name, expected) {
  const url = new URL(required(name));
  if (url.hostname !== required(expected) || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !['http:', 'https:'].includes(url.protocol) || (target === 'production' && url.protocol !== 'https:')) throw new Error(`Invalid ${name} origin or host`);
  return url.origin;
}
const frontend = origin('FLOW_FRONTEND_URL', 'FLOW_EXPECTED_FRONTEND_HOST');
const api = origin('FLOW_API_URL', 'FLOW_EXPECTED_API_HOST');
const output = required('FLOW_REPORT');
const email = required('FLOW_EMAIL'), password = required('FLOW_PASSWORD');
const runs = Number(process.env.FLOW_RUNS || 1);
if (!Number.isInteger(runs) || runs < 1 || runs > 3) throw new Error('Use 1-3 journeys per capture');
const project = process.env.FLOW_DEVICE || 'desktop';
if (!['mobile', 'desktop'].includes(project)) throw new Error('FLOW_DEVICE must be desktop or mobile');
const localFixture = target === 'local' && [frontend, api].every(value => ['localhost', '127.0.0.1'].includes(new URL(value).hostname));
if (target === 'local' && !localFixture) throw new Error('Local capture requires loopback frontend and API');
const healthResponse = await fetch(`${api}/${localFixture ? 'live' : 'health'}`, { signal: AbortSignal.timeout(15000) });
if (!healthResponse.ok) throw new Error('Target health failed');
const health = await healthResponse.json();
if (health.ok !== true || (!localFixture && health.environment !== target)) throw new Error('Target environment mismatch');
if (process.env.FLOW_EXPECTED_RELEASE && health.releaseId !== process.env.FLOW_EXPECTED_RELEASE) throw new Error('Target release mismatch');
const quizPath = process.env.FLOW_QUIZ_PATH || '/mathematics/advance/algebra/quiz?mode=concept';
const topicPath = process.env.FLOW_TOPIC_PATH || '/mathematics/advance/algebra';
const exam = process.env.FLOW_EXAM || 'ssc-cgl';
for (const path of [quizPath, topicPath]) if (!path.startsWith('/') || new URL(path, frontend).origin !== frontend) throw new Error('Use same-origin quiz/topic paths');
if (!/^[a-z0-9-]+$/.test(exam)) throw new Error('Invalid FLOW_EXAM');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const samples = [];
let failed = false;
const startedAt = new Date().toISOString();
try {
  for (let run = 1; run <= runs; run++) {
    const context = await browser.newContext({ baseURL: frontend,
      ...(project === 'mobile' ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }),
      ...(process.env.FLOW_STORAGE_STATE ? { storageState: process.env.FLOW_STORAGE_STATE } : {}),
    });
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    const sample = { run, startedAt: new Date().toISOString(), actions: [], requests: [], completed: false };
    samples.push(sample);
    let action = 'preparation';
    const pending = new Map(), tasks = [];
    page.on('request', request => {
      const url = new URL(request.url()), type = request.resourceType();
      const isApi = (url.origin === api && /^(\/api\/|\/auth\/|\/users\/)/.test(url.pathname))
        || (url.origin === frontend && /^(\/backend-api\/|\/api\/|\/auth\/|\/users\/)/.test(url.pathname));
      const kind = isApi ? 'api' : type === 'document' ? 'document' : request.headers().rsc ? 'rsc' : null;
      if (!kind) return;
      const path = url.pathname.replace(/^\/backend-api/, '').replace(/[a-f0-9]{64}/g, ':fingerprint')
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
      const row = { action, kind, method: request.method(), path, origin: url.origin,
        requestId: request.headers()['x-request-id'] || null };
      pending.set(request, row); sample.requests.push(row);
    });
    page.on('response', response => {
      const row = pending.get(response.request());
      if (row) { row.status = response.status(); tasks.push(response.headerValue('x-request-id').then(id => { row.serverRequestId = id; })); }
    });
    page.on('requestfinished', request => {
      const row = pending.get(request); if (!row) return;
      const timing = request.timing();
      if (timing.responseEnd >= 0) row.durationMs = timing.responseEnd;
      if (timing.responseStart >= 0 && timing.requestStart >= 0) row.ttfbMs = timing.responseStart - timing.requestStart;
      tasks.push(request.sizes().then(size => { row.responseBodyBytes = size.responseBodySize; }).catch(() => {}));
    });
    page.on('requestfailed', request => { const row = pending.get(request); if (row) row.failed = true; });
    const measure = async (name, perform) => {
      action = name; console.log(`Capture ${run}: ${name}`);
      const start = performance.now();
      await perform();
      sample.actions.push({ name, automationElapsedMs: performance.now() - start });
      // Include the 600 ms resume saver and immediate background reads in this action.
      await page.waitForTimeout(750);
      if (sample.requests.some(row => row.status === 429 || row.status >= 500)) throw new Error('Request failure');
    };
    try {
      if (localFixture) {
        // Only the disposable loopback fixture lacks the invite-code API.
        await context.addCookies([{ name: 'access_session', value: 'local-capture-fixture', url: frontend }]);
      } else if (!process.env.FLOW_STORAGE_STATE) {
        const code = required('FLOW_ACCESS_CODE');
        if (!/^\d{4}$/.test(code)) throw new Error('Invalid invite code');
        await page.goto('/access-code');
        for (let index = 0; index < 4; index++) await page.getByRole('textbox', { name: `Digit ${index + 1}` }).fill(code[index]);
        await page.waitForURL(url => !url.pathname.includes('access-code'));
      }
      await page.goto('/login?redirect=%2Fdashboard');
      await page.locator('#login-email').fill(email); await page.locator('#login-password').fill(password);
      await measure('login', async () => {
        const profile = page.waitForResponse(r => /\/users\/me$/.test(new URL(r.url()).pathname) && r.ok());
        await page.locator('button[type="submit"]').click(); await profile;
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByText(/Hello,/).filter({ visible: true }).first()).toBeVisible();
      });
      await measure('open_dashboard', async () => { await page.reload(); await expect(page.getByText(/Hello,/).filter({ visible: true }).first()).toBeVisible(); });
      await measure('open_mathematics', async () => { await page.goto('/mathematics'); await expect(page.locator('[data-subject="mathematics"]')).toBeVisible(); });
      await measure('open_topic', async () => { await page.goto(topicPath); await expect(page.locator('.sg-card').first()).toBeVisible(); });
      await measure('quiz_setup', async () => { await page.goto(quizPath); await expect(page.getByRole('button', { name: /^Start Quiz/ })).toBeEnabled(); });
      await measure('start_quiz', async () => { await page.getByRole('button', { name: /^Start Quiz/ }).click(); await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeVisible(); });
      await page.locator('.ios-series-option, .mac-series-option').first().click();
      await measure('submit_answer', async () => { await page.getByRole('button', { name: 'Submit', exact: true }).click(); await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled(); });
      await measure('open_solution', async () => { await page.getByRole('button', { name: /^View solution$/i }).click(); await expect(page.locator('[aria-label="Question solution"]')).toBeVisible(); });
      await page.getByRole('button', { name: 'Back to quiz' }).click();
      await measure('open_ai_tutor', async () => { await page.getByRole('button', { name: /Ask AI tutor/i }).click(); await expect(page.locator('textarea.tutor-textarea')).toBeVisible(); });
      await page.getByRole('button', { name: 'Back to quiz' }).click();
      await measure('next_question', async () => { await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeVisible(); });
      await measure('training_hub', async () => { await page.goto(`/play?exam=${exam}`); await expect(page.getByRole('button', { name: 'Set up Adaptive' })).toBeEnabled(); });
      await measure('training_setup', async () => { await page.getByRole('button', { name: 'Set up Adaptive' }).click(); await expect(page.getByRole('button', { name: /Begin training/i })).toBeEnabled(); });
      await measure('start_training', async () => { await page.getByRole('button', { name: /Begin training/i }).click(); await expect(page.locator('.training-question-text')).toBeVisible(); });
      await measure('training_answer', async () => {
        await page.getByRole('radio').first().click();
        const save = page.waitForResponse(r => r.url().includes('/actions') && r.ok());
        await page.getByRole('button', { name: /Answer & continue|Save answer/ }).click(); await save;
      });
      await page.getByRole('button', { name: 'Finish session' }).click();
      await measure('finish_training', async () => { await page.getByRole('button', { name: 'Finish & see results' }).click(); await expect(page.locator('.training-results-container')).toBeVisible(); });
      await measure('load_progress', async () => {
        const progress = page.waitForResponse(r => r.url().includes('/api/progress/topics') && r.ok());
        await page.goto('/mathematics'); await progress;
      });
      await measure('open_mock_test', async () => {
        await page.goto('/mock-test');
        const history = page.waitForResponse(r => r.url().includes(`/api/mocktest/${exam}/history`) && r.ok());
        await page.locator(`a[href="/mock-test/${exam}"]`).first().click(); await history;
      });
      sample.completed = true;
    } catch (error) {
      failed = true; sample.failedAction = action;
      sample.failureKind = error instanceof Error ? error.name : 'Unknown';
      break;
    }
    finally { await page.waitForTimeout(750); await Promise.allSettled(tasks); await context.close(); sample.endedAt = new Date().toISOString(); }
  }
} finally {
  await browser.close();
  await writeFile(output, JSON.stringify({ version: 1, target, frontend, api, project, label: process.env.FLOW_RELEASE || 'unspecified', releaseId: health.releaseId || null, startedAt, endedAt: new Date().toISOString(),
    completed: !failed, samples, timingScope: 'Browser request timings; automationElapsedMs includes Playwright actionability and polling, not trusted-input UI latency',
    scope: 'Dedicated-account answer/training writes; opening tutor does not invoke AI. Browser API/document/RSC only; SSR/background Mongo requires server logs.' }, null, 2) + '\n');
}
if (failed) { console.error('Capture stopped; inspect failedAction in the partial report.'); process.exitCode = 1; }
else console.log(`Request-flow capture written to ${output}`);
