import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration
 * See https://playwright.dev/docs/test-configuration
 */
const PORT = process.env.PORT || 5173;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  /* Maximum time one test can run for */
  timeout: 60 * 1000,
  expect: {
    timeout: 15 * 1000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only or 1 retry on local if needed */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to target local dev server */
    baseURL: BASE_URL,

    /* Run in headless mode by default */
    headless: true,

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Capture screenshot after each failure */
    screenshot: 'only-on-failure',

    /* Retain video only on test failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers (Chromium headless by default) */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
  ],

  /* Run local dev server before starting the tests, reuse if active */
  webServer: {
    command: 'pnpm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
