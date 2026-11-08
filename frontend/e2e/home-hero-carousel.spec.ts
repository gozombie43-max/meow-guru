import { expect, test } from '@playwright/test';
import { loginFixtureUser, routeBackendApi } from './helpers/auth-fixture';

test.afterEach(async ({ context }) => { await context.unrouteAll({ behavior: 'wait' }); });

test('mobile Home hero cycles three cards, supports keyboard/swipe, and fits 390px and 320px in both themes', async ({ page, context, request }, info) => {
  test.skip(info.project.name !== 'mobile', 'The carousel is on the mobile Home page');
  const { token } = await loginFixtureUser(request, 'browser-mobile@example.test');
  await routeBackendApi(context, {
    token,
    accessSession: 'hero-carousel-fixture',
    frontendUrl: info.project.use.baseURL!,
  });
  await context.addInitScript(() => localStorage.setItem('ui-theme', 'light'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const header = page.locator('header[data-ui-chrome="header"]').filter({ visible: true });
  await expect(header.getByRole('link', { name: 'Your profile', exact: true })).toHaveCount(0);
  const you = page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'You', exact: true });
  await expect(you).toHaveAttribute('href', '/profile');
  await expect(you.locator('svg path')).toHaveCount(0);
  const carousel = page.getByRole('region', { name: 'Daily study inspiration' });
  const dot = (index: number) => carousel.getByRole('button', { name: new RegExp(`^Show card ${index}:`) });
  await expect(dot(1)).toHaveAttribute('aria-current', 'true');
  const cardBox = (await carousel.getByRole('group', { name: '1 of 3' }).boundingBox())!;
  const controlsBox = (await dot(1).locator('..').boundingBox())!;
  expect(controlsBox.y).toBeGreaterThanOrEqual(cardBox.y);
  expect(controlsBox.y + controlsBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
  expect(Math.abs(controlsBox.x + controlsBox.width / 2 - (cardBox.x + cardBox.width / 2))).toBeLessThan(1);
  await expect(carousel.getByRole('button')).toHaveCount(3);
  await page.screenshot({ path: info.outputPath('hero-original.png') });
  await expect(dot(2)).toHaveAttribute('aria-current', 'true', { timeout: 8000 });
  await dot(2).focus();
  // Carousel controls inherit the app's neutral inset keyboard-focus style.
  await expect(dot(2)).toBeFocused();
  await expect(dot(2)).toHaveCSS('outline-style', 'solid');
  await expect(dot(2)).toHaveCSS('outline-width', '2px');
  await expect(dot(2)).toHaveCSS('outline-offset', '-1px');
  const neutralFocusColor = await dot(2).evaluate(button => {
    const reference = document.createElement('span');
    reference.style.color = 'var(--ui-secondary)';
    button.append(reference);
    const color = getComputedStyle(reference).color;
    reference.remove();
    return color;
  });
  await expect(dot(2)).toHaveCSS('outline-color', neutralFocusColor);
  await expect(dot(2)).toHaveCSS('box-shadow', 'none');
  await expect(carousel.getByRole('heading', { name: 'Stay Consistent' })).toBeInViewport();
  await expect.poll(async () => Math.abs((await carousel.getByRole('group', { name: '2 of 3' }).boundingBox())!.x - (await carousel.boundingBox())!.x)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('hero-consistency.png') });
  await dot(3).tap();
  await expect(carousel.getByRole('heading', { name: 'Keep Moving Forward' })).toBeInViewport();
  await expect.poll(async () => Math.abs((await carousel.getByRole('group', { name: '3 of 3' }).boundingBox())!.x - (await carousel.boundingBox())!.x)).toBeLessThan(2);
  await page.screenshot({ path: info.outputPath('hero-momentum.png') });
  // Native scroll events (also used by touch swipes) keep the current dot in sync.
  await carousel.locator('[aria-live]').evaluate(track => track.scrollTo({ left: 0, behavior: 'instant' }));
  await expect(dot(1)).toHaveAttribute('aria-current', 'true');
  await dot(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dot(2)).toHaveAttribute('aria-current', 'true');
  await expect.poll(async () => Math.abs((await carousel.getByRole('group', { name: '2 of 3' }).boundingBox())!.x - (await carousel.boundingBox())!.x)).toBeLessThan(2);
  await page.keyboard.press('ArrowRight');
  await expect(dot(3)).toHaveAttribute('aria-current', 'true');
  await expect.poll(async () => Math.abs((await carousel.getByRole('group', { name: '3 of 3' }).boundingBox())!.x - (await carousel.boundingBox())!.x)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Verify 320px dark-theme responsive fit without repeating the full timer cycle.
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => {
    localStorage.setItem('ui-theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await you.tap();
  await expect(page).toHaveURL(/\/profile$/);
  expect(errors).toEqual([]);
});
