import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_TASK_1_ID, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

/**
 * Epic 09 — Comments, Activity Log, and Mentions — E2E spec.
 *
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config
 * with two browser contexts (two authenticated users) pointed at a local
 * Supabase stack (`pnpm supabase start && pnpm dev`).
 *
 * Mirrors the Epic 08 e2e pattern (08-realtime.spec.ts).
 *
 * TODO (epic 15):
 *  - Seed two users (USER_A, USER_B) as board members in the Supabase test DB.
 *  - Seed at least one task (TASK_ID_T1) in board BOARD_ID.
 *  - Configure `playwright.config.ts` with `baseURL` and two `storageState` files.
 *  - Replace placeholder constants below with seed-script output.
 *  - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e`.
 */

// ---------------------------------------------------------------------------
// Constants — seeded via supabase/seed.sql e2e section
// ---------------------------------------------------------------------------
const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const BOARD_ID = E2E_BOARD_ID;
const BOARD_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;
const TASK_ID_T1 = E2E_TASK_1_ID;

// Second user — requires a dedicated storageState fixture (follow-up work)
// See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
const _USER_B_EMAIL = "user-b+e2e@donezo.local";
const _USER_B_PASSWORD = "test-password-12345";
const _USER_B_ID = "REPLACE_WITH_SEED_USER_B_ID";

