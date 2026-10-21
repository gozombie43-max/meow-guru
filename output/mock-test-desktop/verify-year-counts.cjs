const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1366]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      await context.addCookies([{ name: 'access_session', value: 'local-ui-check', url: 'http://localhost:3000' }]);
      await context.addInitScript(theme => localStorage.setItem('ui-theme', theme), theme);
      await context.route('**/backend-api/**', route => {
        const url = new URL(route.request().url()); let json = {};
        if (url.pathname.endsWith('/auth/refresh')) json = { token: 'local-ui-check' };
        if (url.pathname.endsWith('/users/me')) json = { id: 'visual-user', role: 'user', name: 'User' };
        if (url.pathname.includes('/history')) json = { attempts: [] };
        if (url.pathname.endsWith('/ssc-chsl/slots')) {
          const year = url.searchParams.get('year');
          const total = url.searchParams.get('tier') === 'Tier II' ? 0 : year === '2025' ? 50 : year === '2024' ? 6 : 56;
          const offset = Number(url.searchParams.get('offset') || 0);
          json = { metadata: { mockCount: 0, pyqCount: 56, tiers: ['Tier I', 'Tier II'], years: [2025, 2024] }, total,
            nextOffset: offset + 20 < total ? offset + 20 : null,
            slots: url.searchParams.get('limit') === '0' ? [] : Array.from({ length: Math.max(0, Math.min(20, total - offset)) }, (_, i) => ({
              id: `${year}-${offset + i}`, examSlug: 'ssc-chsl', title: `${year || 'All years'} Paper ${offset + i + 1}`, configKey: 'ssc-chsl-tier1', isFree: true, type: 'pyq', tier: 'Tier I', year: Number(year) || 2025,
            })) };
        }
        return route.fulfill({ json });
      });
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://localhost:3000/mock-test/ssc-chsl?tab=prev');
      const label = width < 768 ? page.locator('[class$="__mobileTabsNav"]').getByRole('button', { name: /^PYQs/ }) : page.locator('aside').getByRole('button', { name: /^Previous Papers/ });
      const prefix = width < 768 ? 'PYQs' : 'Previous Papers';
      await expect(page.getByRole('combobox', { name: 'Select year' })).toHaveValue('2025');
      await expect(label).toHaveText(`${prefix} 50`);
      await expect(page.locator('article')).toHaveCount(20);
      await page.getByRole('combobox', { name: 'Select year' }).selectOption('2024');
      await expect(label).toHaveText(`${prefix} 6`); await expect(page.locator('article')).toHaveCount(6);
      await page.screenshot({ path: path.join(__dirname, `year-counts-2024-${width}-${theme}.png`) });
      await page.getByRole('combobox', { name: 'Select year' }).selectOption('');
      await expect(label).toHaveText(`${prefix} 56`); await expect(page.locator('article')).toHaveCount(20);
      await page.getByRole('combobox', { name: 'Select year' }).selectOption('2025');
      await expect(label).toHaveText(`${prefix} 50`);
      await page.getByRole('combobox', { name: 'Select Tier' }).selectOption('Tier II');
      await expect(label).toHaveText(`${prefix} 0`);
      await expect(page.getByRole('heading', { name: 'No Papers Found' })).toBeVisible();
      expect(errors).toEqual([]); await context.close();
    }
    console.log('4 desktop/mobile light/dark browser scenarios passed: 2025=50, 2024=6, all years=56, empty tier=0; counts independent of loaded page size. API data mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
