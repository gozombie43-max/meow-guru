import { expect, test } from '@playwright/test';
import { loginFixtureUser, routeBackendApi } from './helpers/auth-fixture';

test.afterEach(async ({ context }) => { await context.unrouteAll({ behavior: 'wait' }); });

test('sign-in supports skipping navigation, keyboard password controls, and associated validation', async ({ page, context }, info) => {
  await context.route('**/backend-api/**', route => route.fulfill({ status: 401, json: { message: 'Sign in to continue.' } }));
  await page.goto('/login');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-page-content]')).toBeFocused();

  await page.getByRole('button', { name: 'Log in with password', exact: true }).click();
  const submit = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('Email is required');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAccessibleDescription('Password is required');
  await password.fill('Study-password-123!');
  await password.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  if (info.project.name === 'mobile') {
    for (const field of [email, password]) {
      expect(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('sign-in-keyboard-validation.png'), fullPage: true });
  let releaseLogin!: () => void;
  const pendingLogin = new Promise<void>(resolve => { releaseLogin = resolve; });
  await context.route('**/backend-api/auth/login', async route => {
    await pendingLogin;
    await route.fulfill({ status: 401, json: { message: 'Email or password is incorrect.' } });
  });
  await email.fill('student@example.test');
  try {
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(submit).toContainText('Sign In');
  } finally { releaseLogin(); }
  await expect(submit).toBeEnabled();
});

test('theme switching updates browser colors and keeps settings focus contained', async ({ page, context, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'Theme color-scheme and ultrawide layout check runs once on desktop.');
  const { token } = await loginFixtureUser(request, 'browser-mobile@example.test');
  await routeBackendApi(context, {
    token,
    accessSession: 'web-guidelines-fixture',
    frontendUrl: info.project.use.baseURL!,
  });
  await context.addInitScript(() => { if (!localStorage.getItem('ui-theme')) localStorage.setItem('ui-theme', 'dark'); });
  await page.goto('/profile');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
  const preferences = page.getByRole('button', { name: 'Preferences & reminders' });
  await preferences.click();
  const dialog = page.getByRole('dialog', { name: 'Preferences & Settings' });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close settings' });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole('switch', { name: 'Toggle dark mode' }).click();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('body')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f4f5f7');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(preferences).toBeFocused();
  await page.screenshot({ path: info.outputPath('profile-light-theme.png'), fullPage: true });
  await page.setViewportSize({ width: 2560, height: 1080 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('profile-ultrawide.png'), fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f4f5f7');

  await page.goto('/play?exam=ssc-cgl');
  const mode = page.locator('a.training-mode-card').first();
  await expect(mode).toHaveAttribute('href', /^\/play\/setup\/.+\?exam=ssc-cgl$/);
  expect(await mode.getAttribute('role')).toBeNull();
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f4f5f7');
});

test('mobile carousel has three navigation controls and respects reduced motion', async ({ page, context, request }, info) => {
  test.skip(info.project.name !== 'mobile', 'The slideshow belongs to mobile Home');
  const { token } = await loginFixtureUser(request, 'browser-mobile@example.test');
  await routeBackendApi(context, {
    token,
    accessSession: 'web-motion-fixture',
    frontendUrl: info.project.use.baseURL!,
  });
  await page.goto('/');
  const carousel = page.getByRole('region', { name: 'Daily study inspiration' });
  await expect(carousel.getByRole('button')).toHaveCount(3);
  await expect(carousel.getByRole('button', { name: /slideshow/ })).toHaveCount(0);
  await expect(carousel).toHaveAttribute('data-playing', 'true');
  for (const button of await carousel.getByRole('button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath('home-carousel.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await carousel.getByRole('button', { name: /^Show card 2:/ }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect(carousel).toHaveAttribute('data-playing', 'false');
  await expect(carousel.getByRole('heading', { name: 'Stay Consistent' })).toBeInViewport();
  await page.waitForTimeout(5500);
  await expect(carousel.getByRole('button', { name: /^Show card 2:/ })).toHaveAttribute('aria-current', 'true');
});
