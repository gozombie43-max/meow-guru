import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 45000,
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  use: { baseURL: 'http://127.0.0.1:3110', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure' },
  webServer: [
    { command: 'node ../backend/scripts/browser-fixture.js', url: 'http://127.0.0.1:3111/live', timeout: 90000 },
    { command: 'npm run start -- --hostname 127.0.0.1 --port 3110', url: 'http://127.0.0.1:3110/login', timeout: 60000 },
  ],
});
