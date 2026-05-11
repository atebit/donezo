// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config
 * with two browser contexts (two authenticated users) pointed at a local
 * Supabase stack (`pnpm supabase start && pnpm dev`).
 *
 * TODO (epic 15):
 *  - Seed two users (USER_A and USER_B) with access to the same board in the
 *    Supabase test DB via a setup script.
 *  - Seed at least one group (with tasks t1, t2) and one column (c1) in board B.
 *  - Configure `playwright.config.ts` with `baseURL` and two `storageState` files
 *    (one per user) so sign-in persists without re-logging in.
 *  - Replace placeholder values below with values emitted by the seed script.
 *  - Set `context.setOffline(true)` behavior: confirmed to block websockets.
 *    If Supabase Realtime WS is NOT blocked by setOffline on the CI environment,
 *    use `context.route('**/ realtime; /**', route => route.abort())` as the fallback.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const USER_A_EMAIL = "user-a+e2e@donezo.local";
const USER_A_PASSWORD = "test-password-12345";
const USER_B_EMAIL = "user-b+e2e@donezo.local";
const USER_B_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const BOARD_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;
// Seed task + column ids for cursor/cell tests
const TASK_ID_T1 = "REPLACE_WITH_SEED_TASK_T1";
const COLUMN_ID_C1 = "REPLACE_WITH_SEED_COLUMN_C1";
const CELL_TEST_VALUE = `e2e-val-${Date.now()}`;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Epic 08 — Realtime & Presence", () => {
  // Skip all tests until epic 15 wires the Playwright runner and fixtures.
  test.skip(
    true,
    "Spec stub — runner wired in epic 15. Requires seeded users, Playwright config, and local Supabase stack.",
  );

  // ── Test 1: Live cell edit ────────────────────────────────────────────────
  /**
   * Both users open board B. User A edits cell (t1, c1) to a new value.
   * Within 1500ms User B's DOM reflects that value via Realtime postgres_changes.
   */
  test("1 — live cell edit: User A edits → User B sees update within 1500ms", async ({
    browser,
  }) => {
    // TODO epic 15: use storageState to avoid re-login
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Sign in both users
    for (const [page, email, pwd] of [
      [pageA, USER_A_EMAIL, USER_A_PASSWORD],
      [pageB, USER_B_EMAIL, USER_B_PASSWORD],
    ] as const) {
      await page.goto("/sign-in");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(pwd);
      await page.getByRole("button", { name: /sign in/i }).click();
    }

    // Both navigate to the board
    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    // User A edits the cell (t1, c1) — click the cell to activate the editor
    const cellA = pageA.locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`);
    await cellA.click();
    await pageA.keyboard.type(CELL_TEST_VALUE);
    await pageA.keyboard.press("Enter");

    // User B should see the new value within 1500ms (Realtime postgres_changes)
    await expect
      .poll(
        async () => {
          const cellB = pageB.locator(
            `[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`,
          );
          return cellB.textContent();
        },
        { timeout: 1500, intervals: [100] },
      )
      .toContain(CELL_TEST_VALUE);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 2: Live task add ─────────────────────────────────────────────────
  /**
   * User A adds a task via AddTaskFooter. User B sees the task appear within
   * 1500ms via Realtime postgres_changes on the `task` table.
   */
  test("2 — live task add: User A adds task → User B sees it within 1500ms", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    const newTaskName = `Realtime task ${Date.now()}`;

    // User A adds a task
    await pageA
      .getByRole("button", { name: /add task/i })
      .first()
      .click();
    await pageA.getByRole("textbox", { name: /task title/i }).fill(newTaskName);
    await pageA.keyboard.press("Enter");

    // User B should see the new task appear within 1500ms
    await expect
      .poll(
        async () => {
          return pageB.getByText(newTaskName).isVisible();
        },
        { timeout: 1500, intervals: [100] },
      )
      .toBe(true);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 3: Presence pile ─────────────────────────────────────────────────
  /**
   * Both users on the board → each sees 1 avatar (the other user) in PresencePile.
   * User A navigates away → User B's pile shows 0 other users.
   */
  test("3 — presence pile: both users see each other; pile updates on navigate away", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    // Each user should see exactly 1 avatar in the PresencePile (the other user).
    // PresencePile excludes the current user; 2 users total means each sees 1.
    const presencePileA = pageA.locator("[data-testid='presence-pile']");
    const presencePileB = pageB.locator("[data-testid='presence-pile']");

    await expect
      .poll(async () => presencePileA.locator("[data-testid='presence-avatar']").count(), {
        timeout: 3000,
      })
      .toBe(1);

    await expect
      .poll(async () => presencePileB.locator("[data-testid='presence-avatar']").count(), {
        timeout: 3000,
      })
      .toBe(1);

    // User A navigates away from the board
    await pageA.goto("/");

    // User B's pile should update to 0 other users within 5s
    await expect
      .poll(async () => presencePileB.locator("[data-testid='presence-avatar']").count(), {
        timeout: 5000,
        intervals: [200],
      })
      .toBe(0);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 4: Connection status ─────────────────────────────────────────────
  /**
   * Force User A offline → the reconnecting/offline pill appears in A's topbar
   * within 5s. Restore online → pill disappears within 10s; User A sees B's
   * edit made while A was offline (router.refresh() re-fetches RSC).
   */
  test("4 — connection status: offline pill appears; reconnect syncs missed edits", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    // Force User A offline — this blocks WebSocket connections to Supabase Realtime
    await contextA.setOffline(true);

    // The reconnecting/offline pill should appear in A's topbar within 5s
    const connectionPill = pageA.locator("[data-testid='connection-status']");
    await expect
      .poll(async () => connectionPill.isVisible(), { timeout: 5000, intervals: [200] })
      .toBe(true);

    // User B edits a cell while User A is offline
    const offlineTestValue = `offline-val-${Date.now()}`;
    const cellB = pageB.locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`);
    await cellB.click();
    await pageB.keyboard.type(offlineTestValue);
    await pageB.keyboard.press("Enter");

    // Restore User A online
    await contextA.setOffline(false);

    // Connection pill should disappear within 10s (reconnect + router.refresh())
    await expect
      .poll(async () => connectionPill.isVisible(), { timeout: 10000, intervals: [500] })
      .toBe(false);

    // User A should now see the value User B wrote while A was offline
    // (router.refresh() rehydrates the RSC tree which re-fetches DB data)
    await expect
      .poll(
        async () => {
          const cellA = pageA.locator(
            `[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`,
          );
          return cellA.textContent();
        },
        { timeout: 5000, intervals: [200] },
      )
      .toContain(offlineTestValue);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 5: Cursor dot ────────────────────────────────────────────────────
  /**
   * User A hovers cell (t1, c1). Within 500ms User B sees a colored dot in
   * that cell (rendered by CursorOverlay).
   */
  test("5 — cursor dot: User A hover → User B sees colored dot within 500ms", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    // User A hovers over the cell — triggers useCursorBroadcast.emit()
    const cellA = pageA.locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`);
    await cellA.hover();

    // User B should see a cursor dot inside that cell within 500ms
    // CursorOverlay renders role="presentation" wrapper with a colored dot
    const cursorDotInB = pageB
      .locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`)
      .locator("[data-testid='cursor-dot']");

    await expect
      .poll(async () => cursorDotInB.count(), { timeout: 500, intervals: [50] })
      .toBeGreaterThan(0);

    await contextA.close();
    await contextB.close();
  });
});
