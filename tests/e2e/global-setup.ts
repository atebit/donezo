/**
 * Playwright global setup — runs once before all specs.
 *
 * Uses the Supabase admin API (service-role key) to ensure the e2e seed user
 * exists in auth.users, then signs in via signInWithPassword and saves the
 * browser storage state (cookies + localStorage) to tests/e2e/.auth/user.json.
 *
 * Subsequent test files inherit this state via `use: { storageState }` in
 * playwright.config.ts — no per-test sign-in required.
 *
 * Prerequisites:
 *   - `supabase start` (or `pnpm supabase start`) must be running.
 *   - `pnpm db:reset` must have been run to apply migrations + seed.sql.
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local
 *     OR default to the local Supabase stack defaults (127.0.0.1:54321 / local key).
 *
 * The seed user credentials are defined in supabase/seed.sql (e2e section).
 * The constants below MUST match that seed exactly.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Seed user constants — must match supabase/seed.sql e2e section
// ---------------------------------------------------------------------------
const E2E_USER_EMAIL = "e2e-user@donezo.test";
const E2E_USER_PASSWORD = "e2e-test-password-12345";

// ---------------------------------------------------------------------------
// Supabase connection — local stack defaults; override via env
// ---------------------------------------------------------------------------
// Local Supabase default API URL (port 54321 per config.toml [api] port)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

// Local Supabase service-role key (stable across resets; from `supabase status`)
// Falls back to the well-known local dev service-role JWT if env is not set.
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // This is the canonical local Supabase service-role key for project_id="donezo".
  // It is NOT a secret — it only works against a local ephemeral instance.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0";

const AUTH_STORAGE_DIR = path.join(__dirname, ".auth");
const AUTH_STORAGE_PATH = path.join(AUTH_STORAGE_DIR, "user.json");

// biome-ignore lint/style/noDefaultExport: Playwright globalSetup requires a default export
export default async function globalSetup() {
  // Ensure the .auth directory exists
  fs.mkdirSync(AUTH_STORAGE_DIR, { recursive: true });

  // Create an admin client (service-role bypasses RLS)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Anon client for sign-in.
  const anon = createClient(
    SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      // Local Supabase anon key (not a secret — local only)
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqHGl6l9V5b-vSTEuIuzBXOSfxLqkYRo4",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Try to sign in first — supabase/seed.sql already inserts the e2e user
  // into auth.users with a bcrypt password hash, so the normal path is
  // sign-in succeeds without needing the admin createUser dance. Fall back
  // to admin.createUser only when sign-in fails (clean DB without seed run).
  let { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
  });

  if (signInError || !session.session) {
    // biome-ignore lint/suspicious/noConsole: setup script output is intentional
    console.log(
      "[global-setup] Initial sign-in failed; creating user via admin API:",
      signInError?.message ?? "no session returned",
    );
    const { error: createErr } = await admin.auth.admin.createUser({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "E2E Test User" },
    });
    // Treat "user already exists" / unique-violation as soft-success — the
    // seed inserted via SQL won the race; retry sign-in regardless of how
    // createUser concluded.
    if (createErr) {
      const msg = createErr.message.toLowerCase();
      const alreadyExists =
        msg.includes("already") || msg.includes("duplicate") || msg.includes("registered");
      if (!alreadyExists) {
        // biome-ignore lint/suspicious/noConsole: setup script output is intentional
        console.warn(`[global-setup] admin.createUser error (will retry sign-in): ${createErr.message}`);
      }
    }
    const retry = await anon.auth.signInWithPassword({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
    });
    session = retry.data;
    signInError = retry.error;
    if (signInError || !session.session) {
      throw new Error(
        `globalSetup: sign-in failed after admin.createUser fallback: ${signInError?.message ?? "no session returned"}`,
      );
    }
  }

  // biome-ignore lint/suspicious/noConsole: setup script output is intentional
  console.log("[global-setup] Signed in as", E2E_USER_EMAIL, "— saving storage state");

  // Launch a browser, set the session cookies, and save storage state.
  // The Next.js app uses Supabase SSR cookies — we set them directly so the
  // browser appears authenticated on first navigation.
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app base URL so cookies are scoped correctly.
  // This will redirect to /sign-in if not authenticated — that's fine;
  // we inject the session cookies below.
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" }).catch(() => {
    // App may not be running during setup on very first run; cookies still get set.
  });

  // Set Supabase auth cookies. The @supabase/ssr package uses these cookie names.
  const { access_token, refresh_token } = session.session;
  await context.addCookies([
    {
      name: "sb-access-token",
      value: access_token,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "sb-refresh-token",
      value: refresh_token,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Save storage state (cookies + localStorage) for use by all specs.
  await context.storageState({ path: AUTH_STORAGE_PATH });
  // biome-ignore lint/suspicious/noConsole: setup script output is intentional
  console.log("[global-setup] Storage state saved to", AUTH_STORAGE_PATH);

  await browser.close();
}
