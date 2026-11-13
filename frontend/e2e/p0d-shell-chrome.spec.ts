import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_BACKEND_URL, loginFixtureUser } from './helpers/auth-fixture';

const VIEWPORTS_MOBILE = [
  { name: '360x800', width: 360, height: 800 },
  { name: '393x852', width: 393, height: 852 },
  { name: '768x1024', width: 768, height: 1024 },
] as const;

const VIEWPORTS_DESKTOP = [
  { name: '1024x900', width: 1024, height: 900 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

async function setupAuthenticatedRoutes(
  page: Page,
  token: string,
  theme: 'dark' | 'light',
) {
  await page.context().addCookies([
    { name: 'access_session', value: 'p0d-shell-chrome-fixture', domain: '127.0.0.1', path: '/' },
  ]);

  await page.addInitScript((selectedTheme: 'dark' | 'light') => {
    localStorage.setItem('ui-theme', selectedTheme);
    document.documentElement.classList.toggle('theme-light', selectedTheme === 'light');
    document.documentElement.classList.toggle('theme-dark', selectedTheme === 'dark');
    document.documentElement.dataset.theme = selectedTheme;
  }, theme);

  await page.route('**/backend-api/**', async (route) => {
    const url = new URL(route.request().url());
    const apiPath = url.pathname.replace(/^\/backend-api/, '');
    if (apiPath === '/auth/refresh') {
      return route.fulfill({ status: 200, json: { token } });
    }
    if (apiPath === '/api/battle/season/reward-track') {
      return route.fulfill({ json: { season: null, level: 0, items: [] } });
    }
    const response = await route.fetch({
      url: `${FIXTURE_BACKEND_URL}${apiPath}${url.search}`,
      timeout: 10_000,
    });
    return route.fulfill({ response });
  });
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parseRgb(color: string): [number, number, number] {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) throw new Error(`Unexpected CSS color string: ${color}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

test.describe('P0-D Global Shell Chrome', () => {
  test.afterEach(async ({ context }) => {
    await context.unrouteAll({ behavior: 'wait' });
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`mobile/tablet shell chrome & shell-policy in ${theme} mode`, async ({
      page,
      request,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'Runs on mobile/touch viewports.');
      test.setTimeout(90_000);
      const { token } = await loginFixtureUser(request, 'browser-mobile@example.test');
      await setupAuthenticatedRoutes(page, token, theme);

      for (const vp of VIEWPORTS_MOBILE) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Primary routes must display BottomNav cleanly with >= 44px touch targets & >= 4.5:1 contrast.
        for (const route of ['/', '/mock-test', '/play', '/english/homonyms-homophones']) {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

          const nav = page.getByRole('navigation', { name: 'Primary' });
          await expect(nav, `${route} @ ${vp.name} should show BottomNav`).toBeVisible();
          await expect(nav).toHaveAttribute('data-meow-component', 'bottom-nav');

          const metrics = await page.evaluate(() => {
            const navEl = document.querySelector('nav[data-meow-component="bottom-nav"]')!;
            const navStyle = getComputedStyle(navEl);
            const activeEl = navEl.querySelector('a[aria-current="page"]') as HTMLElement | null;
            const inactiveEl = navEl.querySelector('a:not([aria-current="page"])') as HTMLElement | null;
            const firstLabel = navEl.querySelector('.bottom-nav-label') as HTMLElement | null;
            const itemBoxes = Array.from(navEl.querySelectorAll('a')).map((a) => {
              const r = a.getBoundingClientRect();
              return { width: r.width, height: r.height };
            });
            return {
              scrollWidth: document.documentElement.scrollWidth,
              innerWidth: window.innerWidth,
              hasBottomNavClass: document.body.classList.contains('has-bottom-nav'),
              navBg: navStyle.backgroundColor,
              navBackdropFilter: navStyle.backdropFilter,
              labelFontSize: firstLabel ? getComputedStyle(firstLabel).fontSize : null,
              activeColor: activeEl ? getComputedStyle(activeEl).color : null,
              activeBg: activeEl ? getComputedStyle(activeEl).backgroundColor : null,
              inactiveColor: inactiveEl ? getComputedStyle(inactiveEl).color : null,
              itemBoxes,
            };
          });

          expect(metrics.hasBottomNavClass, `${route} has-bottom-nav`).toBe(true);
          expect(metrics.scrollWidth, `${route} @ ${vp.name} horizontal overflow`).toBeLessThanOrEqual(
            metrics.innerWidth,
          );
          expect(metrics.navBackdropFilter).toBe('none');
          expect(metrics.labelFontSize).toBe('12px');
          expect(metrics.navBg).toBe(theme === 'dark' ? 'rgb(17, 23, 34)' : 'rgb(255, 255, 255)');
          for (const box of metrics.itemBoxes) {
            expect(box.width).toBeGreaterThanOrEqual(56);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
          expect(
            contrastRatio(parseRgb(metrics.inactiveColor!), parseRgb(metrics.navBg)),
          ).toBeGreaterThanOrEqual(4.5);
          if (metrics.activeColor && metrics.activeBg) {
            expect(
              contrastRatio(parseRgb(metrics.activeColor), parseRgb(metrics.activeBg)),
            ).toBeGreaterThanOrEqual(4.5);
          }
        }

        // Fullscreen / shell-policy routes must hide BottomNav cleanly without horizontal overflow.
        for (const hiddenRoute of [
          '/battle/rewards',
          '/english/homonyms-homophones/study-mode',
          '/english/spelling-misspelled-words/study-mode',
          '/mock-test/ssc-cgl',
        ]) {
          await page.goto(hiddenRoute, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

          await expect(
            page.locator('nav[data-meow-component="bottom-nav"]'),
            `${hiddenRoute} @ ${vp.name} should hide BottomNav`,
          ).toHaveCount(0);

          const overflow = await page.evaluate(() => ({
            hasClass: document.body.classList.contains('has-bottom-nav'),
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(overflow.hasClass).toBe(false);
          expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
        }

        // BackButton on /mock-test/ssc-cgl: >= 44px below 768px, hidden at 768px tablet.
        const backBtn = page.getByRole('button', { name: 'Back to all exams' });
        if (vp.width < 768) {
          await expect(backBtn).toBeVisible();
          const box = await backBtn.boundingBox();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        } else {
          await expect(backBtn).not.toBeVisible();
        }
      }
    });

    test(`desktop 1024px breakpoint and overflow check in ${theme} mode`, async ({
      page,
      request,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Runs on desktop viewports.');
      test.setTimeout(90_000);
      const { token } = await loginFixtureUser(request, 'browser-desktop@example.test');
      await setupAuthenticatedRoutes(page, token, theme);

      // Verify exact transition between 1023px (mobile bottom nav visible) and 1024px (hidden).
      await page.setViewportSize({ width: 1023, height: 900 });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();

      for (const vp of VIEWPORTS_DESKTOP) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        for (const route of ['/', '/mock-test', '/play', '/mock-test/ssc-cgl']) {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

          const nav = page.locator('nav[data-meow-component="bottom-nav"]');
          if ((await nav.count()) > 0) {
            await expect(nav, `${route} @ ${vp.name} BottomNav must be hidden`).not.toBeVisible();
          }

          const desktopMetrics = await page.evaluate(() => ({
            bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(desktopMetrics.bodyPaddingBottom).toBe('0px');
          expect(desktopMetrics.scrollWidth).toBeLessThanOrEqual(desktopMetrics.innerWidth);
        }

        await expect(page.getByRole('button', { name: 'Back to all exams' })).not.toBeVisible();
      }
    });
  }
});
