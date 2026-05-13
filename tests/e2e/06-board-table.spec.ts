import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

/**
 * Groups & Tasks (Table View) e2e spec.
 *
 * Auth is handled by global-setup.ts storageState.
 * The e2e board is seeded by supabase/seed.sql (e2e section).
 */

const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const BOARD_ID = E2E_BOARD_ID;
const GROUP_NAME = "E2E Group A";
const GROUP_B_NAME = "E2E Group B";

// Functional specs need seed data + UI-affordance review; see
// `docs/conversion-plan/_dispatch/epic-15-e2e-remediation.md`.
test.describe
  .fixme("Epic 06 — Groups & Tasks (Table View)", () => {
    // ── Step 1: Navigate to the seeded board ─────────────────────────────────
    test("1 — navigate to board", async ({ page }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
      await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`));
      // The table root element should be visible
      await expect(page.getByRole("table")).toBeVisible();
    });

    // ── Step 2: Create a group via <AddGroupFooter /> ─────────────────────────
    test("2 — create group via AddGroupFooter", async ({ page }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

      await page.getByRole("button", { name: /add group/i }).click();
      await page.getByLabel(/group name/i).fill(GROUP_NAME);
      await page.getByRole("button", { name: /create/i }).click();

      await expect(page.getByRole("rowgroup").filter({ hasText: GROUP_NAME })).toBeVisible();
    });

    // ── Step 3: Add 5 tasks via <AddTaskFooter /> (chain-add) ─────────────────
    test("3 — add 5 tasks via AddTaskFooter chain-add", async ({ page }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

      const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
      await groupSection.getByRole("button", { name: /add task/i }).click();

      for (let i = 1; i <= 5; i++) {
        await page.getByRole("textbox", { name: /task title/i }).fill(`Task ${i}`);
        await page.keyboard.press("Enter");
      }
      await page.keyboard.press("Escape");

      for (let i = 1; i <= 5; i++) {
        await expect(groupSection.getByRole("row").filter({ hasText: `Task ${i}` })).toBeVisible();
      }
    });

    // ── Step 4: Reorder tasks within a group via drag ─────────────────────────
    test("4 — reorder tasks within group via drag-and-drop", async ({ page }) => {
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

      const rows = await groupSection.getByRole("row").allTextContents();
      const task1Idx = rows.findIndex((t) => t.includes("Task 1"));
      const task5Idx = rows.findIndex((t) => t.includes("Task 5"));
      expect(task1Idx).toBeGreaterThan(task5Idx);
    });

    // ── Step 5: Cross-group drag a task ──────────────────────────────────────
    test("5 — cross-group drag: move task from Group A to Group B", async ({ page }) => {
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

      await expect(groupB.getByRole("row").filter({ hasText: "Task 2" })).toBeVisible();
      await expect(groupA.getByRole("row").filter({ hasText: "Task 2" })).not.toBeVisible();
    });

    // ── Step 6: Bulk-select 3 tasks via row checkboxes ────────────────────────
    test("6 — bulk-select 3 tasks via row checkboxes", async ({ page }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

      const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
      const taskRows = groupSection.getByRole("row");

      for (let i = 0; i < 3; i++) {
        await taskRows
          .nth(i)
          .getByRole("checkbox", { name: /select task/i })
          .click();
      }

      await expect(page.getByText(/3 task/i)).toBeVisible();
      await expect(page.getByRole("toolbar", { name: /bulk actions/i })).toBeVisible();
    });

    // ── Step 7: Bulk delete via BulkActionBar with Dialog confirm ────────────
    test("7 — bulk delete via BulkActionBar with Dialog confirm", async ({ page }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

      const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
      const taskRows = groupSection.getByRole("row");

      for (let i = 0; i < 3; i++) {
        await taskRows
          .nth(i)
          .getByRole("checkbox", { name: /select task/i })
          .click();
      }

      await page
        .getByRole("toolbar", { name: /bulk actions/i })
        .getByRole("button", { name: /delete/i })
        .click();

      await expect(page.getByRole("heading", { name: /delete.*tasks/i })).toBeVisible();
      await page
        .getByRole("button", { name: /delete/i })
        .last()
        .click();

      await expect(groupSection.getByRole("row")).toHaveCount(2);
      await expect(page.getByText(/deleted/i)).toBeVisible();
    });

    // ── Step 8: Reload and verify state persists ──────────────────────────────
    test("8 — reload page → groups and remaining tasks persist", async ({ page }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
      await page.reload();

      await expect(page.getByRole("rowgroup").filter({ hasText: GROUP_NAME })).toBeVisible();

      const groupB = page.getByRole("rowgroup").filter({ hasText: GROUP_B_NAME });
      await expect(groupB.getByRole("row").filter({ hasText: "Task 2" })).toBeVisible();
    });

    // ── Step 9: Toggle group collapse → reload → collapse state persisted ─────
    test("9 — collapse group → reload → collapse state persisted via localStorage", async ({
      page,
    }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

      const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
      const collapseBtn = groupSection.getByRole("button", {
        name: /collapse group/i,
      });
      await collapseBtn.click();

      await expect(groupSection.getByRole("row").filter({ hasText: "Task" })).toHaveCount(0);

      await page.reload();

      await expect(groupSection.getByRole("row").filter({ hasText: "Task" })).toHaveCount(0);
      await expect(groupSection.getByRole("button", { name: /expand group/i })).toBeVisible();
    });

    // ── Group rename stubs (F4.1) ─────────────────────────────────────────────
    test.fixme("group rename via overflow menu enters edit mode", async ({ page }) => {
      // TODO: open group overflow menu → click Rename → assert title is editable
      void page;
    });

    test.fixme("task rename via overflow menu enters edit mode", async ({ page }) => {
      // TODO: open task overflow menu → click Rename → assert title is editable
      void page;
    });

    // ── Step 10: Group overflow menu → recolor ──────────────────────────────
    test("10 — group overflow menu → recolor → color reflected in group row stripe", async ({
      page,
    }) => {
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);

      const groupSection = page.getByRole("rowgroup").filter({ hasText: GROUP_NAME });
      const overflowBtn = groupSection.getByRole("button", {
        name: /group options/i,
      });
      await overflowBtn.click();

      await page.getByRole("menuitem", { name: /recolor/i }).click();

      await page.getByRole("option", { name: /red/i }).first().click();

      const stripe = groupSection.locator("[data-group-stripe]");
      const style = await stripe.getAttribute("style");
      expect(style).toMatch(/color|background/i);
    });
  });
