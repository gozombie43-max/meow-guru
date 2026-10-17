const requireFrontend = require('node:module').createRequire(process.cwd() + '/package.json');
const { chromium } = requireFrontend('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'access_session', value: 'review-layout', url: 'http://localhost:3000' }]);
    await context.addInitScript(() => localStorage.setItem('ui-theme', 'dark'));
    const sections = ['Math', 'English', 'Reasoning', 'General Awareness'].map((label, section) => ({
      key: String(section), label, questions: Array.from({ length: 25 }, (_, i) => ({
        id: `${section}-${i}`, question: `Question ${i + 1}: A train travels 240 km in 4 hours. Find its average speed.`,
        options: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'],
        solution: 'Average speed = distance / time = 60 km/h. ' + 'Always use consistent units. '.repeat(24),
        translations: { question: { en: `Question ${i + 1}: A train travels 240 km in 4 hours. Find its average speed.`, bn: `Bengali question ${i + 1}` }, options: { en: ['40 km/h', '50 km/h', '60 km/h', '80 km/h'], bn: ['40', '50', '60', '80'] }, solution: { en: 'Average speed = 60 km/h. ' + 'Always use consistent units. '.repeat(24), bn: 'Bengali explanation' } },
      })),
    }));
    await context.route('**/backend-api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { token: 'layout-token' } });
      if (path.endsWith('/users/me')) return route.fulfill({ json: { id: 'layout-user', name: 'Layout', progress: {}, bookmarks: [] } });
      if (path.includes('/api/mocktest/attempt/')) return route.fulfill({ json: { status: 'completed', paper: { examName: 'SSC CHSL Tier I', schemaDriven: true, sections }, answers: { '0-1': '2', '0-2': '0' }, answerKey: Object.fromEntries(sections.flatMap(s => s.questions).map(q => [q.id, '2'])) } });
      return route.fulfill({ json: {} });
    });
    const page = await context.newPage();
    const failures = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let layouts = 0;
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height });
      await page.goto(`http://localhost:3000/mock-test/ssc-chsl/test/review/layout-${theme}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('main', { name: 'Question and solution' }).waitFor();
      await page.evaluate(theme => { for (const node of [document.documentElement, document.body]) { node.classList.remove('theme-light', 'theme-dark'); node.classList.add(`theme-${theme}`); } }, theme);
      const dimensions = await page.evaluate(() => ({ height: innerHeight, width: innerWidth, scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth }));
      if (dimensions.scrollHeight > height || dimensions.scrollWidth > width) failures.push({ theme, ...dimensions });
      for (const name of ['Previous', 'Next']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        if (!box || box.y < 0 || box.y + box.height > height) failures.push({ name, width, height, box });
      }
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByText('Question 2 of 25', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('correct');
      await page.getByText('Question 2 of 25', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('all');
      await page.getByRole('button', { name: /^Questions/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Jump to question' });
      await dialog.getByRole('button', { name: 'Question 25, skipped', exact: true }).click();
      await page.getByText('Question 25 of 25', { exact: true }).waitFor();
      if (await dialog.isVisible()) failures.push({ dialog: 'Did not close after selection', width, theme });
      await page.getByRole('button', { name: /^Questions/ }).click();
      await page.keyboard.press('Escape');
      if (await dialog.isVisible()) failures.push({ dialog: 'Escape failed', width, theme });
      await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption('1');
      await page.getByRole('combobox', { name: 'Show', exact: true }).selectOption('correct');
      await page.getByRole('heading', { name: 'No correct questions', exact: true }).waitFor();
      if (await page.getByText(/A train travels/).count()) failures.push({ filter: 'Unrelated question displayed', width, theme });
      await page.getByRole('button', { name: 'Show all questions', exact: true }).click();
      await page.getByRole('button', { name: 'বাংলা', exact: true }).click();
      await page.getByText('Bengali question 1', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'ENG', exact: true }).click();
      await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption('0');
      await page.screenshot({ path: `../output/review-design/${width}-${theme}.png` });
      if (width === 390) {
        await page.getByRole('button', { name: /^Questions/ }).click();
        await page.screenshot({ path: `../output/review-design/palette-${theme}.png` });
        await page.keyboard.press('Escape');
      }
      layouts++;
    }
    console.log(JSON.stringify({ layouts, failures, errors }));
    await context.unrouteAll({ behavior: 'wait' });
    if (failures.length || errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
