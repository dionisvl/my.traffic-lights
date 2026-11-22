import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});
