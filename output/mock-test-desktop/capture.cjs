const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const stage = process.argv[2] || 'before';
const output = __dirname;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const theme of ['light', 'dark']) {
      const sizes = stage === 'before' ? [[320, 844], [390, 844], [767, 900], [1917, 862]]
        : [[320, 844], [390, 844], [767, 900], [768, 900], [1024, 768], [1366, 900], [1917, 862], [1280, 600]];
      for (const [width, height] of sizes) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        await context.addInitScript(theme => { localStorage.setItem('ui-theme', theme); localStorage.setItem('study-guru:exam-mode', 'ssc'); }, theme);
        await context.addCookies([{ name: 'access_session', value: 'local-visual-check', url: 'http://localhost:3000' }]);
        await context.route('**/backend-api/**', route => {
          const url = new URL(route.request().url());
          let json = {};
          if (url.pathname.endsWith('/auth/refresh')) json = { token: 'local-visual-check' };
          if (url.pathname.endsWith('/users/me')) json = { id: 'visual-user', name: 'User', role: 'user' };
          if (url.pathname.endsWith('/catalog-metadata')) json = { exams: [{ examSlug: 'ssc-chsl', mockCount: 0, pyqCount: 56, total: 56 }] };
          return route.fulfill({ json });
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://localhost:3000/mock-test', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('56 Tests Included', { exact: true })).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
        });
        await page.addStyleTag({ content: '* , *::before, *::after { animation: none !important; transition: none !important; }' });
        const screenshot = await page.screenshot({ path: path.join(output, `${stage}-${width}-${height}-${theme}.png`), fullPage: true });
        const metrics = await page.evaluate(() => {
          const find = name => document.querySelector(`[class$="__${name}"]`);
          const rect = el => ({ x: el.getBoundingClientRect().x, right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width });
          return { overflow: document.documentElement.scrollWidth > innerWidth,
            app: rect(find('app')), content: rect(find('macosContent')), sidebar: rect(find('macosSidebar')),
            modeSwitch: rect(document.querySelector('[data-ui-exam-switch]')),
            columns: getComputedStyle(find('examGrid')).gridTemplateColumns.split(' ').length,
            mobileTabs: getComputedStyle(find('categoryScroll')).display };
        });
        expect(metrics.overflow).toBe(false);
        expect(errors).toEqual([]);
        if (stage === 'after' && width < 768) {
          const baseline = fs.readFileSync(path.join(output, `before-${width}-${height}-${theme}.png`));
          expect(screenshot.equals(baseline), `Mobile screenshot unchanged: ${width}px ${theme}`).toBe(true);
        }
        if (stage === 'after' && width >= 768) {
          expect(Math.abs(metrics.app.width - metrics.content.width)).toBeLessThan(1);
          expect(metrics.modeSwitch.right).toBeLessThanOrEqual(metrics.sidebar.right);
          expect(metrics.mobileTabs).toBe('none');
          expect(metrics.columns).toBeGreaterThanOrEqual(width >= 1366 ? 4 : 2);
          const sidebar = page.locator('aside');
          await sidebar.getByRole('button', { name: 'Banking', exact: true }).click();
          await expect(page.locator('main a[href^="/mock-test/"]')).toHaveCount(4);
          await expect(page.getByRole('link', { name: /IBPS PO/ })).toHaveAttribute('href', '/mock-test/ibps-po');
          await sidebar.getByRole('button', { name: 'All', exact: true }).click();
          await expect(page.locator('main a[href^="/mock-test/"]')).toHaveCount(18);
          await page.getByRole('link', { name: /CAT Common Admission/ }).scrollIntoViewIfNeeded();
          await expect(page.getByRole('link', { name: /CAT Common Admission/ })).toBeInViewport();
        }
        results.push({ width, height, theme, ...metrics });
        await context.close();
      }
    }
    fs.writeFileSync(path.join(output, `${stage}-checks.json`), JSON.stringify(results, null, 2));
    console.log(`${stage}: ${results.length} viewports/themes passed${stage === 'after' ? ', including 6 identical mobile screenshots and desktop filters/links/scrolling' : ''}. Mocked API data.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
