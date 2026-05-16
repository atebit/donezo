/**
 * E2E spec: invitation acceptance — downstream accept redirect + upstream ?next= chain.
 *
 * Coverage overview
 * =================
 *
 * Test 1 — "downstream accept-redirect" (authenticated invitee cold-path)
 * -----------------------------------------------------------------------
 * Guards the accept() server action's post-accept board redirect (the BONUS
 * introduced in commit 597a871). An authenticated invitee navigates directly
 * to /join/<token>, clicks Accept, and must land on /w/<slug>/b/<boardId>.
 *
 * This test does NOT guard the ?next= propagation chain. A re-broken ?next=
 * chain (lost in sign-up-form, signUpWithEmail, or the callback) would leave
 * this test green. That regression surface is covered by Test 2.
 *
 * Test 2 — "upstream ?next= regression guard" (597a871 regression surface)
 * -------------------------------------------------------------------------
 * Asserts the reachable upstream surfaces of the 597a871 regression without
 * Inbucket/email interception. The chain asserted is:
 *   (a) /sign-up?next=/join/<token> → sign-up form reads next (regression
 *       point 2: sign-up-form.tsx was not reading next from the URL).
 *   (b) /auth/callback?next=/join/<token> → redirects to /join/<token>, not /
 *       (regression point 3 consumer: given emailRedirectTo carried next, the
 *       callback correctly forwards to the join page).
 *   (c) /join/<token> → Accept invitation → /w/<slug>/b/<boardId>
 *       (the full callback→join→accept→board chain).
 *
 * Tracked residual gap (NOT covered here)
 * ----------------------------------------
 * The ONLY 597a871 sub-point not closed by this spec is regression point 3
 * at its SOURCE: whether signUpWithEmail constructs emailRedirectTo =
 * <site>/auth/callback?next=<join> and passes it to supabase.auth.signUp.
 * Asserting this end-to-end requires email interception (Inbucket / Mailpit)
 * to follow the real verification link and observe the redirect chain.
 *
 * This is a TRACKED ITEM, not silently deferred:
 *   - Recommended closure: a Vitest unit test of signUpWithEmail asserting the
 *     emailRedirectTo string it passes to supabase.auth.signUp. This is a
 *     low-cost closure that requires no Inbucket.
 *   - Alternative: wire Inbucket into the e2e harness for a full end-to-end
 *     assertion. Higher cost; the orchestrator should decide.
 *   - It is NOT acceptable to leave this as "separate epic, untracked."
 *
 * Auth fixture pattern
 * --------------------
 * Auth fixture: mirrors global-setup.ts (Slice 4). No global storageState
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
// Override the global storageState for this spec: start unauthenticated.
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

// Escape a string for use inside a RegExp literal.
// Characters with special regex meaning (including hyphens in board/workspace
// IDs) are escaped so they match literally.
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Anchored board URL regex: matches only if the URL ends with the board path.
// This is defense against future IDs that happen to contain regex metacharacters.
const EXPECTED_BOARD_URL_RE = new RegExp(
  `/w/${escapeRegExp(E2E_WORKSPACE_SLUG)}/b/${escapeRegExp(E2E_BOARD_ID)}$`,
);

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
// Shared helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Look up an auth user by email using admin.listUsers with a large page to
 * avoid silently missing the user when there are more than the default page
 * size (50) of users in the database.
 *
 * Throws a clear error if the user is not found so the caller never proceeds
 * with an undefined inviteeAuthUser.
 */
async function findUserByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string; email: string | undefined }> {
  const { data: listData, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    throw new Error(`[invitation-accept.spec] listUsers failed: ${error.message}`);
  }
  const found = listData?.users?.find((u) => u.email === email);
  if (!found) {
    throw new Error(
      `[invitation-accept.spec] Could not find user with email "${email}" after createUser. ` +
        `Total users returned: ${listData?.users?.length ?? 0}.`,
    );
  }
  return { id: found.id, email: found.email };
}

/**
 * Mint a @supabase/ssr session cookie for the given credentials and inject
 * it into the Playwright page context.
 */
async function mintSessionCookie(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<void> {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInErr || !signInData.session) {
    throw new Error(
      `[invitation-accept.spec] signInWithPassword failed: ${
        signInErr?.message ?? "no session returned"
      }`,
    );
  }

  const session = signInData.session;
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
}

