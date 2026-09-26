import { test, expect, type Page } from '@playwright/test';

interface WebVitalsMetrics {
  ttfb: number;
  fcp: number;
  lcp: number;
  cls: number;
  domContentLoaded: number;
}

/**
 * Collect standard Core Web Vitals and timing metrics from the browser performance API.
 */
async function collectWebVitals(page: Page): Promise<WebVitalsMetrics> {
  // Allow initial renders, network responses, and animations to stabilize
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  return await page.evaluate(() => {
    // TTFB and DOMContentLoaded from navigation timing
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const nav = navEntries.length > 0 ? navEntries[0] : null;
    const ttfb = nav ? nav.responseStart - nav.startTime : 0;
    const domContentLoaded = nav ? nav.domContentLoadedEventEnd - nav.startTime : 0;

    // FCP from paint timing
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    const fcp = fcpEntry ? fcpEntry.startTime : 0;

    // LCP from largest-contentful-paint timing entries
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : (fcp || 0);

    // CLS from layout-shift timing entries (excluding input-induced shifts)
    let cls = 0;
    const shiftEntries = performance.getEntriesByType('layout-shift') as (PerformanceEntry & {
      hadRecentInput?: boolean;
      value?: number;
    })[];
    for (const entry of shiftEntries) {
      if (!entry.hadRecentInput && typeof entry.value === 'number') {
        cls += entry.value;
      }
    }

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
    // Monitor uncaught client exceptions
    page.on('pageerror', (err) => {
      // Ignore known benign third-party warnings if any
      console.warn(`[Page Error] ${err.message}`);
    });
    await authenticateFixtureUser(page, testInfo.project.name,
      testInfo.title.startsWith('Mock test session') ? 'performance' : undefined);
  });

  test('Mobile & Desktop /play hub meets Core Web Vitals thresholds', async ({ page }) => {
    await page.goto('/play', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.training-brand, .play-hub, [data-ui-chrome="header"]', {
      timeout: 10000,
    });

    const metrics = await collectWebVitals(page);

    // Assert Core Web Vitals thresholds:
    // - TTFB < 800ms
    // - LCP < 2500ms (Good rating threshold)
    // - CLS < 0.1 (Good rating threshold)
    expect(metrics.ttfb).toBeLessThan(800);
    expect(metrics.lcp).toBeLessThan(2500);
    expect(metrics.cls).toBeLessThan(0.1);
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
