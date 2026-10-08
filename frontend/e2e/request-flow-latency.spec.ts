import { test, expect, type Request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance as nodePerformance } from 'node:perf_hooks';

// Opt in: this is a benchmark, not a timing assertion in the regression suite.
test.skip(process.env.REQUEST_FLOW_LATENCY !== '1', 'Set REQUEST_FLOW_LATENCY=1 to measure local request flows.');
const runs = Number(process.env.REQUEST_FLOW_LATENCY_RUNS || 5);
type Target = { selector: string; text?: string; enabled?: boolean; newDocument?: boolean };
type Mark = Target & { start: number; origin: number };
type WindowWithLatency = Window & typeof globalThis & {
  latencyArm: (target: Target) => void;
  latencyResult?: number;
};
type ApiSample = { method: string; path: string; status?: number; durationMs?: number; ttfbMs?: number; failed?: string; action: string };

test('measure real local request flows through the Next rewrite', async ({ browser, request }, info) => {
  test.setTimeout(240_000);
  expect(Number.isInteger(runs) && runs >= 1 && runs <= 20).toBeTruthy();
  // Reject a build targeting a remote service before any credentials or mutation.
  const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(resolve('.next/routes-manifest.json'), 'utf8'));
  const rewrite = manifest.rewrites.afterFiles.find((entry: { source: string }) => entry.source === '/backend-api/:path*');
  expect(rewrite?.destination).toBe('http://127.0.0.1:3111/:path*');
  const samples: Array<{ run: number; actions: Record<string, number>; api: ApiSample[]; pairedReads: Array<{ path: string; directMs: number; rewriteMs: number }> }> = [];
  for (let run = 1; run <= runs; run++) {
    const context = await browser.newContext({ ...info.project.use, baseURL: 'http://127.0.0.1:3110' });
    // The page invite gate only checks presence; real API login/session validation stays enabled.
    await context.addCookies([{ name: 'access_session', value: 'local-latency-invite', url: 'http://127.0.0.1:3110' }]);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const actions: Record<string, number> = {}, api: ApiSample[] = [];
    let action = 'preparation';
    const pending = new Map<Request, ApiSample>();
    page.on('request', req => {
      const url = new URL(req.url());
      if (!url.pathname.startsWith('/backend-api/')) return;
      const sample: ApiSample = { method: req.method(), path: url.pathname.replace('/backend-api', ''), action };
      pending.set(req, sample); api.push(sample);
    });
    page.on('response', response => { const sample = pending.get(response.request()); if (sample) sample.status = response.status(); });
    page.on('requestfinished', req => {
      const sample = pending.get(req), timing = req.timing();
      if (sample) {
        if (timing.responseEnd >= 0) sample.durationMs = Math.round(timing.responseEnd * 10) / 10;
        if (timing.responseStart >= 0 && timing.requestStart >= 0) sample.ttfbMs = Math.round((timing.responseStart - timing.requestStart) * 10) / 10;
      }
    });
    page.on('requestfailed', req => { const sample = pending.get(req); if (sample) sample.failed = req.failure()?.errorText; });
    await context.addInitScript(() => {
      const win = window as WindowWithLatency;
      const key = 'request-flow-latency-target';
      win.latencyArm = target => {
        win.latencyResult = undefined;
        sessionStorage.setItem(key, JSON.stringify({ ...target, origin: performance.timeOrigin,
          start: target.newDocument ? performance.timeOrigin + performance.now() : 0 }));
      };
      // Start click measurements at the trusted input event, before React handles it.
      // Playwright scrolling, actionability checks and its polling are outside the timer.
      document.addEventListener('click', event => {
        const raw = sessionStorage.getItem(key);
        if (!raw || !event.isTrusted) return;
        const mark = JSON.parse(raw) as Mark;
        if (!mark.start) sessionStorage.setItem(key, JSON.stringify({ ...mark, start: performance.timeOrigin + performance.now() }));
      }, true);
      const poll = () => {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const mark = JSON.parse(raw) as Mark;
          const found = mark.start > 0 && (!mark.newDocument || performance.timeOrigin !== mark.origin) && Array.from(document.querySelectorAll(mark.selector)).some(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden'
              && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
              && (!mark.text || el.textContent?.includes(mark.text)) && (!mark.enabled || !el.matches(':disabled'));
          });
          if (found) {
            win.latencyResult = performance.timeOrigin + performance.now() - mark.start;
            sessionStorage.removeItem(key);
          }
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
    const measure = async (name: string, target: Target, perform: () => Promise<unknown>) => {
      action = name;
      console.log(`${info.project.name} run ${run}: ${name}`);
      await page.evaluate(target => (window as WindowWithLatency).latencyArm(target), target);
      await perform();
      await page.waitForFunction(() => (window as WindowWithLatency).latencyResult !== undefined);
      actions[name] = Math.round(await page.evaluate(() => (window as WindowWithLatency).latencyResult!));
    };
    try {
      // Cost-12 registration produces the same bcrypt work factor as real login.
      // Unique owners also avoid reusing the confidential mock's single attempt.
      const credentials = { email: `latency-${randomUUID()}@example.test`, password: 'Browser-fixture-123!' };
      const registration = await request.post('http://127.0.0.1:3111/auth/register', { data: { ...credentials, name: 'Latency Student' } });
      expect(registration.ok()).toBeTruthy();
      await page.goto('/login?redirect=%2Fdashboard');
      await page.locator('#login-email').fill(credentials.email);
      await page.locator('#login-password').fill(credentials.password);
      const loggedIn = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.ok());
      await measure('login', { selector: 'div', text: 'Hello, Latency' }, () => page.locator('button[type="submit"]').click());
      const { token } = await (await loggedIn).json();
      await measure('dashboard_reload', { selector: 'div', text: 'Hello, Latency', newDocument: true }, () => page.reload({ waitUntil: 'domcontentloaded' }));
      const progress = page.waitForResponse(r => r.url().includes('/api/progress/topics/private') && r.ok());
      await measure('mathematics_document', { selector: '[data-subject="mathematics"]', newDocument: true }, () => page.goto('/mathematics', { waitUntil: 'domcontentloaded' }));
      await progress;
      await measure('topic_document', { selector: '.sg-card', text: '250', newDocument: true }, () => page.goto('/mathematics/advance/algebra', { waitUntil: 'domcontentloaded' }));
      await measure('quiz_setup', { selector: 'button', text: 'Start Quiz', enabled: true }, () => page.locator('.sg-card').filter({ hasText: 'PYQ' }).click());
      await measure('start_quiz', { selector: 'button', text: 'Submit' }, () => page.getByRole('button', { name: /^Start Quiz/ }).click());
      await page.getByText('2', { exact: true }).last().click();
      const answer = page.waitForResponse(r => r.url().endsWith('/api/questions/answer') && r.ok());
      await measure('submit_answer_ui', { selector: 'button', text: 'Next', enabled: true }, () => page.getByRole('button', { name: 'Submit', exact: true }).click());
      await answer;
      await measure('open_solution', { selector: '[aria-label="Question solution"]', text: 'Subtract' }, () => page.getByRole('button', { name: /^View solution$/i }).click());
      await page.getByRole('button', { name: 'Back to quiz' }).click();
      await measure('open_ai_tutor', { selector: 'textarea.tutor-textarea' }, () => page.getByRole('button', { name: /Ask AI tutor/i }).click());
      await page.getByRole('button', { name: 'Back to quiz' }).click();
      await measure('next_question', { selector: 'main', text: 'x + 2 = 4' }, () => page.getByRole('button', { name: 'Next', exact: true }).click());
      await measure('training_hub', { selector: '[aria-label="Set up Adaptive"]', enabled: true, newDocument: true }, () => page.goto('/play', { waitUntil: 'domcontentloaded' }));
      await measure('training_setup', { selector: 'button', text: 'Begin training', enabled: true }, () => page.getByRole('button', { name: 'Set up Adaptive' }).click());
      await measure('start_training', { selector: '.training-question-text' }, () => page.getByRole('button', { name: /Begin training/i }).click());
      await page.getByRole('radio').nth(1).click();
      const save = page.waitForResponse(r => r.url().includes('/actions') && r.ok());
      await page.getByRole('button', { name: /Answer & continue|Save answer/ }).click();
      await save;
      await page.getByRole('button', { name: 'Finish session' }).click();
      await measure('finish_training', { selector: '.training-results-container' }, () => page.getByRole('button', { name: 'Finish & see results' }).click());
      await measure('mock_catalog', { selector: 'a[href="/mock-test/ssc-cgl"]', newDocument: true }, () => page.goto('/mock-test', { waitUntil: 'domcontentloaded' }));
      const history = page.waitForResponse(r => /\/api\/mocktest\/ssc-cgl\/history/.test(r.url()) && r.ok());
      await measure('mock_exam', { selector: 'h3', text: 'Browser assessment' }, () => page.locator('a[href="/mock-test/ssc-cgl"]').first().click());
      await history;
      await measure('mock_instructions', { selector: 'h1', newDocument: true }, () => page.goto('/mock-test/ssc-cgl/browser-test', { waitUntil: 'domcontentloaded' }));
      await measure('start_mock', { selector: 'input[type="radio"]' }, () => page.getByRole('button', { name: /Start Test/ }).click());
      await expect(page.getByRole('radio').nth(1)).toBeVisible();
      await page.waitForTimeout(700); // Include coalesced persistence in request counts, outside UI timings.
      expect(api.filter(row => row.status && row.status >= 500)).toEqual([]);
      const pairedReads = [];
      for (const path of ['/api/questions/counts?subject=mathematics&topic=algebra', '/api/progress/topics/private?subject=mathematics', '/api/training/dashboard?exam=ssc-cgl']) {
        const bases = ['http://127.0.0.1:3111', 'http://127.0.0.1:3110/backend-api'];
        const read = async (base: string) => {
          const start = nodePerformance.now();
          const response = await request.get(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
          await response.body();
          const ms = Math.round((nodePerformance.now() - start) * 10) / 10;
          expect(response.ok()).toBeTruthy();
          return ms;
        };
        // Warm both paths, then alternate order to reduce systematic first-read bias.
        for (const base of bases) await read(base);
        for (let pair = 0; pair < 2; pair++) {
          const ordered = (run + pair) % 2 ? [0, 1] : [1, 0];
          const times = [0, 0];
          for (const index of ordered) times[index] = await read(bases[index]);
          pairedReads.push({ path, directMs: times[0], rewriteMs: times[1] });
        }
      }
      samples.push({ run, actions, api, pairedReads });
    } finally { await context.close(); }
  }
  const output = resolve(`../REQUEST_FLOW_LATENCY_${info.project.name}.json`);
  await writeFile(output, JSON.stringify({ measuredAt: new Date().toISOString(), project: info.project.name, runs, samples }, null, 2) + '\n');
  console.log(`Request-flow latency samples: ${output}`);
});
