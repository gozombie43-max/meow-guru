import { test, expect } from '@playwright/test';

const appUrl = process.env.NAVIGATION_APP_URL;
test.skip(!appUrl, 'Set NAVIGATION_APP_URL to a local frontend; API responses are mocked.');

for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`quiz motion preserves grading and navigation (${reducedMotion})`, async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width: 390, height: 844 });
  await context.addCookies([{ name: 'access_session', value: 'quiz-fixture', url: appUrl! }]);
  await page.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    const question = { id: '1', question: 'What is the capital of India?', options: ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], correctAnswer: 'B', solution: 'New Delhi is the capital.', concept: 'Capitals', difficulty: 'easy', questionType: 'concept' };
    const data = url.pathname.endsWith('/session')
      ? { questions: [question, { ...question, id: '2' }], hasMore: false, totalCount: 2 }
      : url.pathname.endsWith('/meta')
        ? { total: 2, exams: [], concepts: ['Capitals'], letters: {}, conceptGroups: [], groupingStatus: 'empty' }
        : {};
    await route.fulfill({ status: url.pathname.includes('refresh') ? 401 : 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`${appUrl}/mathematics/arithmetic/profit-and-loss/quiz`);
  await page.getByRole('button', { name: /^Start Quiz/ }).click();
  await page.getByText('Mumbai', { exact: true }).click();


  const header = await page.locator('.ios-series-header').boundingBox();
  const dock = await page.locator('.ios-series-dock').boundingBox();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByLabel('Incorrect option', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Correct option', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: /Question 2 of 2/ })).toBeVisible();
  await expect(page.getByLabel('Incorrect option', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled();
  expect(await page.locator('.ios-series-header').boundingBox()).toEqual(header);
  expect(await page.locator('.ios-series-dock').boundingBox()).toEqual(dock);
  await page.getByText('New Delhi', { exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByLabel('Correct option', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'View solution', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Question solution' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to quiz', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Question solution' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ask AI tutor', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'AI Tutor', exact: true })).toBeVisible();
});
