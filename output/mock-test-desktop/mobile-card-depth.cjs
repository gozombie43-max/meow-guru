const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const stage = process.argv[2] || 'before';
(async () => {
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) for (const width of [320, 390, 767, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => { localStorage.setItem('ui-theme', theme); }, theme);
      await context.addCookies([{ name: 'access_session', value: 'local-ui-check', url: 'http://localhost:3000' }]);
      const slots = Array.from({ length: 8 }, (_, i) => ({ id: `paper-${i}`, examSlug: 'ssc-chsl', configKey: 'ssc-chsl-tier1', title: `2025 Tier 1 • Shift ${i + 1}`, type: 'pyq', tier: 'Tier I', year: 2025, examDate: '2025-11-12', shift: i + 1, isFree: true }));
      await context.route('**/backend-api/**', route => {
        const url = new URL(route.request().url()); let json = {};
        if (url.pathname.endsWith('/auth/refresh')) json = { token: 'local-ui-check' };
        if (url.pathname.endsWith('/users/me')) json = { id: 'visual-user', role: 'user', name: 'User' };
        if (url.pathname.includes('/history')) json = { attempts: slots.map((slot, i) => ({ id: `attempt-${i}`, testId: slot.id, status: i === 1 || i === 2 ? 'in_progress' : 'completed', result: { totalScore: 0, maxScore: 200 } })) };
        if (url.pathname.endsWith('/ssc-chsl/slots')) json = { metadata: { mockCount: 0, pyqCount: 56, tiers: ['Tier I'], years: [2025] }, slots: url.searchParams.get('limit') === '0' ? [] : slots, total: 8, nextOffset: null };
        return route.fulfill({ json });
      });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://localhost:3000/mock-test/ssc-chsl?tab=prev');
      await expect(page.locator('article')).toHaveCount(8);
      await expect(page.getByRole('button', { name: 'View Result', exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Resume Mock', exact: true }).first()).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
      await page.addStyleTag({ content: '*,*::before,*::after {animation:none!important;transition:none!important;}' });
      const file = `${width}-${theme}.png`;
      const screenshot = await page.screenshot({ path: path.join(__dirname, `card-depth-${stage}-${file}`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (stage === 'after') {
        if (width >= 768) expect(screenshot.equals(fs.readFileSync(path.join(__dirname, `card-depth-before-${file}`))), `Desktop unchanged: ${theme}`).toBe(true);
        else {
          const styles = await page.locator('article').first().evaluate(el => { const s = getComputedStyle(el); return { border: s.borderTopWidth, shadow: s.boxShadow, background: s.backgroundColor }; });
          expect(styles.border).toBe('1px'); expect(styles.shadow).not.toBe('none');
          await expect(page.getByRole('button', { name: 'Retake', exact: true }).first()).toBeVisible();
          await page.locator('article').last().scrollIntoViewIfNeeded();
          await expect(page.locator('article').last()).toBeInViewport();
        }
      }
      expect(errors).toEqual([]); await context.close();
    }
    console.log(`${stage}: 8 light/dark checks passed${stage === 'after' ? '; mobile card border/shadow, progress actions, scrolling, no overflow; desktop screenshots unchanged' : ''}. API data mocked.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
