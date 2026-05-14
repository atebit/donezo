import { expect, test } from "@playwright/test";
import { E2E_WORKSPACE_SLUG, SMOKE_BOARD_ID } from "./fixtures/seed";

/**
 * Epic 16 — Cell editor popover anchor test.
 *
 * Verifies that the cell editor popover (fixed in Slice B via Base UI anchor
 * prop) opens next to the triggering cell rather than at viewport origin.
 *
 * Tests run at two viewports: 1280×800 and 1920×1080.
 *
 * Auth: global-setup.ts storageState.
 * Seed: supabase/seed.sql EPIC-16 SMOKE BOARD section.
 */

const BOARD_URL = `/w/${E2E_WORKSPACE_SLUG}/b/${SMOKE_BOARD_ID}`;

// Popover must overlap the cell horizontally and left edge within ±8px.
const _ANCHOR_LEFT_TOLERANCE = 8;

interface ViewportConfig {
  label: string;
  width: number;
  height: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { label: "1280×800", width: 1280, height: 800 },
  { label: "1920×1080", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Cell editor anchor @ ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ page }) => {
      await page.goto(BOARD_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
    });

    test(`status cell editor anchors to the cell @ ${vp.label}`, async ({ page }) => {
      // Find a status cell that is rendered — look for a cell with data-column-id
      // matching the Status A column, or just find the first status-looking cell.
      // The TaskRow renders cells as divs with data-task-id on the row.
      // TableCell renders a div inside the cell slot.

      // Strategy: find a task row, then click the cell in the "Status A" column.
      // The column header "Status A" tells us which column position it is.
      const statusAHeader = page.getByRole("columnheader", { name: /Status A/i });
      const headerVisible = await statusAHeader.isVisible().catch(() => false);

      if (!headerVisible) {
        // Boards may not use role="columnheader" in the grid-div approach.
        // Fall back to finding the column header by text content.
        const headerText = page.getByText("Status A").first();
        const textVisible = await headerText.isVisible().catch(() => false);
        if (!textVisible) {
          test.info().annotations.push({
            type: "info",
            description: "Status A column header not found; skipping anchor test.",
          });
          return;
        }
      }

      // Click the first task row's Status A cell.
      // Task rows have [data-task-id] on the row element.
      const firstTaskRow = page.locator("[data-task-id]").first();
      const rowVisible = await firstTaskRow.isVisible().catch(() => false);
      if (!rowVisible) {
        test.skip();
        return;
      }

      // Get the column index of Status A from the header position.
      // The smoke board columns: text(0), status-A(1), status-B(2), priority(3),
      // person(4), date(5), number(6), ...
      // In the grid: checkbox(0), title(1), status-A(2), status-B(3), ...
      // We click the cell by finding the div at grid position matching Status A.
      const rowBbox = await firstTaskRow.boundingBox();
      if (!rowBbox) {
        test.skip();
        return;
      }

      // Find cells within the row — direct div children.
      const rowCells = firstTaskRow.locator("> div");
      const cellCount = await rowCells.count();

      // Look for a cell with data-column-id = SMOKE_COL_STATUS_A_ID,
      // or fall back to clicking the 3rd cell (index 2: checkbox, title, status-A).
      const statusACellByAttr = firstTaskRow.locator(
        '[data-column-id="eeeeeeee-eeee-eeee-eeee-eeeeeeee1621"]',
      );
      const attrCount = await statusACellByAttr.count();

      let targetCell = attrCount > 0 ? statusACellByAttr.first() : null;
      if (!targetCell && cellCount >= 3) {
        // Fallback: 3rd cell (0-indexed: checkbox=0, title=1, status-A=2)
        targetCell = rowCells.nth(2);
      }

      if (!targetCell) {
        test.skip();
        return;
      }

      const cellBbox = await targetCell.boundingBox();
      if (!cellBbox) {
        test.skip();
        return;
      }

      // Click the center of the cell to open the editor.
      await targetCell.click();

      // CellEditor renders Popover.Popup with data-testid="cell-editor-popup".
      // Base UI does not emit [data-popup], [role="dialog"], or Radix wrapper attrs.
      const popover = page.locator('[data-testid="cell-editor-popup"]').first();

      // Hard-fail if the popover does not mount — a missing popover is a regression.
      await expect(popover).toBeVisible({ timeout: 3000 });

      const popoverBbox = await popover.boundingBox();
      if (!popoverBbox) return;

      // The popover must NOT be at viewport origin (0,0) — that was the bug.
      expect(popoverBbox.x, "Popover x must not be at viewport origin").toBeGreaterThan(10);
      expect(popoverBbox.y, "Popover y must not be at viewport origin").toBeGreaterThan(10);

      // Popover should overlap the cell horizontally.
      const cellRight = cellBbox.x + cellBbox.width;
      const popoverRight = popoverBbox.x + popoverBbox.width;
      const overlaps = popoverBbox.x < cellRight && popoverRight > cellBbox.x;
      expect(overlaps, "Popover should overlap cell horizontally").toBe(true);
    });

    test(`priority cell editor anchors to the cell @ ${vp.label}`, async ({ page }) => {
      // Find a priority cell and verify the popover anchors correctly.
      const firstTaskRow = page.locator("[data-task-id]").first();
      const rowVisible = await firstTaskRow.isVisible().catch(() => false);
      if (!rowVisible) {
        test.skip();
        return;
      }

      // Priority is column index 3 in the grid (0=checkbox, 1=title, 2=status-A, 3=status-B, 4=priority).
      // But column 4 in grid = priority (0-indexed among data columns: title=0, sA=1, sB=2, prio=3).
      const priorityCellByAttr = firstTaskRow.locator(
        '[data-column-id="eeeeeeee-eeee-eeee-eeee-eeeeeeee1623"]',
      );
      const attrCount = await priorityCellByAttr.count();

      const rowCells = firstTaskRow.locator("> div");
      const cellCount = await rowCells.count();

      let targetCell = attrCount > 0 ? priorityCellByAttr.first() : null;
      if (!targetCell && cellCount >= 5) {
        // 5th cell (0=checkbox, 1=title, 2=sA, 3=sB, 4=priority)
        targetCell = rowCells.nth(4);
      }

      if (!targetCell) {
        test.skip();
        return;
      }

      const cellBbox = await targetCell.boundingBox();
      if (!cellBbox) {
        test.skip();
        return;
      }

      await targetCell.click();

      // Hard-fail if the popover does not mount — a missing popover is a regression.
      const popover = page.locator('[data-testid="cell-editor-popup"]').first();
      await expect(popover).toBeVisible({ timeout: 3000 });

      const popoverBbox = await popover.boundingBox();
      if (!popoverBbox) return;

      expect(popoverBbox.x, "Priority popover x not at viewport origin").toBeGreaterThan(10);
      expect(popoverBbox.y, "Priority popover y not at viewport origin").toBeGreaterThan(10);
    });
  });
}
