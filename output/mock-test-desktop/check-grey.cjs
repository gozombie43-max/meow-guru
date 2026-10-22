const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const stage = process.argv[2] || 'before';
(async () => {
  const browser = await chromium.launch();
  let checks = 0;
  try {
    for (const theme of ['light', 'dark']) for (const exam of ['ssc-chsl']) {
      const sizes = [[390,844],[1366,900]];
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

        for (const kind of ['mock','pyq']) {
          if(kind === 'pyq') await page.getByRole('button', {name: width < 768 ? /PYQs/ : /Previous Papers/}).click();
          await expect(page.locator('article').first()).toBeVisible();
          await expect.poll(() => page.locator('article').first().evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe('');
          const card = await page.locator('article').first().evaluate(el=>getComputedStyle(el).backgroundColor);
          const control = await page.getByRole('combobox', {name:'Select tier'}).evaluate(el=>getComputedStyle(el).backgroundColor);
          if(theme==='dark') expect(card).toBe(control);
          console.log({theme,width,kind,card,control});
          await page.screenshot({path:path.join(__dirname,'grey-'+theme+'-'+width+'-'+kind+'.png')});
        }
        await context.close();
      }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
