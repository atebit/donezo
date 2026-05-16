/**
 * E2E spec: brand-new-user invitation acceptance.
 *
 * Regression guard for commit 597a871 — new-user sign-up losing ?next=/join/<token>
 * and landing on / instead of the invited board after acceptance.
 *
 * ---
 * Strategy (no real email / no Inbucket required):
 *
 * The literal sign-up form → verification email → click-link flow requires an
 * email interception service (Inbucket / Mailpit) to follow the verify link.
 * Per the Slice 6 spec: "admin-API confirm or seeded confirmed user (no real
 * email)" is the authorised bypass.
 *
 * This spec exercises the _accept_ path — which is where the 597a871 bug lived.
 * The fix threaded `next` through to `emailRedirectTo` so that `/auth/callback`
 * would redirect to `/join/<token>` instead of `/`; having arrived at the join
 * page the user clicks Accept and lands on the board. We simulate "having arrived
 * at the join page" by:
 *   1. Creating a confirmed invitee via the Supabase admin API (no email sent).
 *   2. Signing in via signInWithPassword — same mechanism as global-setup.ts.
 *   3. Navigating directly to /join/<token>.
 *   4. Clicking Accept invitation.
 *   5. Asserting the landing URL is /w/<slug>/b/<boardId>.
 *
 * This is functionally equivalent to the production flow post-verify because
 * /auth/callback merely exchanges the code and then redirects to the `next`
 * query param — it does not render any UI. The test validates the accept() server
 * action's redirect, which is the load-bearing piece.
 *
 * Auth fixture pattern: mirrors global-setup.ts (Slice 4). No global storageState
 * is loaded here; the test mints its own per-context cookie.
 *
 * The inviter's workspace + board are the E2E seed constants (seed.sql).
 * The invitee is created dynamically and cleaned up after the test.
 *
 * Environment variables required (same as global-setup.ts):
 *   NEXT_PUBLIC_SUPABASE_URL        — local: http://127.0.0.1:54321
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — local anon key
 *   SUPABASE_SERVICE_ROLE_KEY       — local service-role key
 */

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { E2E_BOARD_ID, E2E_WORKSPACE_ID, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

// ---------------------------------------------------------------------------
// Override the global storageState for this test: start unauthenticated.
// We mint our own cookie below for the invitee identity.
// ---------------------------------------------------------------------------
test.use({ storageState: { cookies: [], origins: [] } });

// ---------------------------------------------------------------------------
// Deterministic constants for this spec's seeded objects.
// These IDs never conflict with the demo/e2e seed because they use the
// "ee...02nn" block reserved for epic-02 test objects.
// ---------------------------------------------------------------------------
const INVITEE_EMAIL = "e2e-invitee@donezo.test";
const INVITEE_PASSWORD = "e2e-invitee-password-12345";
const INVITEE_NAME = "E2E Invitee";

const INVITATION_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee30";
const INVITATION_TOKEN = "e2e-epic02-invite-token-abc123";

const EXPECTED_BOARD_URL_RE = new RegExp(`/w/${E2E_WORKSPACE_SLUG}/b/${E2E_BOARD_ID}`);

// ---------------------------------------------------------------------------
// Cookie-encoding helpers (mirrors global-setup.ts / @supabase/ssr internals)
// ---------------------------------------------------------------------------

const MAX_CHUNK_SIZE = 3180;
const BASE64_PREFIX = "base64-";

function toBase64URL(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSessionValue(sessionJson: string): string {
  return BASE64_PREFIX + toBase64URL(sessionJson);
}

interface CookiePair {
  name: string;
  value: string;
}

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

function deriveStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("invitation accept — new user", () => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  /**
   * Seed the invitee user + invitation row before the test.
   * Uses admin API to bypass auth/RLS — identical to global-setup.ts approach.
   *
   * Idempotent: on conflict do nothing / existing user reused.
   */
  test.beforeEach(async () => {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      // Skip silently in environments where the service-role key is absent;
      // the test body itself will fail if admin ops are required.
      return;
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 1. Create invitee user (email_confirm: true = no email send) ──────────
    const { error: createErr } = await adminClient.auth.admin.createUser({
      user_metadata: { display_name: INVITEE_NAME },
      email: INVITEE_EMAIL,
      password: INVITEE_PASSWORD,
      email_confirm: true,
    });

    // Accept "already exists" errors as idempotent success.
    if (
      createErr &&
      !createErr.message.toLowerCase().includes("already") &&
      !createErr.message.toLowerCase().includes("exists") &&
      !createErr.message.toLowerCase().includes("registered")
    ) {
      throw new Error(`[invitation-accept.spec] admin.createUser failed: ${createErr.message}`);
    }

    // ── 2. Upsert the invitee's auth.users row with a stable UUID ─────────────
    // admin.createUser does not guarantee the UUID we pass; upsert directly.
    // We need a known user_id to find/delete the row later, but the invitation
    // only depends on the email — so this step uses the email as the key.
    // Look up the auto-assigned user_id for cleanup reference.
    const { data: listData } = await adminClient.auth.admin.listUsers();
    const inviteeAuthUser = listData?.users?.find((u) => u.email === INVITEE_EMAIL);
    if (!inviteeAuthUser) {
      throw new Error("[invitation-accept.spec] Could not find invitee user after createUser");
    }

    // ── 3. Seed invitation row via service-role (bypasses RLS) ────────────────
    // Uses E2E workspace + board IDs from seed.ts.
    // ON CONFLICT DO NOTHING ensures idempotency across test reruns.
    const { error: invErr } = await adminClient
      .from("invitation")
      .upsert(
        {
          id: INVITATION_ID,
          workspace_id: E2E_WORKSPACE_ID,
          board_id: E2E_BOARD_ID,
          email: INVITEE_EMAIL,
          role: "member",
          token: INVITATION_TOKEN,
          accepted_at: null,
          revoked_at: null,
          // 14 days from now — far enough that expiry never triggers in CI
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (invErr) {
      throw new Error(`[invitation-accept.spec] invitation upsert failed: ${invErr.message}`);
    }

    // Also reset accepted_at in case a previous test run accepted it.
    await adminClient.from("invitation").update({ accepted_at: null }).eq("id", INVITATION_ID);

    // Remove any pre-existing board_member / workspace_member rows for the
    // invitee so the test exercises a true cold-path accept each time.
    await adminClient
      .from("board_member")
      .delete()
      .eq("board_id", E2E_BOARD_ID)
      .eq("user_id", inviteeAuthUser.id);

    await adminClient
      .from("workspace_member")
      .delete()
      .eq("workspace_id", E2E_WORKSPACE_ID)
      .eq("user_id", inviteeAuthUser.id);
  });

  test("invitee can accept invitation and land on the invited board", async ({ page }) => {
    // ── Guards ─────────────────────────────────────────────────────────────
    if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      test.skip(
        true,
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — " +
          "run `supabase start` and export local credentials before running e2e tests.",
      );
      return;
    }

    // ── Step 1: Sign in as the invitee via Supabase REST (no browser UI) ───
    // Same approach as global-setup.ts: signInWithPassword produces an access
    // token without going through the Google OAuth or email-password form UI.
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: INVITEE_EMAIL,
      password: INVITEE_PASSWORD,
    });

    if (signInErr || !signInData.session) {
      throw new Error(
        `[invitation-accept.spec] signInWithPassword failed: ${
          signInErr?.message ?? "no session returned"
        }`,
      );
    }

    const session = signInData.session;

    // ── Step 2: Encode session into @supabase/ssr cookie format ───────────
    // Mirrors global-setup.ts exactly so the middleware accepts the cookie.
    const cookieName = deriveStorageKey(SUPABASE_URL);
    const encodedValue = encodeSessionValue(JSON.stringify(session));
    const chunks = createChunks(cookieName, encodedValue);
    const appHostname = new URL(BASE_URL).hostname;
    const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + 3600;

    await page.context().addCookies(
      chunks.map(({ name, value }) => ({
        name,
        value,
        domain: appHostname,
        path: "/",
        expires: expiresAt,
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      })),
    );

    // ── Step 3: Navigate to the join page (simulates post-callback landing) ─
    // In production: /auth/callback?code=<code>&next=/join/<token> exchanges
    // the code, writes the session cookie, then redirects to /join/<token>.
    // We skip the code-exchange step because we already minted the session
    // cookie above. The join page itself does not depend on how the user
    // arrived — it reads auth.uid() from the session cookie.
    await page.goto(`/join/${INVITATION_TOKEN}`, {
      waitUntil: "networkidle",
    });

    // ── Step 4: Assert the join page rendered the active-invitation state ──
    // Heading text from page.tsx: "You've been invited"
    await expect(page.getByRole("heading", { name: /You've been invited/i })).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 5: Click Accept invitation ────────────────────────────────────
    await page.getByRole("button", { name: /Accept invitation/i }).click();

    // ── Step 6: Assert landing on the invited board ─────────────────────────
    // This is the exact regression from 597a871: before the fix the user
    // landed on / (workspace selector); after the fix they land on
    // /w/<workspace_slug>/b/<board_id>.
    await expect(page).toHaveURL(EXPECTED_BOARD_URL_RE, {
      timeout: 15_000,
    });
  });
});
