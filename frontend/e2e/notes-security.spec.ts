import { expect, test } from '@playwright/test';
import sharp from 'sharp';

for (const role of ['admin', 'superadmin', 'student'] as const) {
  test(`${role} notes permissions and upload flow`, async ({ page, context }, testInfo) => {
    await context.addCookies([{ name: 'access_session', value: 'notes-fixture', url: testInfo.project.use.baseURL! }]);
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill(`browser-${role === 'student' ? testInfo.project.name : role}@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('Browser-fixture-123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    const response = await page.goto('/notes');
    expect(response!.headers()['content-security-policy-report-only']).toContain('report-uri /api/csp-report');
    if (role === 'student') {
      await expect(page.getByRole('heading', { name: 'My notes' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'New note' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
      await page.goto('/notes/new'); await expect(page).toHaveURL(/\/notes$/);
      await page.goto('/notes/edit?id=other'); await expect(page).toHaveURL(/\/notes$/);
      return;
    }
    await page.getByRole('link', { name: 'New note' }).click();
    const title = `Security ${role} ${testInfo.project.name}`;
    await page.getByRole('textbox', { name: 'Note title…', exact: true }).fill(title);
    const image = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#007aff' } }).png().toBuffer();
    const upload = page.waitForResponse(response => response.url().includes('/api/upload-note-image') && response.request().method() === 'POST');
    await page.getByLabel('Choose file', { exact: true }).setInputFiles({ name: 'note.png', mimeType: 'image/png', buffer: image });
    expect((await upload).status()).toBe(200);
    const preview = page.frameLocator('iframe[title="note-preview"]');
    await expect(preview.locator('img.note-img')).toHaveAttribute('src', /\/backend-api\/api\/upload\/image\//);
    await expect.poll(() => preview.locator('img.note-img').evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Save Note', exact: false }).click();
    await expect(page.getByRole('button', { name: 'Saved!', exact: false })).toBeVisible();
    await page.goto('/notes'); await page.getByRole('link', { name: title, exact: true }).click();
    await expect.poll(() => page.frameLocator(`iframe[title="${title}"]`).locator('img.note-img').evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    await page.goto('/notes'); page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete ${title}`, exact: true }).click();
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);
  });
}

test('signed-out visitors cannot open note editors', async ({ page, context }, testInfo) => {
  await context.addCookies([{ name: 'access_session', value: 'notes-fixture', url: testInfo.project.use.baseURL! }]);
  await page.goto('/notes/new');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Save Note', exact: false })).toHaveCount(0);
});
