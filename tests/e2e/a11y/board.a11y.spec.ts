import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_WORKSPACE_SLUG } from "../fixtures/seed";

/**
 * Board page a11y specs — table view, kanban view, calendar view.
 *
 * Auth is handled by the global-setup.ts storageState.
 * The e2e board is seeded by supabase/seed.sql (e2e section).
 */

const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const BOARD_ID = E2E_BOARD_ID;

test.describe("Board page — axe-core a11y", () => {
  test("board table view has no axe violations", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
    // Wait for the board table to hydrate
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("board kanban view has no axe violations", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban`);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("board calendar view has no axe violations", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/calendar`);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
