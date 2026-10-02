import { expect, test } from '@playwright/test';

test('large mobile question palettes stay bounded and reach the last question in both themes', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: 'access_session', value: 'architecture-fixture', domain: '127.0.0.1', path: '/' }]);
  await context.addInitScript(() => localStorage.setItem('quiz_hide_question_numbers', 'false'));
  const questions = Array.from({ length: 500 }, (_, index) => ({ id: `large-${index}`, question: `Fixture question ${index + 1}`, options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 1, topic: 'algebra', subject: 'mathematics', difficulty: 'easy', concept: 'Addition', exam: 'SSC CGL' }));
  await context.route('**/backend-api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/session') ? { questions, hasMore: false, nextCursor: null, totalCount: 500 }
      : path.endsWith('/meta') ? { total: 500, exams: ['SSC CGL'], concepts: ['Addition'], letters: {}, conceptGroups: [], groupingStatus: 'empty' } : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/mathematics/algebra/quiz');
  await page.getByRole('button', { name: /Start Quiz/i }).first().click();
  await expect(page.locator('.ios-series-prompt')).toBeVisible();
  await expect(page.locator('.ios-series-rail button').first()).toBeVisible();
  expect(await page.locator('.ios-series-rail button').count()).toBeLessThan(30);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.setAttribute('data-theme', value); document.documentElement.classList.toggle('dark', value === 'dark'); }, theme);
    await page.getByRole('button', { name: /Open question navigator/i }).click();
    const grid = page.locator('.ios-series-palette-grid');
    expect(await grid.locator('button').count()).toBeLessThan(100);
    await grid.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.getByRole('button', { name: 'Go to question 500', exact: true }).click();
    await expect(page.locator('.ios-series-prompt')).toContainText('Fixture question 500');
    await expect(page.getByRole('button', { name: 'Question 500, current', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const target = await page.getByRole('button', { name: 'Question 500, current', exact: true }).boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(44);
  }
});

test('large desktop question palettes keep their last row reachable', async ({ page, context }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await context.addCookies([{ name: 'access_session', value: 'architecture-fixture', domain: '127.0.0.1', path: '/' }]);
  const questions = Array.from({ length: 500 }, (_, index) => ({ id: `desktop-large-${index}`, question: `Desktop fixture question ${index + 1}`, options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 1, concept: 'Addition', exam: 'SSC CGL' }));
  await context.route('**/backend-api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/session') ? { questions, hasMore: false, nextCursor: null, totalCount: 500 }
      : path.endsWith('/meta') ? { total: 500, exams: ['SSC CGL'], concepts: ['Addition'], letters: {}, conceptGroups: [], groupingStatus: 'empty' } : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/mathematics/algebra/quiz');
  await page.getByRole('button', { name: /Start Quiz/i }).first().click();
  const palette = page.locator('.mac-series-palette-grid-wrap');
  await expect(palette).toBeVisible();
  expect(await palette.locator('button').count()).toBeLessThan(100);
  await palette.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const last = page.getByRole('button', { name: 'Go to question 500', exact: true });
  await last.click();
  await expect(last).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.mac-series-question-card')).toContainText('Desktop fixture question 500');
});
