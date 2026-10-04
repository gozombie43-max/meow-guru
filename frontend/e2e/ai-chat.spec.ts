import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const fixtureURL = 'http://127.0.0.1:3111';

for (const theme of ['light', 'dark'] as const) {
  test(`AI Tutor hydrates and restores saved history (${theme})`, async ({ page, context, request }, testInfo) => {
    const login = await request.post(`${fixtureURL}/auth/login`, {
      data: { email: `browser-${testInfo.project.name}@example.test`, password: 'Browser-fixture-123!' },
    });
    expect(login.ok()).toBeTruthy();
    const { token } = await login.json();
    const headers = { Authorization: `Bearer ${token}` };
    const chatId = randomUUID();
    const title = `Saved revision ${chatId}`;
    const content = `Review percentages ${chatId}`;
    const saved = await request.put(`${fixtureURL}/users/me/ai-chats/${chatId}`, {
      headers, data: { title, messages: [{ role: 'user', content }] },
    });
    expect(saved.ok(), 'Save chat with the real fixture handler').toBeTruthy();

    const browserErrors: string[] = [];
    const apiFailures: string[] = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/backend-api/') && response.status() >= 400) {
        apiFailures.push(`${response.status()} ${response.url()}`);
      }
    });
    await context.addCookies([{ name: 'access_session', value: 'ai-chat-fixture', url: 'http://127.0.0.1:3110' }]);
    await context.addInitScript(selectedTheme => localStorage.setItem('ui-theme', selectedTheme), theme);
    await context.route('**/backend-api/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace(/^\/backend-api/, '');
      if (path === '/auth/refresh') {
        await route.fulfill({ json: { token } });
      } else {
        const response = await route.fetch({ url: `${fixtureURL}${path}${url.search}` });
        await route.fulfill({ response });
      }
    });

    try {
      await page.goto('/ai-chat');
      await expect(page.locator('main.ai-chat-page')).toHaveAttribute('data-theme', theme);
      const sidebar = page.getByRole('complementary', { name: 'AI chat sidebar' });
      const mobile = testInfo.project.name === 'mobile';
      if (mobile) {
        await expect(sidebar).toHaveClass(/is-collapsed/);
        await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
        await expect(sidebar).not.toHaveClass(/is-collapsed/);
        // The sidebar covers the center of its full-screen backdrop.
        await page.getByRole('button', { name: 'Close sidebar', exact: true }).click({
          position: { x: page.viewportSize()!.width - 10, y: 100 },
        });
        await expect(sidebar).toHaveClass(/is-collapsed/);
        await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
      } else {
        await expect(sidebar).not.toHaveClass(/is-collapsed/);
        await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
        await expect(sidebar).toHaveClass(/is-collapsed/);
        await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
      }
      await page.getByRole('button', { name: title, exact: true }).click();
      await expect(page.getByText(content, { exact: true })).toBeVisible();
      if (mobile) {
        await expect(sidebar).toHaveClass(/is-collapsed/);
        await expect.poll(async () => {
          const bounds = await sidebar.boundingBox();
          return bounds ? bounds.x + bounds.width : 0;
        }, { message: 'The closing sidebar has moved completely off screen' }).toBeLessThanOrEqual(0);
      }
      await page.screenshot({ path: testInfo.outputPath('ai-chat.png'), fullPage: true, animations: 'disabled' });

      await page.reload();
      if (mobile) await page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
      await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
      expect(browserErrors, 'No hydration or browser errors').toEqual([]);
      expect(apiFailures, 'No fixture API failures').toEqual([]);
    } finally {
      const deleted = await request.delete(`${fixtureURL}/users/me/ai-chats/${chatId}`, { headers });
      expect(deleted.ok(), 'Remove the saved fixture chat').toBeTruthy();
      const history = await request.get(`${fixtureURL}/users/me/ai-chats`, { headers });
      expect(history.ok()).toBeTruthy();
      const { aiChats } = await history.json();
      expect(aiChats.some((chat: { id: string }) => chat.id === chatId)).toBeFalsy();
    }
  });
}