// ---------------------------------------------------------------------------
// Describe block: authenticated invitee downstream accept-redirect
// ---------------------------------------------------------------------------

test.describe("invitation accept — authenticated invitee (downstream accept redirect)", () => {
  /**
   * Seed the invitee user + invitation row before each test.
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

    // ── 1. Create invitee user (email_confirm: true = no email send) ─────────
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

    // ── 2. Look up the auto-assigned user_id for cleanup reference ───────────
    // Use paginated listUsers (perPage: 1000) to avoid the default-50 cap
    // silently missing the invitee when the test DB grows beyond 50 users.
    const inviteeAuthUser = await findUserByEmail(adminClient, INVITEE_EMAIL);

    // ── 3. Seed invitation row via service-role (bypasses RLS) ───────────────
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

  test("invitee navigates directly to join page and lands on the invited board after accepting", async ({
    page,
  }) => {
    // ── Guards ───────────────────────────────────────────────────────────────
    if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      test.skip(
        true,
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — " +
          "run `supabase start` and export local credentials before running e2e tests.",
      );
      return;
    }

    // ── Step 1: Sign in as the invitee via Supabase REST (no browser UI) ────
    // Same approach as global-setup.ts: signInWithPassword produces an access
    // token without going through the Google OAuth or email-password form UI.
    await mintSessionCookie(page, INVITEE_EMAIL, INVITEE_PASSWORD);

    // ── Step 2: Navigate to the join page (simulates post-callback landing) ──
    // In production: /auth/callback?code=<code>&next=/join/<token> exchanges
    // the code, writes the session cookie, then redirects to /join/<token>.
    // We skip the code-exchange step because we already minted the session
    // cookie above. The join page itself does not depend on how the user
    // arrived — it reads auth.uid() from the session cookie.
    await page.goto(`/join/${INVITATION_TOKEN}`, {
      waitUntil: "networkidle",
    });

    // ── Step 3: Assert the join page rendered the active-invitation state ───
    // Heading text from page.tsx: "You've been invited"
    await expect(page.getByRole("heading", { name: /You've been invited/i })).toBeVisible({
      timeout: 10_000,
    });

    // ── Step 4: Click Accept invitation ─────────────────────────────────────
    await page.getByRole("button", { name: /Accept invitation/i }).click();

    // ── Step 5: Assert landing on the invited board ──────────────────────────
    // This guards accept()'s post-accept board redirect (the 597a871 bonus):
    // after acceptance the user must land on /w/<workspace_slug>/b/<board_id>,
    // not on / (workspace selector / onboarding).
    await expect(page).toHaveURL(EXPECTED_BOARD_URL_RE, {
      timeout: 15_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Describe block: upstream ?next= regression guard (597a871 regression surface)
// ---------------------------------------------------------------------------

test.describe("invitation accept — upstream ?next= regression guard (597a871)", () => {
  test.beforeEach(async () => {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create invitee user if not already present.
    const { error: createErr } = await adminClient.auth.admin.createUser({
      user_metadata: { display_name: INVITEE_NAME },
      email: INVITEE_EMAIL,
      password: INVITEE_PASSWORD,
      email_confirm: true,
    });

    if (
      createErr &&
      !createErr.message.toLowerCase().includes("already") &&
      !createErr.message.toLowerCase().includes("exists") &&
      !createErr.message.toLowerCase().includes("registered")
    ) {
      throw new Error(`[invitation-accept.spec] admin.createUser failed: ${createErr.message}`);
    }

    // Look up user ID (paginated to avoid the 50-user default cap).
    const inviteeAuthUser = await findUserByEmail(adminClient, INVITEE_EMAIL);

    // Seed invitation row.
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
          expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (invErr) {
      throw new Error(`[invitation-accept.spec] invitation upsert failed: ${invErr.message}`);
    }

    await adminClient.from("invitation").update({ accepted_at: null }).eq("id", INVITATION_ID);

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

  test("sign-up page parses next from URL; callback?next= redirects to join; accept lands on board", async ({
    page,
  }) => {
    // ── Guards ───────────────────────────────────────────────────────────────
    if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      test.skip(
        true,
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set — " +
          "run `supabase start` and export local credentials before running e2e tests.",
      );
      return;
    }

    const joinPath = `/join/${INVITATION_TOKEN}`;
    const encodedJoinPath = encodeURIComponent(joinPath);

    // ────────────────────────────────────────────────────────────────────────
    // Part A: sign-up form reads and forwards `next` (regression point 2)
    //
    // 597a871 fixed: sign-up-form.tsx was not reading `next` from the URL.
    // The sign-in→sign-up link (sign-in-form.tsx) also lacked `next`, but
    // that link is currently commented out (Google-only sign-in, commit
    // 4f22605). We assert sign-up-form.tsx directly via navigation.
    //
    // Note: the sign-in→sign-up link (regression point 1) is NOT assertable
    // here because it is commented out in sign-in-form.tsx (Google-only mode,
    // commit 4f22605). This is a deliberate user decision; do NOT un-comment.
    // ────────────────────────────────────────────────────────────────────────

    // Navigate to sign-up with next param (unauthenticated — storageState at
    // top of file resets to empty cookies for every test in this file).
    await page.goto(`/sign-up?next=${encodedJoinPath}`);

    // Assert the sign-up form rendered (heading from sign-up-form.tsx:67).
    await expect(page.getByRole("heading", { name: /Create an account/i })).toBeVisible({
      timeout: 10_000,
    });

    // Assert the "Sign in" link carries next — this proves sign-up-form.tsx
    // read the `next` param and forwarded it (sign-up-form.tsx:149-153:
    // href={next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`}).
    const signInLink = page.getByRole("link", { name: /Sign in/i });
    await expect(signInLink).toBeVisible({ timeout: 5_000 });
    const signInHref = await signInLink.getAttribute("href");
    // The href must contain the encoded join path as the next param value.
    // encodeURIComponent("/join/e2e-epic02-invite-token-abc123") = %2Fjoin%2Fe2e-epic02-invite-token-abc123
    const expectedNextFragment = `next=${encodeURIComponent(joinPath)}`;
    if (!signInHref?.includes(expectedNextFragment)) {
      throw new Error(
        `[invitation-accept.spec] sign-up "Sign in" link does not carry next param.\n` +
          `Expected href to contain: "${expectedNextFragment}"\n` +
          `Actual href: "${signInHref}"`,
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Part B: /auth/callback?next=/join/<token> → redirects to /join/<token>
    //
    // 597a871 fixed: signUpWithEmail now threads next into emailRedirectTo so
    // Supabase bakes /auth/callback?next=/join/<token> into the verification
    // email. The callback (app/auth/callback/route.ts) already honored next
    // before the fix — this assertion covers the CONSUMER of emailRedirectTo:
    // given the callback receives next, does it forward correctly?
    //
    // The callback route redirects to `next` regardless of whether `code` is
    // present (it only calls exchangeCodeForSession when code exists, then
    // always redirects). So we can assert the redirect directly by navigation.
    //
    // We need an authenticated session to get past /join/<token>'s auth check.
    // Mint the session cookie before navigating to the callback URL.
    // ────────────────────────────────────────────────────────────────────────

    await mintSessionCookie(page, INVITEE_EMAIL, INVITEE_PASSWORD);

    // Navigate to /auth/callback?next=/join/<token> — simulates arriving from
    // the verification email link (which Supabase constructs using emailRedirectTo).
    // The callback has no `code` here so exchangeCodeForSession is skipped;
    // it still redirects to next.
    await page.goto(`/auth/callback?next=${encodedJoinPath}`, {
      waitUntil: "networkidle",
    });

    // Assert we landed on the join page, NOT on / (the regression: before
    // 597a871, the callback received no next and redirected to /).
    await expect(page).toHaveURL(new RegExp(escapeRegExp(joinPath)), {
      timeout: 10_000,
    });

    // ────────────────────────────────────────────────────────────────────────
    // Part C: join page → Accept invitation → land on the invited board
    //
    // Continues from the /join/<token> landing reached in Part B.
    // This chains callback → join → accept → board in one flow, distinct
    // from Test 1 which short-circuits straight to /join.
    // ────────────────────────────────────────────────────────────────────────

    // Assert the join page active-invitation state.
    await expect(page.getByRole("heading", { name: /You've been invited/i })).toBeVisible({
      timeout: 10_000,
    });

    // Click Accept invitation.
    await page.getByRole("button", { name: /Accept invitation/i }).click();

    // Assert landing on the invited board.
    await expect(page).toHaveURL(EXPECTED_BOARD_URL_RE, {
      timeout: 15_000,
    });
  });
});
