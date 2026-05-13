/**
 * Playwright global setup — runs once before all specs.
 *
 * Strategy: drive the actual /sign-in UI with the e2e seed user's
 * credentials, then save the resulting browser storage state to
 * tests/e2e/.auth/user.json. Subsequent specs inherit it via
 * `use: { storageState }` so no per-test sign-in is needed.
 *
 * Earlier versions of this file signed in via the Supabase admin
 * API and then manually injected `sb-access-token` and
 * `sb-refresh-token` cookies. Those are the legacy v1 cookie
 * names — `@supabase/ssr` (what the app uses) reads a single
 * chunked `sb-<projectRef>-auth-token` cookie, so the manual
 * cookies didn't get recognised and every spec landed back on
 * /sign-in. Driving the real form lets the app set its own
 * cookies in the right format regardless of version.
 *
 * The seed user (supabase/seed.sql E2E section) is guaranteed
 * to exist when this runs, because the CI workflow runs
 * `supabase db reset --local --yes` before Playwright starts.
 *
 * Prerequisites:
 *   - The webServer (pnpm start in CI, pnpm dev locally) is up
 *     on http://localhost:3000 (Playwright waits for this).
 *   - `supabase start` has run and migrations + seed are applied.
 *
 * Constants below MUST match supabase/seed.sql exactly.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const E2E_USER_EMAIL = "e2e-user@donezo.test";
const E2E_USER_PASSWORD = "e2e-test-password-12345";

const AUTH_STORAGE_DIR = path.join(__dirname, ".auth");
const AUTH_STORAGE_PATH = path.join(AUTH_STORAGE_DIR, "user.json");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// biome-ignore lint/style/noDefaultExport: Playwright globalSetup requires a default export
export default async function globalSetup() {
  fs.mkdirSync(AUTH_STORAGE_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  try {
    await page.goto("/sign-in", { waitUntil: "networkidle" });
    await page.getByLabel("Email").fill(E2E_USER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(E2E_USER_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // signInWithEmail server action redirects to `next` (defaults to "/").
    // The root page redirects to /w/<slug> for an authenticated user;
    // either way we should land off of /sign-in.
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
      timeout: 30_000,
    });

    // biome-ignore lint/suspicious/noConsole: setup script output is intentional
    console.log("[global-setup] Signed in as", E2E_USER_EMAIL, "→", page.url());

    await context.storageState({ path: AUTH_STORAGE_PATH });
    // biome-ignore lint/suspicious/noConsole: setup script output is intentional
    console.log("[global-setup] Storage state saved to", AUTH_STORAGE_PATH);
  } finally {
    await browser.close();
  }
}
