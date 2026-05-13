import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Donezo e2e + a11y + visual specs.
 *
 * Local run procedure:
 *   supabase start && pnpm db:reset && pnpm test:e2e:install && pnpm test:e2e
 *
 * CI: ephemeral supabase start → db reset → seed → next build → next start → playwright test
 * (see .github/workflows/ci.yml e2e job, wired in epic 15 stage 2)
 *
 * Runner: Chromium only for v1. Firefox + WebKit deferred until stable baselines exist.
 *
 * Auth fixture: global-setup.ts signs in the e2e seed user via Supabase admin API
 * and saves storage state to tests/e2e/.auth/user.json. Specs inherit this via
 * `use: { storageState }` so no per-test sign-in is needed.
 *
 * Visual snapshots: baselines must be generated in a Linux/Docker environment for
 * font-rendering determinism. On macOS, use:
 *   docker run --rm -v $PWD:/work -w /work mcr.microsoft.com/playwright:v1.60.0-jammy \
 *     pnpm test:e2e:visual --update-snapshots
 */
export default defineConfig({
  testDir: "./tests/e2e",

  /* Global setup runs once before all tests — writes auth storage state */
  globalSetup: "./tests/e2e/global-setup.ts",

  /* Maximum time one test can run. */
  timeout: 30_000,

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI to avoid port contention. */
  ...(process.env.CI ? { workers: 1 } : {}),

  /* Reporter: GitHub Actions annotations in CI, HTML report locally. */
  reporter: process.env.CI ? "github" : "html",

  /* Shared settings for all projects. */
  use: {
    /* Base URL so tests can use `page.goto('/')` */
    baseURL: "http://localhost:3000",

    /* Auth state from global-setup — all specs start pre-authenticated. */
    storageState: "tests/e2e/.auth/user.json",

    /* Collect trace when retrying the failed test. */
    trace: "on-first-retry",
  },

  /* Screenshot diff tolerance. Stricter default; visual specs override per-file. */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },

  projects: [
    /* Chromium only for v1. Firefox + WebKit deferred — see epic 15 followup. */
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Web server config.
   * - CI: build first for determinism (pnpm build && pnpm start).
   * - Local dev: allow reusing a running dev server to speed up iteration.
   *
   * The build step is slow (~2–3 min) — locally use `reuseExistingServer: true`
   * by running `pnpm dev` in a separate terminal before `pnpm test:e2e`.
   */
  webServer: {
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 300_000 : 120_000,
  },
});
