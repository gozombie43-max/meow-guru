import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: /(?:quiz-)?navigation\.spec\.ts/, workers: 1, timeout: 45000,
  use: { headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
});
