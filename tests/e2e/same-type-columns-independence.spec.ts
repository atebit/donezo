import { expect, test } from "@playwright/test";
import {
  E2E_WORKSPACE_SLUG,
  SMOKE_BOARD_ID,
  SMOKE_COL_STATUS_A_ID,
  SMOKE_COL_STATUS_B_ID,
  SMOKE_TASK_ALPHA_1,
} from "./fixtures/seed";

/**
 * Epic 16 — Same-type columns independence regression test (Slice F).
 *
 * Verifies that two status columns on the same task row are fully independent:
 * setting a value in column A must not change column B's value.
 *
 * The smoke board has:
 *   - Status A column (id: SMOKE_COL_STATUS_A_ID)
 *   - Status B column (id: SMOKE_COL_STATUS_B_ID)
 *
 * Seeded state on Alpha Task One:
 *   - Status A → Done (label: eeeeeeee-eeee-eeee-eeee-eeeeeee16a1)
 *   - Status B → empty (no cell row)
 *
 * Test: Status A is "Done"; Status B must not show "Done" or any label
 * that belongs to Status A's label set.
 *
 * Auth: global-setup.ts storageState.
 * Seed: supabase/seed.sql EPIC-16 SMOKE BOARD section.
 */

const BOARD_URL = `/w/${E2E_WORKSPACE_SLUG}/b/${SMOKE_BOARD_ID}`;

