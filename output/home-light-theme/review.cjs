const { chromium, request } = require('../../frontend/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const phase = process.argv[2] || 'after';
  const api = await request.newContext();
  const login = await api.post('http://127.0.0.1:3111/auth/login', { data: { email: 'browser-mobile@example.test', password: 'Browser-fixture-123!' } });
  assert(login.ok(), 'Fixture login succeeds');
  const { token } = await login.json();
  const browser = await chromium.launch();
  const results = [];
  for (const width of [320, 390, 768, 1366]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addCookies([{ name: 'access_session', value: 'home-light-review', url: 'http://localhost:3000' }]);
    await context.addInitScript(theme => localStorage.setItem('ui-theme', theme), theme);
    await context.route('**/backend-api/**', async route => {
      const url = new URL(route.request().url());
      const pathname = url.pathname.replace(/^\/backend-api/, '');
      if (pathname === '/auth/refresh') return route.fulfill({ json: { token } });
      const response = await route.fetch({ url: `http://127.0.0.1:3111${pathname}${url.search}` });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://localhost:3000');
    await page.waitForFunction(theme => document.documentElement.classList.contains(`theme-${theme}`), theme);
    await page.getByRole('heading', { name: width < 1024 ? 'Subjects' : 'Explore Subjects', exact: true }).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].filter(image => image.complete).map(image => image.decode().catch(() => {}))); });
    await page.waitForTimeout(700);
    const screenshot = await page.screenshot({ path: path.join(__dirname, `${phase}-${width}-${theme}.png`), animations: 'disabled' });
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      cards: [...document.querySelectorAll('a[class*="mobileSubjectCard"], a[class*="subjectCard_"], a[class*="resourceCard"], a[class*="battleCard"]')].filter(e => e.checkVisibility()).map(e => ({ text: e.innerText, background: getComputedStyle(e).backgroundColor })),
      overlays: [...document.querySelectorAll('span[class*="__artwork"]')].filter(e => e.checkVisibility()).map(e => getComputedStyle(e, '::after').backgroundImage),
    }));
    assert.equal(state.overflow, false, `${width} ${theme}: no horizontal overflow`);
    assert.deepEqual(errors, [], `${width} ${theme}: no browser errors`);
    if (phase === 'after' && theme === 'light') {
      assert(state.overlays.length > 0, 'Artwork exists');
      assert(state.overlays.every(value => value === 'none'), 'No black shading on light cards');
    }
    let darkPixelsUnchanged;
    if (phase === 'after' && theme === 'dark') {
      darkPixelsUnchanged = screenshot.equals(fs.readFileSync(path.join(__dirname, `before-${width}-${theme}.png`)));
      assert(darkPixelsUnchanged, `${width}: dark screenshot is identical`);
    }
    if (phase === 'after' && width < 1024) {
      const carousel = page.getByRole('region', { name: 'Daily study inspiration' });
      await carousel.getByRole('button', { name: /^Show card 2:/ }).click();
      await page.getByRole('heading', { name: 'Stay Consistent' }).waitFor();
      await carousel.getByRole('button', { name: /^Show card 3:/ }).click();
      await page.getByRole('heading', { name: 'Keep Moving Forward' }).waitFor();
      const scroll = page.locator('[class*="mobileScrollContent"]');
      await scroll.evaluate(e => { e.scrollTop = e.scrollHeight; });
      await page.screenshot({ path: path.join(__dirname, `${phase}-${width}-${theme}-scrolled.png`) });
      if (theme === 'light') {
        const drawer = page.getByRole('dialog', { name: 'Main menu', includeHidden: true });
        await page.getByRole('button', { name: 'Open menu' }).click();
        await page.waitForTimeout(350);
        assert.equal(await drawer.getAttribute('aria-hidden'), 'false');
        assert.notEqual(await drawer.evaluate(e => getComputedStyle(e).boxShadow), 'none', 'Open drawer keeps its shadow');
        await page.getByRole('button', { name: 'Close sidebar' }).click();
        await page.waitForTimeout(350);
        assert.equal(await drawer.evaluate(e => getComputedStyle(e).boxShadow), 'none', 'Closed drawer has no shadow');
      }
    }
    results.push({ width, theme, ...state, errors, darkPixelsUnchanged });
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();
  }
  fs.writeFileSync(path.join(__dirname, `${phase}.json`), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({width, theme, darkPixelsUnchanged}) => ({width, theme, darkPixelsUnchanged})), null, 2));
  await browser.close();
  await api.dispose();
})().catch(error => { console.error(error); process.exit(1); });
