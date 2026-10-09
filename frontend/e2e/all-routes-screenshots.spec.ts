import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.join(process.cwd(), 'app');
const fixtureURL = 'http://127.0.0.1:3111';
const captureTheme = process.env.SCREENSHOT_THEME ?? 'light';
if (captureTheme !== 'light' && captureTheme !== 'dark') throw new Error('SCREENSHOT_THEME must be light or dark.');
test.use({ colorScheme: captureTheme });

function findPageFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findPageFiles(fullPath);
    return /^page\.(tsx|ts|jsx|js)$/.test(entry.name) ? [fullPath] : [];
  });
}

function fileToRoute(file: string): string {
  const segments = path.relative(appDir, path.dirname(file)).split(path.sep)
    .filter(segment => segment && !/^\(.+\)$/.test(segment));
  return `/${segments.join('/')}`;
}

// One representative URL per page file, using current topic slugs and the
// disposable backend already started by playwright.config.ts.
const dynamicRoutes: Record<string, string> = {
  '/english/[topic]': '/english/synonyms-antonyms',
  '/reasoning/[topic]': '/reasoning/analogy',
  '/mathematics/[topic]': '/mathematics/algebra',
  '/mathematics/arithmetic/[topic]': '/mathematics/arithmetic/percentages',
  '/mathematics/advance/[topic]': '/mathematics/advance/algebra',
  '/general-awareness/[topic]': '/general-awareness/ancient-history',
  '/general-awareness/[topic]/[chapter]': '/general-awareness/ancient-history/jainism-buddhism',
  '/play/setup/[mode]': '/play/setup/adaptive',
  '/play/session/[id]': '/play/session/screenshot-session',
  // This page's [id] is a subject key, rather than an individual video ID.
  '/mock-test/[examSlug]': '/mock-test/ssc-cgl',
  '/mock-test/[examSlug]/[testId]': '/mock-test/ssc-cgl/browser-test',
  '/mock-test/[examSlug]/[testId]/attempt': '/mock-test/ssc-cgl/browser-test/attempt',
  '/mock-test/[examSlug]/[testId]/result/[attemptId]': '/mock-test/ssc-cgl/browser-test/result/screenshot-attempt',
  '/mock-test/[examSlug]/[testId]/review/[attemptId]': '/mock-test/ssc-cgl/browser-test/review/screenshot-attempt',
};

for (const [template, route] of Object.entries(dynamicRoutes)) {
  if (!template.endsWith('[topic]') && !template.endsWith('[chapter]')) continue;
  for (const suffix of ['/formula-notes', '/quiz']) {
    dynamicRoutes[`${template}${suffix}`] = `${route}${suffix}`;
  }
}

const routeTemplates = [...new Set(findPageFiles(appDir).map(fileToRoute))].sort();

function routeFolder(route: string): string {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '__').replace(/[^a-zA-Z0-9_-]/g, '-');
}

let fixtureToken: string;
let fixtureUser: { id: string; name: string; email: string; role: string };

test.beforeAll(async ({ request }, testInfo) => {
  const login = await request.post(`${fixtureURL}/auth/login`, {
    data: { email: `browser-${testInfo.project.name}@example.test`, password: 'Browser-fixture-123!' },
  });
  expect(login.ok(), 'Screenshot fixture login').toBeTruthy();
  const session = await login.json();
  fixtureToken = session.token;
  fixtureUser = session.user;
});

