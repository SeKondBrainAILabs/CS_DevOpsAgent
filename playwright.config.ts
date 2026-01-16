/**
 * Playwright Configuration for Kanvas E2E Tests
 * Tests the Electron app end-to-end
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/kanvas/e2e',
  fullyParallel: false, // Electron tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Electron
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
  outputDir: 'test-results/',
});
