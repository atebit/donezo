/**
 * Playwright global setup — runs once before all specs.
 *
 * Strategy: mint an authenticated session via the Supabase admin API
 * (service-role `auth.admin.createUser` + `auth.signInWithPassword`),
 * then write the resulting session into the `@supabase/ssr` cookie format
 * directly into `tests/e2e/.auth/user.json`. Subsequent specs inherit
 * this via `use: { storageState }` so no per-test sign-in is needed.
 *
 * Why admin-API minting?
 * ----------------------
 * The app's sign-in page was reduced to Google-only OAuth in commit
 * `4f22605` (2026-05-15). The old global-setup filled an
 * email/password form that no longer exists; this replacement must
 * NOT depend on that form ever coming back.
 *
 * Approach (no browser navigation required for auth):
 *   1. Use the service-role client (`SUPABASE_SERVICE_ROLE_KEY`) to
 *      call `auth.admin.createUser` — creates the E2E user with
 *      `email_confirm: true` so they are immediately active, bypassing
 *      any auth-provider gating.  Idempotent: if the user exists the
 *      call returns the existing user.
 *   2. Use a fresh anon client to call `auth.signInWithPassword` —
 *      hitting the Supabase REST endpoint directly, not the app UI.
 *      This produces a `Session` with `access_token` + `refresh_token`.
 *   3. Encode the session into the `@supabase/ssr` cookie format
 *      (`base64-<base64url-encoded JSON>`, chunked at 3 180 encoded
 *      chars if needed) and write a Playwright storage-state JSON to
 *      `tests/e2e/.auth/user.json`.
 *   4. Launch a Chromium browser, load the storage state, navigate to
 *      `/w/<slug>` to verify the cookies are accepted by the Next.js
 *      middleware, then save the final storage state (which may contain
 *      a refreshed token written by `updateSession`).
 *
 * The seed user (supabase/seed.sql E2E section) must exist in the DB
 * when this runs; the CI workflow runs `supabase db reset --local --yes`
 * before Playwright starts, so this is guaranteed.
 *
 * Cookie name derivation (mirrors supabase-js internals):
 *   `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
 *   e.g. for http://127.0.0.1:54321 → `sb-127-auth-token`
 *
 * Chunking (mirrors @supabase/ssr internals):
 *   If the base64url-encoded value exceeds 3 180 URL-encoded chars the
 *   cookie is split into `<name>.0`, `<name>.1`, … All chunks are
 *   written to the storage state.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const E2E_USER_EMAIL = "e2e-user@donezo.test";
const E2E_USER_PASSWORD = "e2e-test-password-12345";
const E2E_WORKSPACE_SLUG = "e2e-workspace";

const AUTH_STORAGE_DIR = path.join(__dirname, ".auth");
const AUTH_STORAGE_PATH = path.join(AUTH_STORAGE_DIR, "user.json");
const DIAG_DIR = path.join(__dirname, ".diag");

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Max encoded cookie chunk size — matches @supabase/ssr MAX_CHUNK_SIZE */
const MAX_CHUNK_SIZE = 3180;
const BASE64_PREFIX = "base64-";

function log(...args: unknown[]): void {
  // biome-ignore lint/suspicious/noConsole: setup script output is intentional
  console.log("[global-setup]", ...args);
}

// ---------------------------------------------------------------------------
// Cookie-encoding helpers (mirrors @supabase/ssr internals)
// ---------------------------------------------------------------------------

/**
 * Encode a string to base64url using Node.js Buffer (same algorithm as the
 * @supabase/ssr base64url.js implementation but using Node native APIs).
 */
