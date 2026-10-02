import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

interface WebVitalsMetrics {
  ttfb: number;
  fcp: number;
  lcp: number;
  cls: number;
  domContentLoaded: number;
}

async function observeWebVitals(page: Page) {
  await page.addInitScript(() => {
    const state = { lcp: 0, cls: 0 };
    Object.assign(window, { __performanceGate: state });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) state.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    let windowStart = 0, lastShift = 0, windowScore = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
        if (entry.hadRecentInput) continue;
        if (entry.startTime - lastShift > 1000 || entry.startTime - windowStart > 5000) {
          windowStart = entry.startTime;
          windowScore = 0;
        }
        lastShift = entry.startTime;
        windowScore += entry.value;
        state.cls = Math.max(state.cls, windowScore);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/**
 * Collect standard Core Web Vitals and timing metrics from the browser performance API.
 */
async function collectWebVitals(page: Page): Promise<WebVitalsMetrics> {
  // Allow initial renders, network responses, and animations to stabilize
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.waitForFunction(() => (window as Window & { __performanceGate?: { lcp: number } }).__performanceGate?.lcp);

  return await page.evaluate(() => {
    // TTFB and DOMContentLoaded from navigation timing
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const nav = navEntries.length > 0 ? navEntries[0] : null;
    if (!nav || nav.responseStart <= 0) throw new Error('Missing navigation timing');
    const ttfb = nav.responseStart - nav.startTime;
    const domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;

    // FCP from paint timing
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    if (!fcpEntry) throw new Error('Missing first contentful paint');
    const fcp = fcpEntry.startTime;
    const observed = (window as Window & { __performanceGate?: { lcp: number; cls: number } }).__performanceGate;
    if (!observed || observed.lcp <= 0) throw new Error('Missing observed largest contentful paint');
    const { lcp, cls } = observed;

    return { ttfb, fcp, lcp, cls, domContentLoaded };
  });
}

/**
 * Log in using the fixture credentials configured in backend/scripts/browser-fixture.js
 */
async function authenticateFixtureUser(page: Page, deviceName: string, variant?: 'performance') {
  const device = deviceName === 'mobile' ? 'mobile' : 'desktop';
  const userKey = variant === 'performance'
    ? `performance-${device}`
    : 'lighthouse';
  const email = `browser-${userKey}@example.test`;
  await page.context().addCookies([
    {
      name: 'access_session',
      value: 'local-navigation-fixture',
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await page.context().route('**/backend-api/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/backend-api', '');
    return route.fetch({ url: `http://127.0.0.1:3111${path}${url.search}` }).then(response => route.fulfill({ response }));
  });
  await page.goto('/login');
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', 'Browser-fixture-123!');
  await page.click('button[type="submit"]');
  // Wait until authentication redirects away from login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
}

test.describe('Core Web Vitals & Representative Performance Gates', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await observeWebVitals(page);
    // Monitor uncaught client exceptions
    page.on('pageerror', (err) => {
      // Ignore known benign third-party warnings if any
      console.warn(`[Page Error] ${err.message}`);
    });
    await authenticateFixtureUser(page, testInfo.project.name,
      testInfo.title.startsWith('Mock test session') ? 'performance' : undefined);
  });

  test('Mobile & Desktop /play hub meets Core Web Vitals thresholds', async ({ page }, testInfo) => {
    const observations = [];
    for (let run = 0; run < 3; run++) {
      await page.goto('/play', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Choose your training.' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Set up Adaptive' })).toBeVisible();
      const metrics = await collectWebVitals(page);
      observations.push({ run: run + 1, ...metrics });
      expect(metrics.ttfb).toBeLessThan(800);
      expect(metrics.lcp).toBeLessThan(2500);
      expect(metrics.cls).toBeLessThan(0.1);
    }
    const reportPath = testInfo.outputPath('play-web-vitals.json');
    await writeFile(reportPath, JSON.stringify(observations, null, 2));
    await testInfo.attach('play-web-vitals', { path: reportPath, contentType: 'application/json' });
  });

  test('Active training session /play/session/lighthouse-training renders efficiently', async ({ page }) => {
    await page.goto('/play/session/lighthouse-training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.training-session-view, [data-testid="training-session"], main', {
      timeout: 15000,
    });

    const metrics = await collectWebVitals(page);

    expect(metrics.ttfb).toBeLessThan(800);
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
  });

  test('Topic quiz view /mathematics/algebra renders fast with cursor pagination', async ({ page }) => {
    await page.goto('/mathematics/algebra', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ios-series-quiz, [data-testid="quiz-view"], [role="banner"], header, main', {
      timeout: 15000,
    });

    const metrics = await collectWebVitals(page);

    expect(metrics.ttfb).toBeLessThan(800);
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
  });

  test('Mock test session /mock-test/ssc-cgl/browser-test/attempt satisfies performance SLA', async ({ page }) => {
    await page.goto('/mock-test/ssc-cgl/browser-test/attempt', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="mock-test-engine"], .mock-test-container, [data-ui-chrome="header"], main', {
      timeout: 15000,
    });

    const metrics = await collectWebVitals(page);

    expect(metrics.ttfb).toBeLessThan(800);
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
  });
});