for (const template of routeTemplates) {
  test(`screenshot ${template}`, async ({ page, context, request }, testInfo) => {
    let route = dynamicRoutes[template] ?? template;
    test.skip(route.includes('['), `Add a representative URL to dynamicRoutes for ${template}`);
    const isGuest = ['/login', '/register', '/access-code', '/auth/callback'].includes(route);
    const isAdmin = route === '/admincontrol' || route === '/admin' || route.startsWith('/admin/');
    const apiFailures: { path: string; status: number }[] = [];
    const pageErrors: string[] = [];

    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/backend-api/') && response.status() >= 400) {
        if (isGuest && url.pathname === '/backend-api/auth/refresh' && response.status() === 401) return;
        apiFailures.push({ path: `${url.pathname}${url.search}`, status: response.status() });
      }
    });

    if (!isGuest) {
      await context.addCookies([{ name: 'access_session', value: 'screenshot-fixture', url: testInfo.project.use.baseURL! }]);
    }

    // Keep browser API requests on the disposable fixture. Browser-only
    // identities and empty rewards data never change any real user or service.
    await context.route('**/backend-api/**', async intercepted => {
      const url = new URL(intercepted.request().url());
      const apiPath = url.pathname.replace(/^\/backend-api/, '');
      if (apiPath === '/auth/refresh') {
        await intercepted.fulfill({ status: isGuest ? 401 : 200, json: isGuest ? { error: 'Guest capture' } : { token: fixtureToken } });
      } else if (apiPath === '/users/me' && isAdmin) {
        await intercepted.fulfill({ json: { ...fixtureUser, role: 'admin', progress: {}, bookmarks: [], recentQuizzes: [] } });
      } else if (apiPath === '/api/battle/season/reward-track') {
        testInfo.annotations.push({ type: 'fixture-note', description: 'Reward track uses an empty capture fixture; this API is absent from the existing backend fixture.' });
        await intercepted.fulfill({ json: { season: null, level: 0, items: [] } });
      } else {
        const response = await intercepted.fetch({ url: `${fixtureURL}${apiPath}${url.search}`, timeout: 10_000 });
        await intercepted.fulfill({ response });
      }
    });

    const headers = { Authorization: `Bearer ${fixtureToken}` };
    if (template === '/play/session/[id]') {
      const session = await request.post(`${fixtureURL}/api/training/sessions`, {
        headers, data: { mode: 'adaptive', exam: 'ssc-cgl', tier: '1', count: 10, minutes: 10 },
      });
      expect(session.ok(), 'Create screenshot training session').toBeTruthy();
      route = `/play/session/${(await session.json()).id}`;
    }
    if (template.includes('[attemptId]')) {
      const started = await request.post(`${fixtureURL}/api/mocktest/ssc-cgl/browser-test/start`, { headers, data: {} });
      expect(started.ok(), 'Create screenshot mock attempt').toBeTruthy();
      const attemptId = (await started.json()).attemptId;
      const submitted = await request.post(`${fixtureURL}/api/mocktest/attempt/${attemptId}/submit`, { headers, data: {} });
      expect(submitted.ok(), 'Complete screenshot mock attempt').toBeTruthy();
      route = route.replace('screenshot-attempt', attemptId);
      if (template.includes('/review/')) {
        testInfo.annotations.push({ type: 'fixture-note', description: 'The existing mock fixture is confidential; this captures its review-disabled state.' });
      }
    }

    // Fix the theme and disable motion before React paints the page.
    await context.addInitScript(selectedTheme => {
      // Preview iframes can be sandboxed without access to localStorage.
      if (window !== window.top) return;
      localStorage.setItem('ui-theme', selectedTheme);
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }';
      const append = () => document.documentElement.appendChild(style);
      if (document.documentElement) append();
      else document.addEventListener('DOMContentLoaded', append, { once: true });
    }, captureTheme);

    const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    // Hydration recovery can replace root attributes while feature-owned
    // surfaces (such as AI chat) keep their explicit rendered theme.
    const renderedTheme = await page.evaluate(() =>
      document.documentElement.dataset.theme ?? document.body.dataset.theme ??
      document.querySelector('main[data-theme]')?.getAttribute('data-theme') ?? null,
    );

    await page.screenshot({
      path: path.join('screenshots', testInfo.project.name, routeFolder(route), 'screenshot.png'),
      fullPage: true,
      animations: 'disabled',
      timeout: 15_000,
    });

    const status = response?.status();
    testInfo.annotations.push(
      { type: 'theme', description: captureTheme },
      { type: 'rendered-theme', description: renderedTheme ?? 'missing' },
      { type: 'requested-route', description: route },
      { type: 'final-url', description: page.url() },
      { type: 'http-status', description: String(status ?? 'client navigation') },
      { type: 'screenshot', description: `${testInfo.project.name}/${routeFolder(route)}/screenshot.png` },
    );
    if (apiFailures.length) testInfo.annotations.push({ type: 'fixture-api-errors', description: JSON.stringify(apiFailures) });
    if (pageErrors.length) {
      testInfo.annotations.push({ type: 'page-errors', description: JSON.stringify(pageErrors) });
      console.warn(`[${testInfo.project.name}] ${route}: ${pageErrors.length} browser error(s) recorded in capture-report.json`);
    }
    console.log(`[${testInfo.project.name}] ${route} -> ${status ?? 'client navigation'} (${page.url()})`);

    // Save error pages as evidence, but mark them as failed in the report.
    expect(status ?? 200, `HTTP status for ${route}`).toBeLessThan(400);
    expect(renderedTheme, `Rendered theme for ${route}`).toBe(captureTheme);
    if (template === '/ai-chat') {
      expect(pageErrors, 'AI Tutor browser errors').toEqual([]);
      expect(apiFailures, 'AI Tutor fixture API failures').toEqual([]);
    }
    if (!isGuest) expect(new URL(page.url()).pathname, `Unexpected auth redirect for ${route}`).not.toMatch(/^\/(login|access-code)$/);
  });
}