function toBase64URL(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Encode a session value for use in an @supabase/ssr cookie.
 * Returns the raw string prefixed with "base64-".
 */
function encodeSessionValue(sessionJson: string): string {
  return BASE64_PREFIX + toBase64URL(sessionJson);
}

interface CookiePair {
  name: string;
  value: string;
}

/**
 * Split an encoded session value into cookie chunks, matching @supabase/ssr's
 * createChunks logic (splits on URL-encoded boundaries at MAX_CHUNK_SIZE).
 * If the value is short enough, returns a single cookie.
 */
function createChunks(cookieName: string, encodedValue: string): CookiePair[] {
  const urlEncoded = encodeURIComponent(encodedValue);
  if (urlEncoded.length <= MAX_CHUNK_SIZE) {
    return [{ name: cookieName, value: encodedValue }];
  }

  const chunks: CookiePair[] = [];
  let remaining = urlEncoded;
  let index = 0;

  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE);
    // Don't truncate a %-escape sequence mid-way
    const lastEscapePos = head.lastIndexOf("%");
    if (lastEscapePos > MAX_CHUNK_SIZE - 3) {
      head = head.slice(0, lastEscapePos);
    }
    chunks.push({
      name: index === 0 ? `${cookieName}.0` : `${cookieName}.${index}`,
      value: decodeURIComponent(head),
    });
    remaining = remaining.slice(head.length);
    index++;
  }

  return chunks;
}

/**
 * Derive the @supabase/ssr storage-key (= base cookie name) from the
 * Supabase project URL. Mirrors the supabase-js defaultStorageKey logic:
 *   `sb-${hostname.split('.')[0]}-auth-token`
 */
function deriveStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

// ---------------------------------------------------------------------------
// Storage state builder
// ---------------------------------------------------------------------------

interface StorageStateCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

interface StorageState {
  cookies: StorageStateCookie[];
  origins: unknown[];
}

