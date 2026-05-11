// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config.
 *
 * TODO (epic 15):
 *  - Seed a primary user (owner) and a board with at least 5 tasks in the
 *    Supabase test DB via pgTAP fixtures or a setup script.
 *  - Configure `playwright.config.ts` with baseURL pointing to the local dev
 *    server (or Vercel preview URL in CI).
 *  - Wire `test.use({ storageState })` so sign-in persists across tests in the
 *    same describe block (avoids re-logging in for every test).
 *  - Replace placeholder values (WORKSPACE_SLUG, BOARD_ID) with values emitted
 *    by the seed script.
 *  - Ensure the demo board has at least one status column and 5 seeded tasks
 *    before running these scenarios.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const OWNER_EMAIL = "owner+e2e@donezo.local";
const OWNER_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Epic 07 — Column System", () => {
  // Skip all tests until epic 15 wires the Playwright runner and fixtures.
  test.skip(
    true,
    "Spec stub — runner wired in epic 15. Requires seeded users + Playwright config.",
  );

  // ── Step 1: Sign in and navigate to a board (precondition) ───────────────
  test.skip("1 — sign in → navigate to board", async ({ page }) => {
    // TODO(epic 15): seed user + board; replace constants with seed output.
    // 1. Navigate to /sign-in.
    // 2. Fill OWNER_EMAIL + OWNER_PASSWORD, click "Sign in".
    // 3. Navigate to /w/<WORKSPACE_SLUG>/b/<BOARD_ID>.
    // 4. Assert the board table is rendered (role="table" is visible).
    // 5. Assert the "Name" column header is visible (baseline before adding columns).
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`));
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /name/i })).toBeVisible();
  });

  // ── Step 2: Add a "status" column via AddColumnModal ─────────────────────
  test.skip("2 — AddColumnModal → pick 'status' type → submit → column header + cells appear", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board.
    // 2. Click the "+" / "Add column" button in the sticky header
    //    (aria-label="Add column" or role="button" name /add column/i).
    // 3. Assert <AddColumnModal /> opens with heading "Add column".
    // 4. Fill the column name field (label: "Column name") with "Status".
    // 5. Select "Status" from the type picker (role="option" name /status/i or
    //    a listbox / radio group listing the 24 cell types).
    // 6. Click "Add column" / "Create" submit button.
    // 7. Assert the modal closes.
    // 8. Assert a new column header "Status" appears at the right end of the
    //    header row (last role="columnheader" before the "+" button).
    // 9. Assert every seeded task row now has a cell in the Status column
    //    (empty / gray "(empty)" label rendered by <StatusCell /> when
    //    cell.label_id is null).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    await page.getByRole("button", { name: /add column/i }).click();
    await expect(page.getByRole("heading", { name: /add column/i })).toBeVisible();

    await page.getByLabel(/column name/i).fill("Status");
    await page.getByRole("option", { name: /^status$/i }).click();
    await page.getByRole("button", { name: /add column|create/i }).click();

    await expect(page.getByRole("heading", { name: /add column/i })).not.toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();

    // Every task row should have an (empty) status cell
    const taskRows = page.getByRole("row").filter({ hasText: /task/i });
    await expect(taskRows.first().getByRole("cell").last()).toBeVisible();
  });

  // ── Step 3: Click a cell → set status value via popover ──────────────────
  test.skip("3 — click status cell → popover opens → pick label → cell reflects label color + name", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board (status column exists from step 2 or seed).
    // 2. Click the status cell in the first task row (find by role="cell" inside
    //    the row, in the "Status" column position).
    // 3. Assert a popover opens listing the seeded status labels:
    //    "Working on it", "Done", "Stuck", "Waiting for review", "Pending".
    // 4. Click "Done" in the popover.
    // 5. Assert the popover closes.
    // 6. Assert the status cell for that task now displays:
    //    - The label name "Done" (visible text or aria-label).
    //    - The label color (#00c875 green, as a background or text color
    //      matching the --color-label-green CSS variable).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    // Click the first task's status cell (column index may vary; use column header
    // position to determine the correct cell index).
    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    const statusColIdx = await statusHeader.evaluate((el) => {
      const headers = Array.from(el.closest("tr")?.querySelectorAll("th") ?? []);
      return headers.indexOf(el as HTMLTableCellElement);
    });

    const firstTaskRow = page.getByRole("row").filter({ hasText: /task/i }).first();
    await firstTaskRow.getByRole("cell").nth(statusColIdx).click();

    // Status label popover opens
    await expect(page.getByRole("listbox").or(page.getByRole("menu"))).toBeVisible();
    await expect(page.getByText("Done")).toBeVisible();
    await page.getByText("Done").click();

    // Cell reflects the new label
    await expect(firstTaskRow.getByRole("cell").nth(statusColIdx)).toContainText("Done");
  });

  // ── Step 4: Set status on 3 tasks total ──────────────────────────────────
  test.skip("4 — set status value on 3 tasks (different labels)", async ({ page }) => {
    // TODO(epic 15):
    // Repeat the step-3 pattern for 3 task rows, choosing different labels:
    //   Task 1 → "Done"
    //   Task 2 → "Working on it"
    //   Task 3 → "Stuck"
    // Assert each cell reflects its chosen label name and associated color after
    // each selection. This verifies that label-id-backed cells correctly persist
    // independent values per task.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    const statusColIdx = await statusHeader.evaluate((el) => {
      const headers = Array.from(el.closest("tr")?.querySelectorAll("th") ?? []);
      return headers.indexOf(el as HTMLTableCellElement);
    });

    const taskRows = page.getByRole("row").filter({ hasText: /task/i });
    const assignments = [
      { idx: 0, label: "Done" },
      { idx: 1, label: "Working on it" },
      { idx: 2, label: "Stuck" },
    ];

    for (const { idx, label } of assignments) {
      await taskRows.nth(idx).getByRole("cell").nth(statusColIdx).click();
      await page.getByText(label).click();
      await expect(taskRows.nth(idx).getByRole("cell").nth(statusColIdx)).toContainText(label);
    }
  });

  // ── Step 5: Sort ascending via ColumnHeaderMenu ───────────────────────────
  test.skip("5 — ColumnHeaderMenu → Sort ascending → tasks reorder by status label", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board with 3 tasks already assigned status values.
    // 2. Click the Status column header to open <ColumnHeaderMenu /> (or hover
    //    to reveal the overflow trigger — aria-label="Column options" or similar).
    // 3. Click "Sort ascending" in the menu.
    // 4. Assert the task rows reorder so that status labels appear in
    //    alphabetical or logical ascending order (Done → Stuck → Working on it,
    //    or whatever the registry's sort comparator defines).
    // 5. The sort is ephemeral (no DB write in this epic); a page reload resets order.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    // Open column header menu — trigger may be the header itself or an overflow button within it
    await statusHeader.hover();
    await statusHeader.getByRole("button", { name: /column options|options/i }).click();

    await page.getByRole("menuitem", { name: /sort ascending/i }).click();

    // Verify sort: "Done" should precede "Stuck" which precedes "Working on it" (alpha)
    const taskRows = page.getByRole("row").filter({ hasText: /task/i });
    const firstRowText = await taskRows.first().textContent();
    const lastRowText = await taskRows.last().textContent();
    // "Done" < "Stuck" < "Working on it" alphabetically
    expect(firstRowText).toMatch(/done/i);
    expect(lastRowText).toMatch(/working on it/i);
  });

  // ── Step 6: Change type → Text (lossy conversion with typed-name confirm) ─
  test.skip("6 — ColumnHeaderMenu → Change type → Text → typed-name CONFIRM → cells show label names as text", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board.
    // 2. Open ColumnHeaderMenu on the Status column.
    // 3. Click "Change type".
    // 4. Select "Text" from the type picker.
    // 5. Because status → text is a lossy conversion (label_id values will be
    //    written as label names into text_value), a <Dialog> confirm appears.
    //    The dialog uses the typed-name pattern: user must type the column name
    //    ("Status") to enable the "Change type" confirm button.
    // 6. Type "Status" into the confirm input.
    // 7. Click "Change type" confirm button.
    // 8. Assert the Status column cells now render as plain text showing the
    //    label names (e.g. "Done", "Working on it", "Stuck") — no color swatches.
    // 9. Assert the column header icon changes from the status circle icon to
    //    the text icon (T).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    await statusHeader.hover();
    await statusHeader.getByRole("button", { name: /column options|options/i }).click();

    await page.getByRole("menuitem", { name: /change type/i }).click();
    await page.getByRole("option", { name: /^text$/i }).click();

    // Lossy-conversion confirm dialog
    await expect(page.getByRole("heading", { name: /change type/i })).toBeVisible();
    await page.getByLabel(/type.*to confirm/i).fill("Status");
    await page
      .getByRole("button", { name: /change type/i })
      .last()
      .click();

    // Cells should now render as plain text
    const statusColIdx = await statusHeader.evaluate((el) => {
      const headers = Array.from(el.closest("tr")?.querySelectorAll("th") ?? []);
      return headers.indexOf(el as HTMLTableCellElement);
    });
    const firstTaskRow = page.getByRole("row").filter({ hasText: /task/i }).first();
    // The converted cell should contain a label name as plain text, not a colored chip
    await expect(firstTaskRow.getByRole("cell").nth(statusColIdx)).toContainText("Done");
    // Verify no color swatch is visible in the cell (the span with background-color is gone)
    await expect(
      firstTaskRow.getByRole("cell").nth(statusColIdx).locator("[data-label-chip]"),
    ).toHaveCount(0);
  });

  // ── Step 7: Add number column → reorder → resize → reload → width persists ─
  test.skip("7 — AddColumnModal → 'number' → drag header to reorder → drag edge to resize → reload → resize persists (localStorage)", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board.
    // 2. Click "Add column", name it "Score", pick type "Number", submit.
    // 3. Assert "Score" column header appears at the right end.
    //
    // Reorder:
    // 4. Drag the "Score" column header to the left of the "Status" (now "Text") column
    //    using dnd-kit horizontal list sorting strategy.
    //    - Use page.mouse for drag simulation (dnd-kit uses pointer events).
    //    - Assert "Score" appears before the previous column in the header row.
    //
    // Resize:
    // 5. Locate the resize handle on the right edge of the "Score" column header
    //    (aria-label="Resize column" or data-resize-handle).
    // 6. Drag the handle ~50px to the right.
    // 7. Assert the column's rendered width increased by approximately 50px
    //    (check via getBoundingClientRect or the inline style width value).
    //
    // Persistence:
    // 8. Reload the page.
    // 9. Assert the column is still at its resized width (localStorage key
    //    "donezo:column-prefs:v1" contains the boardId → columnId → { width } entry).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    // Add "Score" number column
    await page.getByRole("button", { name: /add column/i }).click();
    await page.getByLabel(/column name/i).fill("Score");
    await page.getByRole("option", { name: /^number$/i }).click();
    await page.getByRole("button", { name: /add column|create/i }).click();
    await expect(page.getByRole("columnheader", { name: "Score" })).toBeVisible();

    // Reorder: drag Score header to the second position
    const scoreHeader = page.getByRole("columnheader", { name: "Score" });
    const targetHeader = page.getByRole("columnheader").nth(1); // second column slot
    const scoreBBox = await scoreHeader.boundingBox();
    const targetBBox = await targetHeader.boundingBox();
    if (scoreBBox && targetBBox) {
      await page.mouse.move(scoreBBox.x + scoreBBox.width / 2, scoreBBox.y + scoreBBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBBox.x + 10, targetBBox.y + targetBBox.height / 2);
      await page.mouse.up();
    }

    // Resize: drag the right edge handle ~50px wider
    const scoreHeaderAfter = page.getByRole("columnheader", { name: "Score" });
    const resizeHandle = scoreHeaderAfter.getByRole("button", { name: /resize/i });
    const handleBBox = await resizeHandle.boundingBox();
    if (handleBBox) {
      await page.mouse.move(
        handleBBox.x + handleBBox.width / 2,
        handleBBox.y + handleBBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        handleBBox.x + handleBBox.width / 2 + 50,
        handleBBox.y + handleBBox.height / 2,
      );
      await page.mouse.up();
    }

    // Reload and verify width persisted via localStorage
    await page.reload();
    const persistedWidth = await page.evaluate(() => {
      const prefs = localStorage.getItem("donezo:column-prefs:v1");
      if (!prefs) return null;
      const parsed = JSON.parse(prefs) as Record<string, Record<string, { width?: number }>>;
      // Find any column entry with a width key (board/column IDs are dynamic)
      return (
        Object.values(parsed)
          .flatMap((cols) => Object.values(cols))
          .find((v) => v.width != null)?.width ?? null
      );
    });
    expect(persistedWidth).toBeGreaterThan(0);
  });

  // ── Step 8: Hide column → disappears → re-show → reappears ───────────────
  test.skip("8 — ColumnHeaderMenu → Hide → column disappears → re-show → reappears", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board.
    // 2. Open ColumnHeaderMenu on the "Score" (number) column.
    // 3. Click "Hide column".
    // 4. Assert the "Score" column header disappears from the header row.
    // 5. Assert the task rows no longer show a cell in the Score column position.
    // 6. Re-show the column via the column-visibility menu:
    //    - Click the column-visibility toggle button in the board toolbar
    //      (aria-label="Show / hide columns" or "Column visibility").
    //    - Assert a panel/popover opens listing hidden columns including "Score".
    //    - Click the "Score" toggle / eye icon to show it again.
    // 7. Assert the "Score" column header reappears.
    // 8. Assert task rows show the Score cells again.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const scoreHeader = page.getByRole("columnheader", { name: "Score" });
    await scoreHeader.hover();
    await scoreHeader.getByRole("button", { name: /column options|options/i }).click();
    await page.getByRole("menuitem", { name: /hide column/i }).click();

    // Column header should disappear
    await expect(page.getByRole("columnheader", { name: "Score" })).not.toBeVisible();

    // Re-show via visibility panel
    await page.getByRole("button", { name: /show.*hide.*columns|column visibility/i }).click();
    await expect(page.getByText("Score")).toBeVisible();
    await page
      .getByRole("switch", { name: "Score" })
      .or(page.getByRole("checkbox", { name: "Score" }))
      .click();

    // Column should reappear
    await expect(page.getByRole("columnheader", { name: "Score" })).toBeVisible();
  });

  // ── Step 9: Bulk-select 3+ tasks → BulkActionBar Apply column value ───────
  test.skip("9 — bulk-select 3+ tasks → BulkActionBar 'Apply column value' → pick status column → choose label → all 3 cells update", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board.
    // 2. Select 3 task rows via their row checkboxes (aria-label="Select task").
    // 3. Assert the <BulkActionBar /> toolbar appears with "3 tasks selected".
    // 4. Click the "Apply column value" button in the BulkActionBar.
    // 5. A column picker opens listing columns eligible for bulk-set
    //    (status, person, date, checkbox, text, number, currency, priority, rating).
    // 6. Pick the "Status" column.
    // 7. The status label editor opens (same popover as the single-cell editor).
    // 8. Click "Working on it".
    // 9. Assert the BulkActionBar shows a success toast or confirmation.
    // 10. Assert all 3 selected task rows now display "Working on it" in the
    //     Status column (verify via cell text content or aria-label).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const taskRows = page.getByRole("row").filter({ hasText: /task/i });

    // Select 3 tasks
    for (let i = 0; i < 3; i++) {
      await taskRows
        .nth(i)
        .getByRole("checkbox", { name: /select task/i })
        .click();
    }

    await expect(page.getByRole("toolbar", { name: /bulk actions/i })).toBeVisible();
    await expect(page.getByText(/3 task/i)).toBeVisible();

    // Apply column value
    await page
      .getByRole("toolbar", { name: /bulk actions/i })
      .getByRole("button", { name: /apply column value/i })
      .click();

    // Column picker
    await page.getByRole("option", { name: "Status" }).click();

    // Label editor
    await page.getByText("Working on it").click();

    // All 3 rows should reflect the new status
    const statusHeader = page.getByRole("columnheader", { name: "Status" });
    const statusColIdx = await statusHeader.evaluate((el) => {
      const headers = Array.from(el.closest("tr")?.querySelectorAll("th") ?? []);
      return headers.indexOf(el as HTMLTableCellElement);
    });
    for (let i = 0; i < 3; i++) {
      await expect(taskRows.nth(i).getByRole("cell").nth(statusColIdx)).toContainText(
        "Working on it",
      );
    }
  });

  // ── Step 10: Delete column via ColumnHeaderMenu (typed-name confirm) ───────
  test.skip("10 — ColumnHeaderMenu → Delete → typed-name DELETE → column + cells gone", async ({
    page,
  }) => {
    // TODO(epic 15):
    // 1. Navigate to the board.
    // 2. Open ColumnHeaderMenu on the "Score" (number) column.
    // 3. Click "Delete column".
    // 4. A <Dialog> confirm opens with heading "Delete column?".
    //    The dialog uses the typed-name pattern: user must type the column name
    //    ("Score") to enable the "Delete column" confirm button.
    // 5. Assert the confirm button is disabled before typing.
    // 6. Type "Score" into the confirm input (label: "Type 'Score' to confirm").
    // 7. Assert the confirm button becomes enabled.
    // 8. Click "Delete column" to confirm.
    // 9. Assert the "Score" column header disappears from the header row.
    // 10. Assert task rows no longer show a cell in the Score column position.
    // 11. Reload the page and verify the column is still gone (DB deletion
    //     confirmed, not just optimistic UI removal).
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

    const scoreHeader = page.getByRole("columnheader", { name: "Score" });
    await scoreHeader.hover();
    await scoreHeader.getByRole("button", { name: /column options|options/i }).click();
    await page.getByRole("menuitem", { name: /delete column/i }).click();

    // Typed-name confirm dialog
    await expect(page.getByRole("heading", { name: /delete column/i })).toBeVisible();
    const confirmBtn = page.getByRole("button", { name: /delete column/i }).last();
    await expect(confirmBtn).toBeDisabled();

    await page.getByLabel(/type.*to confirm/i).fill("Score");
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Column should be gone
    await expect(page.getByRole("columnheader", { name: "Score" })).not.toBeVisible();

    // Reload — DB deletion must persist
    await page.reload();
    await expect(page.getByRole("columnheader", { name: "Score" })).not.toBeVisible();
  });
});
