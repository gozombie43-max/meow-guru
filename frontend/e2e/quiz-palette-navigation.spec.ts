import { test, expect } from '@playwright/test';

const appUrl = process.env.NAVIGATION_APP_URL;
test.skip(!appUrl, 'Set NAVIGATION_APP_URL to a local frontend; API responses are mocked.');
test.use({ hasTouch: true });

for (const count of [60, 150]) {
  test(`palette close target stays stationary with ${count} questions`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await context.addCookies([{ name: 'access_session', value: 'palette-fixture', url: appUrl! }]);
    await page.route('**/backend-api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const questions = Array.from({ length: count }, (_, index) => ({
        id: String(index + 1), question: 'What is the capital of India?',
        options: ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], correctAnswer: 'B', concept: 'Capitals',
      }));
      const data = path.endsWith('/session') ? { questions, hasMore: false, totalCount: count }
        : path.endsWith('/meta') ? { total: count, exams: [], concepts: ['Capitals'], letters: {}, conceptGroups: [], groupingStatus: 'empty' } : {};
      await route.fulfill({ status: path.includes('refresh') ? 401 : 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(`${appUrl}/mathematics/arithmetic/profit-and-loss/quiz`);
    await page.getByRole('button', { name: /^Start Quiz/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Question navigator' });
    const close = page.getByRole('button', { name: 'Close question navigator', exact: true });
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.getByRole('button', { name: /Open question navigator/ }).click();
      await expect(dialog).toBeVisible();
      await page.locator('.ios-series-palette-grid').evaluate(el => { el.scrollTop = el.scrollHeight; });
      const before = (await close.boundingBox())!;
      // A press near the top used to lose the target when tap-scale replaced translateY.
      await page.mouse.move(before.x + before.width / 2, before.y + 3);
      await page.mouse.down();
      await page.waitForTimeout(70);
      const during = (await close.boundingBox())!;
      expect(during.y).toBeCloseTo(before.y, 1);
      expect(during.height).toBeCloseTo(before.height, 1);
      await page.mouse.up();
      await expect(dialog).toBeHidden();
    }
    await page.getByRole('button', { name: /Open question navigator/ }).tap();
    await close.tap();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /Open question navigator/ }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
}
