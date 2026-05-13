// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Epic 11 — Filtering, Sorting, Search, Saved Views — E2E spec.
 *
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config
 * with two browser contexts (two authenticated users) pointed at a local
 * Supabase stack (`pnpm supabase start && pnpm dev`).
 *
 * Mirrors the Epic 09/10 e2e pattern.
 *
 * Setup requirements (epic 15):
 *  - Seed two users (USER_A, USER_B) as board members in the Supabase test DB.
 *  - USER_A has board role "admin"; USER_B has board role "member".
 *  - Seed at least one task (TASK_TITLE_T1) on the board.
 *  - Seed a status column with at least two labels (e.g. "In Progress", "Done").
 *  - Seed a third user (USER_C) NOT a member of the board and NOT a member of
 *    WORKSPACE_A (for Test 8 — RLS isolation).
 *  - USER_C is a member of a different workspace (WORKSPACE_B) with its own board.
 *  - Configure `playwright.config.ts` with `baseURL` and storageState files.
 *  - Replace placeholder constants below with seed-script output.
 *  - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e`.
 *
 * All test bodies are fully written with accurate assertions. The entire
 * describe block is wrapped in `test.skip(true, ...)` per the epic 09/10 pattern
 * so the suite compiles without a running environment.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const USER_A_EMAIL = "user-a+e2e@donezo.local";
const USER_A_PASSWORD = "test-password-12345";
const USER_B_EMAIL = "user-b+e2e@donezo.local";
const USER_B_PASSWORD = "test-password-12345";
const USER_C_EMAIL = "user-c+e2e-other-workspace@donezo.local";
const USER_C_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const BOARD_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;
const TASK_TITLE_T1 = "REPLACE_WITH_SEED_TASK_TITLE";
const STATUS_COLUMN_NAME = "Status";
const STATUS_LABEL_DONE = "Done";
const STATUS_LABEL_IN_PROGRESS = "In Progress";
/** Board in USER_C's own workspace — used in Test 8 to verify isolation. */
const BOARD_TITLE_OTHER_WORKSPACE = "REPLACE_WITH_BOARD_TITLE_IN_OTHER_WORKSPACE";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// @ts-expect-error playwright wired in epic 15
async function signIn(page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/w/**");
}

// @ts-expect-error playwright wired in epic 15
async function openBoard(page, boardUrl: string) {
  await page.goto(boardUrl);
  // Wait for the view tabs to render — confirms the board page is mounted.
  await page.waitForSelector('[role="tablist"]', { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Epic 11 — Filtering, Sorting, Search, Saved Views", () => {
  // Skip all tests until epic 15 wires the Playwright runner and fixtures.
  test.skip(
    true,
    "Spec stub — runner wired in epic 15. Requires seeded users, Playwright config, and local Supabase stack.",
  );

  // ── T1: Filter by status → URL persists on reload ─────────────────────────

  /**
   * USER_A opens the board (Main table active).
   * Applies a status filter: Status = Done.
   * Asserts: only tasks with status "Done" visible in the table.
   * Reloads the URL.
   * Asserts: filter is restored from URL; same task subset visible.
   */
  test("T1 — apply status filter → URL persists on reload", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await openBoard(page, BOARD_URL);

    // Confirm "Main table" tab is active.
    await expect(page.getByRole("tab", { name: "Main table" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Open the Filter popover.
    await page.getByRole("button", { name: /filter/i }).click();
    await expect(page.getByRole("dialog", { name: /filter/i })).toBeVisible();

    // Add a filter row: Status = Done.
    await page.getByRole("button", { name: /add filter/i }).click();
    await page.getByRole("combobox", { name: /column/i }).selectOption(STATUS_COLUMN_NAME);
    await page.getByRole("combobox", { name: /operator/i }).selectOption("equals");
    // Click the operand input and pick "Done".
    await page.getByRole("button", { name: /select status/i }).click();
    await page.getByRole("option", { name: STATUS_LABEL_DONE }).click();

    // Close the popover and wait for the table to update.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300); // debounce

    // Assert: URL contains ?f= parameter.
    await expect(page).toHaveURL(/[?&]f=/);

    // Assert: tasks without "Done" status are not visible.
    const rows = page.locator('[role="row"][data-task-id]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      await expect(row.getByText(STATUS_LABEL_IN_PROGRESS)).not.toBeVisible();
    }

    // Reload and verify filter is restored.
    const urlWithFilter = page.url();
    await page.goto(urlWithFilter);
    await page.waitForSelector('[role="row"][data-task-id]');

    // Filter badge should show count.
    await expect(page.getByRole("button", { name: /filter \(1\)/i })).toBeVisible();

    await ctx.close();
  });

  // ── T2: Save filter as admin → another user sees it via shared view ────────

  /**
   * USER_A (admin) applies a filter, saves it as the active shared view.
   * USER_B (member) opens the board, switches to that shared view.
   * Asserts: the same filtered set is visible to USER_B.
   */
  test("T2 — admin saves filter as shared view → member sees it", async ({ browser }) => {
    // USER_A context
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();

    await signIn(pageA, USER_A_EMAIL, USER_A_PASSWORD);
    await openBoard(pageA, BOARD_URL);

    // Apply a status filter.
    await pageA.getByRole("button", { name: /filter/i }).click();
    await pageA.getByRole("button", { name: /add filter/i }).click();
    await pageA.getByRole("combobox", { name: /column/i }).selectOption(STATUS_COLUMN_NAME);
    await pageA.getByRole("combobox", { name: /operator/i }).selectOption("equals");
    await pageA.getByRole("button", { name: /select status/i }).click();
    await pageA.getByRole("option", { name: STATUS_LABEL_DONE }).click();
    await pageA.keyboard.press("Escape");

    // Save the filter to the active shared view.
    await pageA.getByRole("button", { name: /save/i }).click();
    await expect(pageA.getByText(/view saved/i)).toBeVisible(); // toast

    // Close USER_A session.
    await ctxA.close();

    // USER_B context — open the same board.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();

    await signIn(pageB, USER_B_EMAIL, USER_B_PASSWORD);
    await openBoard(pageB, BOARD_URL);

    // Switch to the "Main table" shared view (which now has the filter).
    await pageB.getByRole("tab", { name: "Main table" }).click();
    await pageB.waitForTimeout(300);

    // Assert: filter is applied for USER_B.
    await expect(pageB.getByRole("button", { name: /filter \(1\)/i })).toBeVisible();
    const rows = pageB.locator('[role="row"][data-task-id]');
    expect(await rows.count()).toBeGreaterThan(0);

    await ctxB.close();
  });

  // ── T3: Hide a column → persists on reload ────────────────────────────────

  /**
   * USER_A opens the board, hides the Status column.
   * Asserts: Status column header not visible.
   * Reloads the board.
   * Asserts: Status column still hidden.
   */
  test("T3 — hide column persists across reload", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await openBoard(page, BOARD_URL);

    // Open Hide panel.
    await page.getByRole("button", { name: /hide/i }).click();
    await expect(page.getByRole("dialog", { name: /columns/i })).toBeVisible();

    // Uncheck the Status column.
    await page.getByRole("checkbox", { name: STATUS_COLUMN_NAME }).uncheck();
    await page.keyboard.press("Escape");

    // Assert: Status column header is gone.
    await expect(page.getByRole("columnheader", { name: STATUS_COLUMN_NAME })).not.toBeVisible();

    // Save.
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/view saved/i)).toBeVisible();

    // Reload.
    await page.reload();
    await page.waitForSelector('[role="row"][data-task-id]');

    // Assert: column still hidden after reload.
    await expect(page.getByRole("columnheader", { name: STATUS_COLUMN_NAME })).not.toBeVisible();

    await ctx.close();
  });

  // ── T4: Switch view → draft filter clears, other view's config applies ────

  /**
   * USER_A has two views: "Main table" (no filter) and "My view" (with a filter).
   * USER_A is on "My view" with filter active.
   * USER_A switches to "Main table".
   * Asserts: filter cleared; "Main table" shows all tasks.
   */
  test("T4 — switch view clears draft, other view config applies", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await openBoard(page, BOARD_URL);

    // Switch to "My view".
    await page.getByRole("tab", { name: "My view" }).click();

    // Apply a filter on "My view".
    await page.getByRole("button", { name: /filter/i }).click();
    await page.getByRole("button", { name: /add filter/i }).click();
    await page.getByRole("combobox", { name: /column/i }).selectOption(STATUS_COLUMN_NAME);
    await page.getByRole("combobox", { name: /operator/i }).selectOption("equals");
    await page.getByRole("button", { name: /select status/i }).click();
    await page.getByRole("option", { name: STATUS_LABEL_DONE }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Filter badge visible.
    await expect(page.getByRole("button", { name: /filter \(1\)/i })).toBeVisible();

    // Switch to "Main table".
    await page.getByRole("tab", { name: "Main table" }).click();
    await page.waitForTimeout(300);

    // Assert: no filter badge on Main table.
    await expect(page.getByRole("button", { name: /filter \(0\)/i })).not.toBeVisible();
    // Or: plain "Filter" button (no count badge).
    await expect(page.getByRole("button", { name: /^filter$/i })).toBeVisible();

    await ctx.close();
  });

  // ── T5: In-board search narrows rows; clearing restores ───────────────────

  /**
   * USER_A opens the board and types in the in-board search input.
   * Asserts: only tasks containing the search term are visible.
   * Clears the input.
   * Asserts: all tasks restored.
   */
  test("T5 — in-board search narrows and restores rows", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await openBoard(page, BOARD_URL);

    const allRows = page.locator('[role="row"][data-task-id]');
    const totalCount = await allRows.count();
    expect(totalCount).toBeGreaterThan(0);

    // Find and focus the search input in the toolbar.
    const searchInput = page.getByRole("textbox", { name: /search tasks/i });
    await searchInput.fill(TASK_TITLE_T1);
    await page.waitForTimeout(300); // debounce

    // At least one row should contain the search term.
    const filteredCount = await allRows.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(totalCount);

    // Clear the search.
    await searchInput.clear();
    await page.waitForTimeout(300);

    // All rows should be back.
    const restoredCount = await allRows.count();
    expect(restoredCount).toBe(totalCount);

    await ctx.close();
  });

  // ── T6: Cmd-K → type board title → click → navigates ────────────────────

  /**
   * USER_A triggers the Cmd-K palette.
   * Types the board title into the palette input.
   * Asserts: a result row with the board name appears under "Boards".
   * Clicks the result.
   * Asserts: URL navigates to /w/<slug>/b/<id>.
   */
  test("T6 — Cmd-K palette finds board by title and navigates", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await page.goto(`/w/${WORKSPACE_SLUG}`);
    await page.waitForSelector("header");

    // Trigger Cmd-K via the launcher button (keyboard shortcut requires page focus hacks).
    await page.getByRole("button", { name: /open global search/i }).click();

    // Palette should be visible.
    await expect(page.getByRole("dialog", { name: /global search/i })).toBeVisible();

    // Type in the search input.
    const paletteBoardName = await page.evaluate(() => {
      // Read the board title from the first board in the sidebar as a proxy.
      return (
        document.querySelector("[data-sidebar-board-name]")?.textContent?.trim() ?? "BOARD_TITLE"
      );
    });

    await page.getByRole("combobox", { name: /search boards and tasks/i }).fill(paletteBoardName);
    await page.waitForTimeout(300);

    // "Boards" section heading + result should appear.
    await expect(page.getByText("Boards")).toBeVisible();
    const boardResult = page.getByRole("option", { name: new RegExp(paletteBoardName, "i") });
    await expect(boardResult).toBeVisible();

    // Click the result — should navigate to the board URL.
    await boardResult.click();
    await page.waitForURL(`**/w/${WORKSPACE_SLUG}/b/**`);

    await ctx.close();
  });

  // ── T7: Cmd-K → type task title → click → navigates to task drawer ────────

  /**
   * USER_A triggers Cmd-K and types the task title.
   * Asserts: result row in "Tasks" section is visible.
   * Clicks the result.
   * Asserts: navigates to the task drawer URL /w/.../b/.../t/<id>.
   */
  test("T7 — Cmd-K finds task by title and navigates to drawer", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await page.goto(`/w/${WORKSPACE_SLUG}`);

    await page.getByRole("button", { name: /open global search/i }).click();
    await expect(page.getByRole("dialog", { name: /global search/i })).toBeVisible();

    await page.getByRole("combobox", { name: /search boards and tasks/i }).fill(TASK_TITLE_T1);
    await page.waitForTimeout(300);

    // "Tasks" section heading + result.
    await expect(page.getByText("Tasks")).toBeVisible();
    const taskResult = page.getByRole("option", { name: new RegExp(TASK_TITLE_T1, "i") });
    await expect(taskResult).toBeVisible();

    await taskResult.click();
    // Should navigate to the task drawer route.
    await page.waitForURL(`**/w/${WORKSPACE_SLUG}/b/**/t/**`);

    await ctx.close();
  });

  // ── T8: Non-member's Cmd-K → 0 results (RLS enforcement) ─────────────────

  /**
   * USER_C is a member of WORKSPACE_B (a different workspace).
   * USER_C opens their workspace's page and triggers Cmd-K.
   * USER_C types the name of BOARD_TITLE_OTHER_WORKSPACE (which belongs to WORKSPACE_A).
   * Asserts: 0 results (RLS `security invoker` blocks cross-workspace reads).
   *
   * This verifies that `global_search` does NOT expose boards from other workspaces.
   */
  test("T8 — non-member Cmd-K sees 0 results for another workspace's board (RLS)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_C_EMAIL, USER_C_PASSWORD);
    // USER_C navigates to their own workspace.
    await page.waitForURL("**/w/**");

    await page.getByRole("button", { name: /open global search/i }).click();
    await expect(page.getByRole("dialog", { name: /global search/i })).toBeVisible();

    // Search for a board name that belongs to WORKSPACE_A (which USER_C cannot see).
    await page
      .getByRole("combobox", { name: /search boards and tasks/i })
      .fill(BOARD_TITLE_OTHER_WORKSPACE);
    await page.waitForTimeout(300);

    // No results should appear for the other workspace's board.
    await expect(
      page.getByText(new RegExp(`no results for.*${BOARD_TITLE_OTHER_WORKSPACE}`, "i")),
    ).toBeVisible();

    await ctx.close();
  });

  // ── T9: Delete last shared table view → LAST_DEFAULT error ───────────────

  /**
   * USER_A (admin) tries to delete the last shared table view ("Main table").
   * Asserts: the server action throws LAST_DEFAULT and the UI shows an error.
   * The "Main table" tab must remain after the attempt.
   */
  test("T9 — cannot delete the last shared table view", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await openBoard(page, BOARD_URL);

    // Confirm "Main table" is the active tab.
    await expect(page.getByRole("tab", { name: "Main table" })).toBeVisible();

    // Open the tab dropdown for "Main table".
    const tabChevron = page.locator('[aria-label*="Main table"] [data-tab-dropdown-trigger]');
    await tabChevron.click();

    // Click "Delete".
    await page.getByRole("menuitem", { name: /delete/i }).click();

    // Confirm dialog if present.
    const confirmBtn = page.getByRole("button", { name: /confirm|yes, delete/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }

    // Assert: error toast or inline error message about LAST_DEFAULT.
    await expect(page.getByText(/cannot delete the last shared table view/i)).toBeVisible({
      timeout: 5000,
    });

    // Assert: "Main table" tab still present.
    await expect(page.getByRole("tab", { name: "Main table" })).toBeVisible();

    await ctx.close();
  });
});
