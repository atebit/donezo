// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config.
 *
 * TODO (epic 15):
 *  - Seed a primary user (owner) and at least one board in the Supabase test DB
 *    via pgTAP fixtures or a setup script.
 *  - Configure `playwright.config.ts` with baseURL pointing to the local dev
 *    server (or Vercel preview URL in CI).
 *  - Wire `test.use({ storageState })` so sign-in persists across tests in the
 *    same describe block (avoids re-logging in for every test).
 *  - Replace placeholder values (WORKSPACE_SLUG, BOARD_ID) with values emitted
 *    by the seed script.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const OWNER_EMAIL = "owner+e2e@donezo.local";
const OWNER_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const GROUP_NAME = "E2E Group A";
const GROUP_B_NAME = "E2E Group B";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Epic 06 — Groups & Tasks (Table View)", () => {
  // Skip all tests until epic 15 wires the Playwright runner and fixtures.
  test.skip(
    true,
    "Spec stub — runner wired in epic 15. Requires seeded users + Playwright config.",
  );

  // ── Step 1: Sign in and navigate to a board ───────────────────────────────
  test("1 — sign in → navigate to board", async ({ page }) => {
    // TODO: epic 15 — seed user + board; replace constants with seed output.
    // Signs in as the owner, navigates to the board URL, and asserts the
    // board table view is rendered (BoardViewTabs should show "Table" active).
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`));
    // The table root element should be visible
    await expect(page.getByRole("table")).toBeVisible();
  });

  // ── Step 2: Create a group via <AddGroupFooter /> ─────────────────────────
  test("2 — create group via AddGroupFooter", async ({ page }) => {
    // TODO: epic 15 — navigate to board; click the "Add group" button rendered
    // by <AddGroupFooter /> at the bottom of the table; fill the group name
    // input; press Enter or click the confirm button; assert the new group
    // header row appears with the given name.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    await page.getByRole("button", { name: /add group/i }).click();
    await page.getByLabel(/group name/i).fill(GROUP_NAME);
    await page.getByRole("button", { name: /create/i }).click();

    await expect(page.getByRole("rowgroup").filter({ hasText: GROUP_NAME })).toBeVisible();
  });

  // ── Step 3: Add 5 tasks via <AddTaskFooter /> (chain-add) ─────────────────
  test("3 — add 5 tasks via AddTaskFooter chain-add", async ({ page }) => {
    // TODO: epic 15 — navigate to the board; within the target group find the
    // <AddTaskFooter /> "Add task" button; click it, type a task title, press
    // Enter to chain-add the next task; repeat 5 times; assert all 5 task rows
    // are visible in the group.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    await groupSection.getByRole("button", { name: /add task/i }).click();

    for (let i = 1; i <= 5; i++) {
      await page.getByRole("textbox", { name: /task title/i }).fill(`Task ${i}`);
      await page.keyboard.press("Enter"); // chain-add: Enter saves and opens next input
    }
    await page.keyboard.press("Escape"); // close the add-task input

    // All 5 tasks should be visible inside the group
    for (let i = 1; i <= 5; i++) {
      await expect(groupSection.getByRole("row").filter({ hasText: `Task ${i}` })).toBeVisible();
    }
  });

  // ── Step 4: Reorder tasks within a group via drag ─────────────────────────
  test("4 — reorder tasks within group via drag-and-drop", async ({ page }) => {
    // TODO: epic 15 — navigate to the board; locate "Task 1" and "Task 5" drag
    // handles (aria-label="Drag to reorder") inside the group; drag Task 1 to
    // the position after Task 5; assert the new order is reflected in the DOM.
    // dnd-kit uses pointer events so use page.mouse for drag simulation.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    const task1Row = groupSection.getByRole("row").filter({ hasText: "Task 1" });
    const task5Row = groupSection.getByRole("row").filter({ hasText: "Task 5" });

    const task1Handle = task1Row.getByRole("button", { name: /drag to reorder/i });
    const task5BBox = await task5Row.boundingBox();

    await task1Handle.hover();
    await page.mouse.down();
    if (task5BBox) {
      await page.mouse.move(task5BBox.x + task5BBox.width / 2, task5BBox.y + task5BBox.height);
    }
    await page.mouse.up();

    // Assert that Task 1 now appears after Task 5 in the DOM order
    const rows = await groupSection.getByRole("row").allTextContents();
    const task1Idx = rows.findIndex((t) => t.includes("Task 1"));
    const task5Idx = rows.findIndex((t) => t.includes("Task 5"));
    expect(task1Idx).toBeGreaterThan(task5Idx);
  });

  // ── Step 5: Cross-group drag a task ──────────────────────────────────────
  test("5 — cross-group drag: move task from Group A to Group B", async ({ page }) => {
    // TODO: epic 15 — ensure a second group (GROUP_B_NAME) exists (seed or
    // create in a prior step); drag a task from Group A to Group B; assert the
    // task row appears inside Group B and is absent from Group A; assert the
    // server action moveTask was called (check via network intercept or by
    // reloading and verifying state persists).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupA = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    const groupB = page.getByRole("rowgroup").filter({ hasText: GROUP_B_NAME });

    const task2Row = groupA.getByRole("row").filter({ hasText: "Task 2" });
    const task2Handle = task2Row.getByRole("button", { name: /drag to reorder/i });
    const groupBBBox = await groupB.boundingBox();

    await task2Handle.hover();
    await page.mouse.down();
    if (groupBBBox) {
      await page.mouse.move(groupBBBox.x + groupBBBox.width / 2, groupBBBox.y + 10);
    }
    await page.mouse.up();

    // Task 2 should now appear in Group B and not in Group A
    await expect(groupB.getByRole("row").filter({ hasText: "Task 2" })).toBeVisible();
    await expect(groupA.getByRole("row").filter({ hasText: "Task 2" })).not.toBeVisible();
  });

  // ── Step 6: Bulk-select 3 tasks via row checkboxes ────────────────────────
  test("6 — bulk-select 3 tasks via row checkboxes", async ({ page }) => {
    // TODO: epic 15 — navigate to the board; locate the row checkboxes
    // (aria-label="Select task") for 3 tasks; click each; assert the
    // <BulkActionBar /> slides in and shows "3 tasks selected".
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    const taskRows = groupSection.getByRole("row");

    // Select the first 3 task rows via their checkboxes
    for (let i = 0; i < 3; i++) {
      await taskRows
        .nth(i)
        .getByRole("checkbox", { name: /select task/i })
        .click();
    }

    // BulkActionBar should appear with selection count
    await expect(page.getByText(/3 task/i)).toBeVisible();
    // The bulk action bar container should be visible
    await expect(page.getByRole("toolbar", { name: /bulk actions/i })).toBeVisible();
  });

  // ── Step 7: Bulk delete via BulkActionBar with Dialog confirm ────────────
  test("7 — bulk delete via BulkActionBar with Dialog confirm", async ({ page }) => {
    // TODO: epic 15 — with 3 tasks selected (from step 6 or re-select here);
    // click the "Delete" button in <BulkActionBar />; the
    // <BulkDeleteConfirmDialog /> opens with heading "Delete X tasks?"; click
    // the "Delete" confirm button; assert the 3 task rows disappear from the
    // DOM; assert a success toast appears.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    const taskRows = groupSection.getByRole("row");

    // Re-select 3 tasks
    for (let i = 0; i < 3; i++) {
      await taskRows
        .nth(i)
        .getByRole("checkbox", { name: /select task/i })
        .click();
    }

    // Click Delete in the bulk action toolbar
    await page
      .getByRole("toolbar", { name: /bulk actions/i })
      .getByRole("button", { name: /delete/i })
      .click();

    // Confirm dialog opens
    await expect(page.getByRole("heading", { name: /delete.*tasks/i })).toBeVisible();
    await page
      .getByRole("button", { name: /delete/i })
      .last()
      .click();

    // Rows should disappear
    await expect(groupSection.getByRole("row")).toHaveCount(2); // 5 - 3 = 2 remaining

    // Success toast
    await expect(page.getByText(/deleted/i)).toBeVisible();
  });

  // ── Step 8: Reload and verify state persists ──────────────────────────────
  test("8 — reload page → groups and remaining tasks persist", async ({ page }) => {
    // TODO: epic 15 — after prior mutations navigate to the board; reload the
    // page; assert the group still exists; assert the remaining tasks (after
    // bulk delete) are still present; assert that cross-group moves are
    // reflected (Task 2 still in Group B).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
    await page.reload();

    // Group A should still exist
    await expect(page.getByRole("rowgroup").filter({ hasText: GROUP_NAME })).toBeVisible();

    // Remaining tasks (Task 4, Task 5 — indices depend on final seed state)
    // should be present; Task 2 should be in Group B
    const groupB = page.getByRole("rowgroup").filter({ hasText: GROUP_B_NAME });
    await expect(groupB.getByRole("row").filter({ hasText: "Task 2" })).toBeVisible();
  });

  // ── Step 9: Toggle group collapse → reload → collapse state persisted ─────
  test("9 — collapse group → reload → collapse state persisted via localStorage", async ({
    page,
  }) => {
    // TODO: epic 15 — navigate to the board; click the collapse toggle button
    // on Group A's header (aria-label="Collapse group" / "Expand group");
    // assert the task rows inside Group A become hidden; reload the page;
    // assert Group A is still collapsed (task rows still hidden, toggle button
    // shows "Expand group"); expand again and verify tasks reappear.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    const collapseBtn = groupSection.getByRole("button", { name: /collapse group/i });
    await collapseBtn.click();

    // Task rows should no longer be visible
    await expect(groupSection.getByRole("row").filter({ hasText: "Task" })).toHaveCount(0);

    // Reload — Zustand persist middleware backed by localStorage should restore state
    await page.reload();

    // Group A should still be collapsed after reload
    await expect(groupSection.getByRole("row").filter({ hasText: "Task" })).toHaveCount(0);
    await expect(groupSection.getByRole("button", { name: /expand group/i })).toBeVisible();
  });

  // ── Rename stubs (F4.1) — runner + fixtures wired in epic 15 ─────────────
  test.skip("group rename via overflow menu enters edit mode", async ({ page }) => {
    // TODO(epic 15): open group overflow menu → click Rename → assert title is editable
    // Steps:
    //   1. Navigate to board.
    //   2. Open the GroupOverflowMenu on Group A (click the MoreHorizontal trigger).
    //   3. Click the "Rename" menu item.
    //   4. Assert the group title <div role="textbox"> receives focus and is in edit mode
    //      (e.g. aria-readonly is absent or aria-multiline="false" is set).
    void page;
  });

  test.skip("task rename via overflow menu enters edit mode", async ({ page }) => {
    // TODO(epic 15): open task overflow menu → click Rename → assert title is editable
    // Steps:
    //   1. Navigate to board.
    //   2. Hover over a task row to reveal the TaskOverflowMenu trigger.
    //   3. Click the trigger to open the popover menu.
    //   4. Click the "Rename" menu item.
    //   5. Assert the task title <div role="textbox"> receives focus and is in edit mode.
    void page;
  });

  // ── Step 10: Group overflow menu → recolor → color reflects in row stripe ──
  test("10 — group overflow menu → recolor → color reflected in group row stripe", async ({
    page,
  }) => {
    // TODO: epic 15 — navigate to the board; open the group overflow menu
    // (aria-label="Group options" or similar) on Group A's header; click
    // "Recolor"; a color-picker popover opens; select a new color (e.g. red
    // #e03e3e); close the popover; assert the group header row's stripe element
    // has the new color applied (via inline style or CSS custom property).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
    const overflowBtn = groupSection.getByRole("button", { name: /group options/i });
    await overflowBtn.click();

    await page.getByRole("menuitem", { name: /recolor/i }).click();

    // Color-picker popover opens; select a color
    // The exact implementation depends on the color-picker component used
    await page.getByRole("option", { name: /red/i }).first().click();

    // Assert the group stripe reflects the new color via inline style
    const stripe = groupSection.locator("[data-group-stripe]");
    const style = await stripe.getAttribute("style");
    expect(style).toMatch(/color|background/i);
  });
});
