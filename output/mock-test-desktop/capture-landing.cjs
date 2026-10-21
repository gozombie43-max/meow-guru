const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const stage = process.argv[2] || 'before';
(async () => {
  const browser = await chromium.launch();
  let checks = 0;
  try {
    for (const theme of ['light', 'dark']) for (const exam of ['ssc-cgl', 'ssc-chsl']) {
      const sizes = [[320, 844], [390, 844], [767, 900], ...(stage === 'before' ? [[1917, 862]] : [[768, 900], [1024, 768], [1366, 900], [1917, 862], [1280, 600]])];
      for (const [width, height] of sizes) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        await context.addInitScript(theme => { localStorage.setItem('ui-theme', theme); localStorage.setItem('study-guru:exam-mode', 'ssc'); }, theme);
        await context.addCookies([{ name: 'access_session', value: 'local-ui-check', url: 'http://localhost:3000' }]);
        await context.route('**/backend-api/**', route => {
          const url = new URL(route.request().url());
          let json = {};
          if (url.pathname.endsWith('/auth/refresh')) json = { token: 'local-ui-check' };
          if (url.pathname.endsWith('/users/me')) json = { id: 'visual-user', role: 'user', name: 'User' };
          if (url.pathname.includes('/history')) json = { attempts: [] };
          if (/\/mocktest\/[^/]+\/slots$/.test(url.pathname)) {
            const empty = exam === 'ssc-cgl';
            const metadata = { mockCount: empty ? 0 : 24, pyqCount: empty ? 0 : 56, tiers: empty ? [] : ['Tier I', 'Tier II'], years: empty ? [] : [2025, 2024] };
            const pyq = url.searchParams.get('kind') === 'pyq';
            const slots = empty || url.searchParams.get('limit') === '0' ? [] : Array.from({ length: 24 }, (_, i) => ({
              id: `paper-${i + 1}`, examSlug: exam, configKey: 'ssc-chsl-tier1', title: pyq ? `SSC CHSL 2025 Shift ${i + 1}` : `Full Mock Test ${String(i + 1).padStart(2, '0')}`,
              isFree: true, tier: url.searchParams.get('tier') || 'Tier I', type: pyq ? 'pyq' : 'mock', year: 2025,
              ...(pyq ? { examDate: '2025-11-13', shift: i + 1 } : {}),
            }));
            json = { metadata, slots, total: empty ? 0 : 24, nextOffset: null };
          }
          return route.fulfill({ json });
        });
        const page = await context.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://localhost:3000/mock-test/${exam}`, { waitUntil: 'domcontentloaded' });
        if (exam === 'ssc-cgl') await expect(page.getByText('No tests published yet')).toBeVisible();
        else { await expect(page.locator('article')).toHaveCount(24); await expect(page.getByRole('button', { name: 'Start Mock', exact: true }).first()).toBeVisible(); }
        await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
        await page.addStyleTag({ content: '* , *::before, *::after { animation:none!important; transition:none!important; }' });
        const name = `landing-${exam}-${width}-${height}-${theme}.png`;
        const screenshot = await page.screenshot({ path: path.join(__dirname, `${stage}-${name}`), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
        if (stage === 'after' && width < 768) expect(screenshot.equals(fs.readFileSync(path.join(__dirname, `before-${name}`))), `Unchanged mobile: ${name}`).toBe(true);
        if (stage === 'after' && width >= 768) {
          const sidebar = page.locator('aside');
          const bounds = await sidebar.boundingBox();
          const toggle = await sidebar.getByRole('switch').boundingBox();
          expect(toggle.x + toggle.width).toBeLessThanOrEqual(bounds.x + bounds.width);
          const back = sidebar.getByRole('button', { name: 'All Exams', exact: true });
          expect((await back.boundingBox()).width).toBeGreaterThan(120);
          expect(await back.locator('span').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(30);
          await sidebar.getByRole('button', { name: 'Overview', exact: true }).click();
          await expect(page.getByRole('heading', { name: 'Why Practice With Us?' })).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await sidebar.getByRole('button', { name: /Previous Papers/ }).click();
          await expect(page.getByRole('combobox', { name: 'Select year' })).toBeVisible();
          if (exam === 'ssc-chsl') {
            await expect(page.locator('article')).toHaveCount(24);
            await page.getByRole('combobox', { name: 'Select Tier' }).selectOption('Tier II');
            await expect(page).toHaveURL(/tier=Tier\+II/);
            await expect(async () => {
              await expect(page.locator('article')).toHaveCount(24);
              await page.locator('article').last().scrollIntoViewIfNeeded();
              await expect(page.locator('article').last()).toBeInViewport();
            }).toPass({ timeout: 10000 });
          } else await expect(page.getByRole('heading', { name: 'No Papers Found' })).toBeVisible();
          await back.click(); await expect(page).toHaveURL(/\/mock-test$/);
        }
        checks++; await context.close();
      }
    }
    console.log(`${stage}: ${checks} exam-page checks passed; API data mocked${stage === 'after' ? '; 12 mobile screenshots identical, desktop controls/tabs/filters/back navigation/scroll verified' : ''}.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
