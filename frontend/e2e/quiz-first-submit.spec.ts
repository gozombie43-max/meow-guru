import { test, expect } from '@playwright/test';

const appUrl = process.env.NAVIGATION_APP_URL;
test.skip(!appUrl, 'Set NAVIGATION_APP_URL to a local frontend; API responses are mocked.');

test('first submission keeps the quiz visible while optional panels load', async ({ page, context }) => {
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
  await page.getByText('New Delhi', { exact: true }).click();

  let release!: () => void;
  const pendingChunks = new Promise<void>(resolve => { release = resolve; });
  let delayedChunks = 0;
  await page.route('**/_next/static/**/*.js', async route => {
    delayedChunks++;
    await pendingChunks;
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect.poll(() => delayedChunks).toBeGreaterThan(0);
    // Allow React's delayed Suspense fallback to appear on a cold chunk load.
    await page.waitForTimeout(700);
    await expect(page.locator('.ios-series-quiz')).toBeVisible();
    await expect(page.getByLabel('Correct option')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  } finally {
    release();
  }
  await page.getByRole('button', { name: 'View solution', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Question solution' })).toBeVisible();
});
