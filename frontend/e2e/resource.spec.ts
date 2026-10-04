import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(`resource category labels remain readable in ${theme} mode`, async ({ page, context, request }, testInfo) => {
    const login = await request.post('http://127.0.0.1:3111/auth/login', {
      data: { email: `browser-${testInfo.project.name}@example.test`, password: 'Browser-fixture-123!' },
    });
    expect(login.ok()).toBeTruthy();
    const { token } = await login.json();
    await context.addCookies([{ name: 'access_session', value: 'resource-fixture', url: 'http://127.0.0.1:3110' }]);
    await context.addInitScript(value => localStorage.setItem('ui-theme', value), theme);
    await context.route('**/backend-api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/auth/refresh')) return route.fulfill({ json: { token } });
      const response = await route.fetch({ url: `http://127.0.0.1:3111${url.pathname.replace('/backend-api', '')}${url.search}` });
      return route.fulfill({ response });
    });
    await page.goto('/resource');
    const categories = page.getByRole('tablist', { name: 'Resource Categories' });
    const active = categories.getByRole('tab', { name: 'Books', exact: true });
    await expect(active).toBeVisible();
    await expect(active).toHaveAttribute('aria-selected', 'true');
    const contrast = await active.evaluate((element, selectedTheme) => {
      const rgb = getComputedStyle(element).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const luminance = (values: number[]) => values.map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      }).reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
      const foreground = luminance(rgb), background = luminance(selectedTheme === 'light' ? [255, 255, 255] : [28, 28, 30]);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    }, theme);
    expect(contrast, 'Active text must contrast with its theme surface').toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath('resource.png'), fullPage: true, animations: 'disabled' });
  });
}
