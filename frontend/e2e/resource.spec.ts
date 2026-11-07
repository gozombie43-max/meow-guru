import { expect, test } from '@playwright/test';
import { loginFixtureUser, routeBackendApi } from './helpers/auth-fixture';

test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: 'wait' });
});

for (const theme of ['light', 'dark'] as const) {
  test(`resource category labels remain readable in ${theme} mode`, async ({ page, context, request }, testInfo) => {
    // Run light mode on desktop and dark mode on mobile so both viewports and both themes are covered without duplicate browser sessions.
    test.skip(
      (testInfo.project.name === 'desktop' && theme !== 'light') ||
        (testInfo.project.name === 'mobile' && theme !== 'dark'),
      'Each viewport covers one theme in the smoke suite to avoid duplicate sessions.',
    );
    const { token } = await loginFixtureUser(request, `browser-${testInfo.project.name}@example.test`);
    await routeBackendApi(context, { token, accessSession: 'resource-fixture' });
    await context.addInitScript(value => localStorage.setItem('ui-theme', value), theme);
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
