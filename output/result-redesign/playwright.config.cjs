const { defineConfig } = require('../../frontend/node_modules/@playwright/test');
const path = require('node:path');
module.exports = defineConfig({
  testDir: path.resolve(__dirname, '../../frontend/e2e'),
  testMatch: ['mock-flow-navigation.spec.ts', 'assessment.spec.ts'],
  workers: 1, timeout: 90000,
  projects: [
    { name: 'desktop', use: { viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  use: { baseURL: 'http://127.0.0.1:3110', headless: true, trace: 'retain-on-failure' },
  outputDir: path.resolve(__dirname, 'e2e-production-artifacts'),
  reporter: [['list'], ['json', { outputFile: path.resolve(__dirname, 'e2e-production-results.json') }]],
  webServer: [
    { command: 'node ../../backend/scripts/browser-fixture.js', cwd: __dirname, url: 'http://127.0.0.1:3111/live', timeout: 90000, reuseExistingServer: true },
    { command: 'npm run start -- --hostname 127.0.0.1 --port 3110', cwd: path.resolve(__dirname, '../../frontend'), url: 'http://127.0.0.1:3110/login', timeout: 60000, env: { API_URL: 'http://127.0.0.1:3111' } },
  ],
});