// ---------------------------------------------------------------------------
// Helper — kept for future multi-user tests; currently unused
// ---------------------------------------------------------------------------
async function _signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/w/**");
}

// ---------------------------------------------------------------------------
// Suite
// All tests in this suite require two authenticated browser contexts (two users).
// Marked test.fixme until a second-user storageState fixture is wired.
// See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
// ---------------------------------------------------------------------------

test.describe("Epic 09 — Comments, Activity Log, and Mentions", () => {
  // ── Test 1: Intercepting route drawer opens ──────────────────────────────
  /**
   * User A clicks "Open task" from the board. The intercepting route fires:
   * the board is still visible in the background, the drawer slides in,
   * and the URL updates to /t/<taskId>.
   */
  test.fixme("1 — task drawer opens via intercepting route; URL updates", async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(BOARD_URL);
    await pageA.waitForSelector(`[data-task-id="${TASK_ID_T1}"]`);

    // Open the task via the overflow menu "Open task" link
    const taskRow = pageA.locator(`[data-task-id="${TASK_ID_T1}"]`);
    await taskRow.hover();
    await taskRow.locator('[aria-label*="Task menu"]').click();
    await pageA.getByRole("link", { name: /open task/i }).click();

    // URL should update; board table still in DOM (intercepting route)
    await pageA.waitForURL(`**/t/${TASK_ID_T1}`);
    await expect(pageA.locator('[data-testid="task-drawer"]')).toBeVisible();
    await expect(pageA.locator('[data-testid="board-table"]')).toBeVisible();

    await contextA.close();
  });

  // ── Test 2: Post comment; other user sees count badge increment ───────────
  /**
   * User A opens the drawer and posts a comment. User B (on the board table)
   * sees the comment count badge for the task increment within 1500ms via Realtime.
   */
  test.fixme("2 — User A posts comment; User B sees badge increment", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([
      signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD),
      signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD),
    ]);

    await pageB.goto(BOARD_URL);
    const prevBadge = await pageB
      .locator(`[data-task-id="${TASK_ID_T1}"] [data-testid="comment-count"]`)
      .textContent()
      .catch(() => "0");

    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // Post a comment via the composer
    await pageA.locator(".ProseMirror").first().fill("Hello from user A!");
    await pageA.getByRole("button", { name: /save/i }).click();
    await pageA.waitForSelector('[data-testid="comment-list"] li', { timeout: 3000 });

    // User B sees badge increment within 1500ms
    await pageB.waitForFunction(
      ([taskId, prev]) => {
        const el = document.querySelector(
          `[data-task-id="${taskId}"] [data-testid="comment-count"]`,
        );
        return el && el.textContent !== prev;
      },
      [TASK_ID_T1, prevBadge],
      { timeout: 1500 },
    );

    await contextA.close();
    await contextB.close();
  });

  // ── Test 3: @user mention creates notification row ───────────────────────
  /**
   * User A types @, selects User B from the mention popover, posts the comment.
   * DB check: notification table has a mention row for User B with the correct payload.
   */
  test.fixme("3 — @user mention creates notification row for mentioned user", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // Type @ to open mention popover
    await pageA.locator(".ProseMirror").first().click();
    await pageA.keyboard.type("@");
    await pageA.waitForSelector('[data-testid="mention-popover"]', { timeout: 2000 });

    // Filter and click User B in the popover
    await pageA.keyboard.type(USER_B_EMAIL.split("@")[0] ?? "");
    await pageA.locator('[data-testid="mention-popover"] [data-mention-id]').first().click();

    await pageA.getByRole("button", { name: /save/i }).click();
    await pageA.waitForSelector('[data-testid="comment-list"] li', { timeout: 3000 });

    // TODO epic 15: query the DB via test API to assert notification row exists
    // const { data } = await supabaseAdmin
    //   .from("notification")
    //   .select("*")
    //   .eq("user_id", USER_B_ID)
    //   .eq("kind", "mention")
    //   .order("created_at", { ascending: false })
    //   .limit(1)
    //   .single();
    // expect(data).toBeTruthy();
    // expect(data.payload.task_id).toBe(TASK_ID_T1);

    await contextA.close();
  });

  // ── Test 4: @everyone notifies all board members; dedupes explicit mention ─
  /**
   * User A posts a comment with @everyone. Every board member except User A
   * gets a notification. If User B was explicitly mentioned too, they only
   * get one notification row (deduped).
   */
  test.fixme("4 — @everyone notifies all board members; dedupes explicit @user", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    await pageA.locator(".ProseMirror").first().click();
    await pageA.keyboard.type("@everyone ");
    await pageA.waitForSelector('[data-testid="mention-popover"]', { timeout: 2000 });
    // Select the "Everyone on this board" entry (always first)
    await pageA.keyboard.press("Enter");

    await pageA.getByRole("button", { name: /save/i }).click();

    // TODO epic 15: query DB for all notification rows for this comment and verify:
    // - No row with user_id = USER_A_ID (self-notify excluded)
    // - At least one row with user_id = USER_B_ID
    // - Exactly one row per user (no duplication)

    await contextA.close();
  });

  // ── Test 5: Drawer presence dot ─────────────────────────────────────────
  /**
   * User A opens the task drawer. User B (on the board table) sees a presence
   * dot on the task row indicating someone is viewing it.
   */
  test.fixme("5 — User A in task drawer → User B sees presence dot on task row", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([
      signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD),
      signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD),
    ]);

    await pageB.goto(BOARD_URL);
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // User B should see a presence dot on the task row within 2000ms
    await pageB.waitForSelector(
      `[data-task-id="${TASK_ID_T1}"] [data-testid="task-presence-dot"]`,
      { timeout: 2000 },
    );

    await contextA.close();
    await contextB.close();
  });

  // ── Test 6: Reactions (add, count, toggle) ───────────────────────────────
  /**
   * User A reacts 👍. User B sees chip with count 1.
   * User B reacts 👍 → count 2. User B toggles off → count 1.
   */
  test.fixme("6 — reaction add, count, and toggle", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([
      signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD),
      signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD),
    ]);

    // Both open the drawer
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageB.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');
    await pageB.waitForSelector('[data-testid="task-drawer"]');

    // User A posts a comment first so there's something to react to
    await pageA.locator(".ProseMirror").first().fill("Reacting time!");
    await pageA.getByRole("button", { name: /save/i }).click();
    const commentItem = pageA.locator('[data-testid="comment-item"]').first();
    await commentItem.waitFor({ timeout: 3000 });

    // User A clicks the + to open reaction picker and picks 👍
    await commentItem.locator('[data-testid="reaction-add-btn"]').click();
    await pageA.locator('[data-testid="reaction-picker"]').waitFor({ timeout: 2000 });
    // TODO epic 15: click the 👍 emoji in the frimousse picker
    // await pageA.locator('[data-emoji="👍"]').click();

    // User B sees count = 1 within 1500ms
    // await pageB
    //   .locator('[data-testid="comment-item"] [data-reaction-emoji="👍"]')
    //   .waitFor({ timeout: 1500 });
    // expect(await pageB.locator('[data-reaction-emoji="👍"] [data-count]').textContent()).toBe("1");

    // User B adds the same emoji → count 2
    // User B toggles off → count 1

    await contextA.close();
    await contextB.close();
  });

  // ── Test 7: Edit comment; other user sees "edited" badge ─────────────────
  /**
   * User A edits their comment. User B sees the "edited" badge appear.
   */
  test.fixme("7 — User A edits comment; User B sees 'edited' badge", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([
      signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD),
      signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD),
    ]);

    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageB.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // User A posts a comment
    await pageA.locator(".ProseMirror").first().fill("Original text");
    await pageA.getByRole("button", { name: /save/i }).click();
    await pageA.locator('[data-testid="comment-item"]').first().waitFor({ timeout: 3000 });

    // Artificially wait > 5s so the "edited" badge will appear (isEdited threshold)
    // In real test: use DB admin to set created_at far in the past or use time control

    // User A opens overflow → Edit
    const commentItemA = pageA.locator('[data-testid="comment-item"]').first();
    await commentItemA.locator('[aria-label*="comment menu"]').click();
    await pageA.getByRole("menuitem", { name: /edit/i }).click();

    // Edit and save
    const inlineEditor = commentItemA.locator(".ProseMirror").first();
    await inlineEditor.clear();
    await inlineEditor.fill("Edited text");
    await commentItemA.getByRole("button", { name: /save/i }).click();

    // User B should see "edited" badge
    await pageB
      .locator('[data-testid="comment-item"] [data-testid="edited-badge"]')
      .waitFor({ timeout: 2000 });

    await contextA.close();
    await contextB.close();
  });

  // ── Test 8: Delete comment; other user sees row vanish ───────────────────
  /**
   * User A deletes their comment (hard delete per Q2). User B sees the row vanish.
   */
  test.fixme("8 — User A deletes comment; User B sees it vanish (hard delete)", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await Promise.all([
      signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD),
      signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD),
    ]);

    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageB.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // User A posts then deletes
    await pageA.locator(".ProseMirror").first().fill("About to be deleted");
    await pageA.getByRole("button", { name: /save/i }).click();
    await pageA.locator('[data-testid="comment-item"]').first().waitFor({ timeout: 3000 });

    const commentItemA = pageA.locator('[data-testid="comment-item"]').first();
    await commentItemA.locator('[aria-label*="comment menu"]').click();
    await pageA.getByRole("menuitem", { name: /delete/i }).click();
    await pageA.getByRole("button", { name: /confirm|delete/i }).click();

    // No [deleted] placeholder (Q2). Row vanishes for User B within 1500ms.
    await pageB.waitForFunction(
      () => document.querySelectorAll('[data-testid="comment-item"]').length === 0,
      { timeout: 1500 },
    );

    await contextA.close();
    await contextB.close();
  });

  // ── Test 9: Reply → quote-reply in composer ──────────────────────────────
  /**
   * User A clicks Reply on User B's comment. Composer is focused and contains
   * a blockquote of User B's content. User A types and posts; new comment
   * renders with the quote at the top + User A's text below.
   */
  test.fixme("9 — Reply opens composer with blockquote; post renders quote + reply", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // Verify at least one comment exists (from previous tests or fixture)
    const commentItem = pageA.locator('[data-testid="comment-item"]').first();
    await commentItem.waitFor({ timeout: 3000 });

    // Click Reply
    await commentItem.locator('[data-testid="reply-btn"]').click();

    // Composer should be focused and contain a blockquote
    const composer = pageA.locator(".comment-composer .ProseMirror").first();
    await expect(composer).toBeFocused();
    await expect(composer.locator("blockquote")).toBeVisible();

    // User A types a reply
    await pageA.keyboard.type("My reply text");
    await pageA.getByRole("button", { name: /save/i }).click();

    // New comment renders with blockquote + user A's text
    const lastComment = pageA.locator('[data-testid="comment-item"]').last();
    await expect(lastComment.locator("blockquote")).toBeVisible();
    await expect(lastComment).toContainText("My reply text");

    await contextA.close();
  });

  // ── Test 10: Activity tab shows task history ──────────────────────────────
  /**
   * The Activity tab in the task drawer shows all events for the task in order.
   */
  test.fixme("10 — Activity tab shows per-task event history", async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // Switch to Activity tab
    await pageA.getByRole("tab", { name: /activity/i }).click();

    // Activity list should be visible
    await expect(pageA.locator('[data-testid="activity-list-task"]')).toBeVisible();

    await contextA.close();
  });

  // ── Test 11: Per-board Activity modal — open, paginate, filter ───────────
  /**
   * The board Activity modal opens from the topbar trigger, shows 50 events,
   * "Load more" fetches the next page, and actor filter narrows results.
   */
  test.fixme("11 — Board Activity modal: open, paginate, filter by actor", async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(BOARD_URL);
    await pageA.waitForSelector('[data-testid="board-table"]', { timeout: 5000 });

    // Open board Activity modal via topbar trigger
    await pageA.locator('[aria-label="Board activity"]').click();
    await pageA.waitForSelector('[data-testid="board-activity-modal"]', { timeout: 2000 });

    // Modal shows an activity list
    await expect(pageA.locator('[data-testid="activity-list-board"]')).toBeVisible();

    // TODO epic 15: click "Load more" and verify count increases
    // TODO epic 15: select an actor in the filter and verify list narrows

    await contextA.close();
  });

  // ── Test 12: Esc / back dismisses modal; refresh hits full-page ──────────
  /**
   * Esc key in modal drawer → back to board. Refresh on /t/<id> → full-page route.
   */
  test.fixme("12 — Esc dismisses intercepting drawer; refresh hits full-page route", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await pageA.goto(`${BOARD_URL}`);
    await pageA.waitForSelector(`[data-task-id="${TASK_ID_T1}"]`);

    // Open task via overflow menu link
    const taskRow = pageA.locator(`[data-task-id="${TASK_ID_T1}"]`);
    await taskRow.hover();
    await taskRow.locator('[aria-label*="Task menu"]').click();
    await pageA.getByRole("link", { name: /open task/i }).click();
    await pageA.waitForURL(`**/t/${TASK_ID_T1}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // Esc dismisses the drawer (router.back())
    await pageA.keyboard.press("Escape");
    await pageA.waitForURL(BOARD_URL);
    await expect(pageA.locator('[data-testid="task-drawer"]')).not.toBeVisible();

    // Navigate to task URL and refresh → full-page route (board table NOT in DOM)
    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}`);
    await pageA.reload();
    await pageA.waitForSelector('[data-testid="task-drawer"]');
    // Board table should NOT be in the DOM on full-page route
    await expect(pageA.locator('[data-testid="board-table"]')).not.toBeVisible();

    await contextA.close();
  });

  // ── Test 13: ?comment=<id> scrolls to and highlights that comment ─────────
  /**
   * Navigating to the task URL with ?comment=<id> scrolls to and briefly
   * highlights the target comment.
   */
  test.fixme("13 — ?comment=<id> deep-link scrolls to and highlights the comment", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);

    // Get a comment id from the DB (or use a fixture)
    // TODO epic 15: obtain COMMENT_ID from seed script
    const COMMENT_ID = "REPLACE_WITH_SEED_COMMENT_ID";

    await pageA.goto(`${BOARD_URL}/t/${TASK_ID_T1}?comment=${COMMENT_ID}`);
    await pageA.waitForSelector('[data-testid="task-drawer"]');

    // The targeted comment should be visible and highlighted
    const targetComment = pageA.locator(`#comment-${COMMENT_ID}`);
    await expect(targetComment).toBeVisible();

    // Highlight is the bg class applied for 2s — check it exists at render time
    await expect(targetComment).toHaveClass(/bg-\[color:var\(--color-primary-selected\)\]/);

    await contextA.close();
  });
});