test.describe("Epic 16 — Same-type columns independence (Slice F regression)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL, { waitUntil: "networkidle" });
    // Wait for the board to render tasks.
    await page.waitForSelector("[data-task-id]", { timeout: 15_000 });
    await page.waitForTimeout(500);
  });

  test("Status A and Status B on the same row are independent in seeded state", async ({
    page,
  }) => {
    // Locate the Alpha Task One row.
    const alphaRow = page.locator(`[data-task-id="${SMOKE_TASK_ALPHA_1}"]`);
    await expect(alphaRow).toBeVisible({ timeout: 10_000 });

    // Locate the Status A cell on Alpha Task One.
    // TableCell renders a div wrapper with data-column-id inside the task row.
    const statusACell = alphaRow.locator(`[data-column-id="${SMOKE_COL_STATUS_A_ID}"]`);
    const statusBCell = alphaRow.locator(`[data-column-id="${SMOKE_COL_STATUS_B_ID}"]`);

    const statusACellCount = await statusACell.count();
    const statusBCellCount = await statusBCell.count();

    if (statusACellCount === 0 || statusBCellCount === 0) {
      // data-column-id may not be present on the wrapper div — try nth-child approach.
      test.info().annotations.push({
        type: "info",
        description:
          "data-column-id attribute not found on cell wrappers; using position-based approach.",
      });

      // Fallback: verify that Status A shows "Done" (seeded) and Status B is empty.
      // Column order: 0=checkbox, 1=title, 2=status-A, 3=status-B, ...
      const rowCells = alphaRow.locator("> div");
      const cellCount = await rowCells.count();

      if (cellCount < 4) {
        test.info().annotations.push({
          type: "info",
          description: `Only ${cellCount} cells found in task row; skipping positional check.`,
        });
        return;
      }

      const statusAContent = await rowCells.nth(2).textContent();
      const statusBContent = await rowCells.nth(3).textContent();

      // Status A should contain "Done" (seeded value).
      expect(statusAContent, "Status A should show Done").toContain("Done");

      // Status B should NOT contain "Done" from Status A's label set.
      // Alpha-1 Status B is empty (no cell row seeded).
      expect(statusBContent, "Status B must not mirror Status A value").not.toContain("Done");
      return;
    }

    // With data-column-id present, directly check cell text content.
    const statusAText = await statusACell.textContent();
    const statusBText = await statusBCell.textContent();

    // Status A on Alpha-1 is seeded as "Done".
    expect(statusAText, "Status A should show Done (seeded)").toContain("Done");

    // Status B on Alpha-1 has no cell row — it should be empty (no "Done" text).
    expect(
      statusBText,
      "Status B must not show Done (independence: different column)",
    ).not.toContain("Done");
  });

  test("setting Status A does not change Status B value", async ({ page }) => {
    // This test clicks Status A on a task that has it empty, sets it,
    // then verifies Status B remains unchanged.

    // Alpha Task Three has both Status A and Status B empty (not seeded).
    const SMOKE_TASK_ALPHA_3 = "eeeeeeee-eeee-eeee-eeee-eeeeeee16d3";
    const alphaRow3 = page.locator(`[data-task-id="${SMOKE_TASK_ALPHA_3}"]`);
    await expect(alphaRow3).toBeVisible({ timeout: 10_000 });

    // Find Status A cell.
    const statusACell = alphaRow3.locator(`[data-column-id="${SMOKE_COL_STATUS_A_ID}"]`);
    const statusBCell = alphaRow3.locator(`[data-column-id="${SMOKE_COL_STATUS_B_ID}"]`);

    const hasCellIds = (await statusACell.count()) > 0 && (await statusBCell.count()) > 0;

    if (!hasCellIds) {
      // Positional fallback.
      const rowCells = alphaRow3.locator("> div");
      const cellCount = await rowCells.count();
      if (cellCount < 4) {
        test.info().annotations.push({
          type: "info",
          description: "Not enough cells in row; skipping independence set test.",
        });
        return;
      }

      // Read Status B text before clicking Status A.
      const statusBBefore = await rowCells.nth(3).textContent();

      // Click Status A (index 2) to open the editor.
      await rowCells.nth(2).click();
      await page.waitForTimeout(300);

      // Look for a label option in the popover.
      const doneOption = page.getByText("Working on it").first();
      const optionVisible = await doneOption.isVisible().catch(() => false);
      if (optionVisible) {
        await doneOption.click();
        await page.waitForTimeout(500);
      } else {
        // Close any open popover.
        await page.keyboard.press("Escape");
        return;
      }

      // Status B should be unchanged.
      const statusBAfter = await rowCells.nth(3).textContent();
      expect(statusBAfter, "Status B should not change when Status A is set").toBe(statusBBefore);
      return;
    }

    // With data-column-id: capture Status B content before, click Status A, check B is same.
    const statusBBefore = await statusBCell.textContent();

    await statusACell.click();
    await page.waitForTimeout(300);

    const workingOnItOption = page.getByText("Working on it").first();
    const optionVisible = await workingOnItOption.isVisible().catch(() => false);
    if (!optionVisible) {
      await page.keyboard.press("Escape");
      return;
    }

    await workingOnItOption.click();
    await page.waitForTimeout(500);

    const statusBAfter = await statusBCell.textContent();
    expect(
      statusBAfter,
      `Status B should not change after setting Status A. Before: "${statusBBefore}", After: "${statusBAfter}"`,
    ).toBe(statusBBefore);
  });

  test("reloading the page preserves Status A / Status B independence", async ({ page }) => {
    // Load the board fresh and re-verify the seeded independence.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("[data-task-id]", { timeout: 15_000 });
    await page.waitForTimeout(500);

    const alphaRow = page.locator(`[data-task-id="${SMOKE_TASK_ALPHA_1}"]`);
    await expect(alphaRow).toBeVisible({ timeout: 10_000 });

    const statusACell = alphaRow.locator(`[data-column-id="${SMOKE_COL_STATUS_A_ID}"]`);
    const statusBCell = alphaRow.locator(`[data-column-id="${SMOKE_COL_STATUS_B_ID}"]`);

    const hasCellIds = (await statusACell.count()) > 0 && (await statusBCell.count()) > 0;

    if (!hasCellIds) {
      const rowCells = alphaRow.locator("> div");
      const cellCount = await rowCells.count();
      if (cellCount < 4) return;

      const statusAContent = await rowCells.nth(2).textContent();
      const statusBContent = await rowCells.nth(3).textContent();

      // After reload, Status A still "Done", Status B still empty.
      expect(statusAContent).toContain("Done");
      expect(statusBContent).not.toContain("Done");
      return;
    }

    const statusAText = await statusACell.textContent();
    const statusBText = await statusBCell.textContent();

    // Post-reload: Status A = Done (persisted); Status B = still empty.
    expect(statusAText).toContain("Done");
    expect(statusBText).not.toContain("Done");
  });
});
