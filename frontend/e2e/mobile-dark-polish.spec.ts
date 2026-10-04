import { expect, test } from '@playwright/test';

const note = { id: 'design-note', title: 'Percentage shortcuts', type: 'formula', topic: 'Percentages', tags: ['revision'], body: '<h1>Percentage shortcuts</h1>', updatedAt: '2026-10-01T10:00:00Z' };

for (const scenario of [
  { width: 320, theme: 'dark' }, { width: 390, theme: 'dark' },
  { width: 390, theme: 'light' }, { width: 1366, theme: 'dark' },
] as const) {
  test(`notes library and editor ${scenario.theme} ${scenario.width}px`, async ({ page, context, request }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 844 });
    const login = await request.post('http://127.0.0.1:3111/auth/login', { data: { email: 'browser-mobile@example.test', password: 'Browser-fixture-123!' } });
    expect(login.ok()).toBeTruthy();
    const { token, user } = await login.json();
    await context.addCookies([{ name: 'access_session', value: 'polish-fixture', url: testInfo.project.use.baseURL! }]);
    await context.addInitScript(theme => {
      if (window === window.top) localStorage.setItem('ui-theme', theme);
    }, scenario.theme);
    let invalidResponse = false;
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await context.route('**/backend-api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/refresh')) return route.fulfill({ json: { token } });
      if (url.pathname.endsWith('/users/me')) return route.fulfill({ json: { ...user, progress: {}, recentQuizzes: [], bookmarks: [] } });
      if (url.pathname.endsWith('/api/notes')) return route.fulfill({ json: invalidResponse ? { error: 'Service unavailable' } : [note] });
      return route.fulfill({ json: {} });
    });
    await page.goto('/notes');
    await expect(page.getByRole('link', { name: note.title })).toBeVisible();
    await expect(page.getByRole('link', { name: note.title })).toHaveAttribute('href', '/notes/view?id=design-note');
    const search = page.getByRole('searchbox', { name: 'Search notes' });
    await search.fill('no match');
    await expect(page.getByRole('heading', { name: 'No matching notes' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).last().click();
    await expect(page.getByRole('link', { name: note.title })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/mobile-polish/notes-${scenario.theme}-${scenario.width}.png` });

    invalidResponse = true;
    await page.reload();
    await expect(page.getByRole('alert').filter({ hasText: 'Something needs attention' })).toContainText('could not be loaded');
    invalidResponse = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('link', { name: note.title })).toBeVisible();

    await page.getByRole('link', { name: 'New note' }).click();
    await expect(page.getByRole('textbox', { name: 'Note title' })).toBeVisible();
    const split = page.getByRole('button', { name: 'Split', exact: false });
    await expect(split).toHaveAttribute('aria-pressed', 'true');
    const frame = page.locator('iframe[title="note-preview"]');
    await expect(frame).toBeAttached();
    const frameBox = await frame.boundingBox();
    expect(frameBox!.width).toBeGreaterThan(scenario.width < 768 ? scenario.width - 40 : 500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const snippets = page.getByRole('button', { name: 'Tip', exact: false }).filter({ hasText: 'Tip' });
    await expect(snippets.first()).toBeVisible();
    await page.screenshot({ path: `test-results/mobile-polish/editor-${scenario.theme}-${scenario.width}.png` });
    await page.getByRole('button', { name: 'Preview', exact: false }).click();
    await expect(frame).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}
