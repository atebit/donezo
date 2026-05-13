/**
 * Playwright global setup — runs once before all specs.
 *
 * Strategy: drive the actual /sign-in UI with the e2e seed user's
 * credentials, then save the resulting browser storage state to
 * tests/e2e/.auth/user.json. Subsequent specs inherit it via
 * `use: { storageState }` so no per-test sign-in is needed.
 *
 * Robustness notes
 * ----------------
 * Earlier iterations failed because they coupled the storage-state
 * snapshot to the home-page → /w/<slug> redirect chain. If that chain
 * has *any* bug (RLS, shape inference, error boundary catching the
 * NEXT_REDIRECT throw, …) the entire suite is dead before any spec
 * runs and the failure is opaque — no traces, no screenshots, just
 * a `waitForURL` timeout.
 *
 * The fix is to decouple auth from redirect:
 *   1. Submit the /sign-in form (this is what populates the
 *      @supabase/ssr cookie jar).
 *   2. Wait for navigation *off* /sign-in — that proves the action
 *      succeeded, regardless of where router.push("/") lands.
 *   3. Independently verify the cookies grant access by going
 *      directly to the seeded workspace at /w/e2e-workspace and
 *      asserting we don't get bounced back to /sign-in.
 *   4. Snapshot storage state.
 *
 * We also forward every page console message and pageerror to the
 * test runner's stdout so CI logs surface whatever the home page
 * (or any other server component) is actually doing.
 *
 * The seed user (supabase/seed.sql E2E section) is guaranteed
 * to exist when this runs, because the CI workflow runs
 * `supabase db reset --local --yes` before Playwright starts.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const E2E_USER_EMAIL = "e2e-user@donezo.test";
const E2E_USER_PASSWORD = "e2e-test-password-12345";
const E2E_WORKSPACE_SLUG = "e2e-workspace";

const AUTH_STORAGE_DIR = path.join(__dirname, ".auth");
const AUTH_STORAGE_PATH = path.join(AUTH_STORAGE_DIR, "user.json");
const DIAG_DIR = path.join(__dirname, ".diag");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

function log(...args: unknown[]): void {
  // biome-ignore lint/suspicious/noConsole: setup script output is intentional
  console.log("[global-setup]", ...args);
}

// biome-ignore lint/style/noDefaultExport: Playwright globalSetup requires a default export
export default async function globalSetup() {
  fs.mkdirSync(AUTH_STORAGE_DIR, { recursive: true });
  fs.mkdirSync(DIAG_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  // Forward browser console + errors to the test runner stdout for CI logs.
  page.on("console", (msg) => log(`page.console.${msg.type()}:`, msg.text()));
  page.on("pageerror", (err) => log("page.error:", err.message));
  page.on("requestfailed", (req) =>
    log("page.requestfailed:", req.url(), req.failure()?.errorText ?? "(unknown)"),
  );

  try {
    log("navigating to /sign-in");
    await page.goto("/sign-in", { waitUntil: "networkidle" });

    log("filling credentials and submitting");
    await page.getByLabel("Email").fill(E2E_USER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(E2E_USER_PASSWORD);

    // Click the submit button *and* wait for the URL to leave /sign-in
    // — racing them ensures we don't miss the navigation event.
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
        timeout: 30_000,
      }),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    log("left /sign-in →", page.url());

    // Let any in-flight @supabase/ssr token refresh complete so cookies
    // are stable before we snapshot.
    await page.waitForLoadState("networkidle");

    // Independently verify the cookies grant access. If sign-in worked
    // we land inside the workspace; if cookies are bad, middleware
    // bounces us back to /sign-in?next=/w/<slug>.
    log("verifying auth by visiting /w/", E2E_WORKSPACE_SLUG);
    await page.goto(`/w/${E2E_WORKSPACE_SLUG}`, { waitUntil: "networkidle" });
    const url = page.url();
    if (!url.includes(`/w/${E2E_WORKSPACE_SLUG}`)) {
      const screenshot = path.join(DIAG_DIR, "auth-verify-failed.png");
      const html = path.join(DIAG_DIR, "auth-verify-failed.html");
      await page.screenshot({ path: screenshot, fullPage: true });
      fs.writeFileSync(html, await page.content());
      throw new Error(
        `Auth verification failed: expected to be on /w/${E2E_WORKSPACE_SLUG}, ` +
          `actually on ${url}. Diagnostics saved to ${screenshot}, ${html}.`,
      );
    }
    log("auth verified — landed on", url);

    const cookies = await context.cookies();
    log("cookies snapshotted:", cookies.map((c) => c.name).join(", ") || "(none)");

    await context.storageState({ path: AUTH_STORAGE_PATH });
    log("storage state saved to", AUTH_STORAGE_PATH);
  } catch (err) {
    // On any failure, save a screenshot + DOM dump so CI artifacts have
    // something to look at beyond the bare timeout message.
    try {
      const screenshot = path.join(DIAG_DIR, "global-setup-failed.png");
      const html = path.join(DIAG_DIR, "global-setup-failed.html");
      await page.screenshot({ path: screenshot, fullPage: true });
      fs.writeFileSync(html, await page.content());
      log("failure diagnostics saved to", screenshot, "and", html);
      log("final URL:", page.url());
    } catch (diagErr) {
      log("failed to capture diagnostics:", (diagErr as Error).message);
    }
    throw err;
  } finally {
    await browser.close();
  }
}