function buildStorageState(
  cookiePairs: CookiePair[],
  domain: string,
  expiresAt: number,
): StorageState {
  return {
    cookies: cookiePairs.map(({ name, value }) => ({
      name,
      value,
      domain,
      path: "/",
      expires: expiresAt,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
    origins: [],
  };
}

// ---------------------------------------------------------------------------
// Main setup
// ---------------------------------------------------------------------------

// biome-ignore lint/style/noDefaultExport: Playwright globalSetup requires a default export
export default async function globalSetup() {
  fs.mkdirSync(AUTH_STORAGE_DIR, { recursive: true });
  fs.mkdirSync(DIAG_DIR, { recursive: true });

  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "[global-setup] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. " +
        "Run `supabase start` and export the local credentials before running Playwright.",
    );
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[global-setup] SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "The CI workflow exports this from `supabase status -o env`. " +
        "Locally, run: export SUPABASE_SERVICE_ROLE_KEY=$(supabase status | grep 'service_role key' | awk '{print $NF}')",
    );
  }

  // Step 1 — Ensure the E2E user exists via the admin API.
  // `email_confirm: true` marks the email as confirmed immediately, bypassing
  // any auth-provider email-confirmation flow.
  //
  // When the DB was seeded via `supabase db reset --local --yes` (which applies
  // seed.sql), the user already exists with id eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
  // and an encrypted_password set. In that case `createUser` will return a
  // "user already exists" / "already registered" style error — which we treat
  // as success and proceed. The subsequent signInWithPassword succeeds because
  // the seeded encrypted_password matches E2E_USER_PASSWORD.
  log("ensuring E2E user exists via admin API …");
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminUserData, error: createUserErr } = await adminClient.auth.admin.createUser({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
    email_confirm: true,
  });

  // GoTrue returns various messages for duplicate users. Accept any error that
  // implies the user exists; only hard-fail on truly unexpected errors.
  const isUserExistsError =
    createUserErr &&
    (createUserErr.message.toLowerCase().includes("already") ||
      createUserErr.message.toLowerCase().includes("exists") ||
      createUserErr.message.toLowerCase().includes("registered"));
  if (createUserErr && !isUserExistsError) {
    throw new Error(
      `[global-setup] admin.createUser failed unexpectedly: ${createUserErr.message}`,
    );
  }
  log("E2E user ready:", adminUserData?.user?.id ?? "(already existed — seed.sql user)");

  // Step 2 — Sign in with email/password against the Supabase auth endpoint
  // directly (not the app's UI form). This is a Node.js HTTP call; it does not
  // depend on the sign-in page UI or any auth-provider UI setting. It produces
  // a session with access_token + refresh_token.
  log("minting session via signInWithPassword …");
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
  });

  if (signInErr || !signInData.session) {
    throw new Error(
      `[global-setup] signInWithPassword failed: ${signInErr?.message ?? "no session returned"}`,
    );
  }

  const session = signInData.session;
  log("session minted, user:", session.user.id, "expires_at:", session.expires_at);

  // Step 3 — Encode the session into the @supabase/ssr cookie format and
  // write an initial storage state. The format is:
  //   cookie name:  sb-<project_ref>-auth-token  (+ .0/.1/… chunks if large)
  //   cookie value: base64-<base64url(JSON.stringify(session))>
  //
  // This mirrors what @supabase/ssr's createBrowserClient writes when
  // cookieEncoding === "base64url" (the default since @supabase/ssr 0.5).
  const sessionJson = JSON.stringify(session);
  const encodedValue = encodeSessionValue(sessionJson);
  const cookieName = deriveStorageKey(SUPABASE_URL);
  const cookiePairs = createChunks(cookieName, encodedValue);

  log(`cookie key: ${cookieName}, chunks: ${cookiePairs.length}`);
  for (const { name } of cookiePairs) {
    log(`  chunk: ${name}`);
  }

  const appUrlHostname = new URL(BASE_URL).hostname;
  // expires_at is in seconds; Playwright cookies use seconds-since-epoch too
  const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
  const initialState = buildStorageState(cookiePairs, appUrlHostname, expiresAt);
  fs.writeFileSync(AUTH_STORAGE_PATH, JSON.stringify(initialState, null, 2));
  log("initial storage state written to", AUTH_STORAGE_PATH);

  // Step 4 — Verify that the minted cookies are accepted by the app's
  // middleware. Launch a browser with the storage state, navigate to the
  // seeded workspace, and assert we land there (not bounced to /sign-in).
  // This also allows updateSession (middleware) to refresh the cookie and
  // write a potentially updated version back to the storage state file.
  log("verifying auth via browser navigation …");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: AUTH_STORAGE_PATH,
  });
  const page = await context.newPage();

  page.on("console", (msg) => log(`page.console.${msg.type()}:`, msg.text()));
  page.on("pageerror", (err) => log("page.error:", err.message));
  page.on("requestfailed", (req) =>
    log("page.requestfailed:", req.url(), req.failure()?.errorText ?? "(unknown)"),
  );

  try {
    log("navigating to /w/", E2E_WORKSPACE_SLUG);
    await page.goto(`/w/${E2E_WORKSPACE_SLUG}`, { waitUntil: "networkidle" });

    const url = page.url();
    if (!url.includes(`/w/${E2E_WORKSPACE_SLUG}`)) {
      const screenshot = path.join(DIAG_DIR, "auth-verify-failed.png");
      const html = path.join(DIAG_DIR, "auth-verify-failed.html");
      await page.screenshot({ path: screenshot, fullPage: true });
      fs.writeFileSync(html, await page.content());
      throw new Error(
        `[global-setup] Auth verification failed: expected to be on /w/${E2E_WORKSPACE_SLUG}, ` +
          `actually on ${url}. ` +
          `Diagnostics saved to ${screenshot} and ${html}. ` +
          `If the middleware rejected the session cookies, check that the cookie encoding ` +
          `(base64url) matches what @supabase/ssr expects. This is an escalation point per ` +
          `the Slice 4 spec: stop and report the cookie/middleware mismatch.`,
      );
    }
    log("auth verified — landed on", url);

    const cookies = await context.cookies();
    log("cookies in context:", cookies.map((c) => c.name).join(", ") || "(none)");

    // Save the final state (middleware may have refreshed the token).
    await context.storageState({ path: AUTH_STORAGE_PATH });
    log("final storage state saved to", AUTH_STORAGE_PATH);
  } catch (err) {
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
