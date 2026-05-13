import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Donezo e2e + a11y specs.
 *
 * Runner wiring (CI, parallelism, retries, reporters) is owned by epic 15.
 * This file provides just enough configuration so specs can be run locally:
 *
 *   pnpm dlx playwright test
 *
 * The `test:e2e` script in package.json intentionally stays a no-op stub
 * until epic 15 wires it properly in CI.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Maximum time one test can run. */
  timeout: 30_000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  ...(process.env.CI ? { workers: 1 } : {}),
  /* Reporter to use. */
  reporter: "html",

  use: {
    /* Base URL so tests can use `page.goto('/')` */
    baseURL: "http://localhost:3000",
    /* Collect trace when retrying the failed test. */
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Local dev server — started automatically when running tests locally. */
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
