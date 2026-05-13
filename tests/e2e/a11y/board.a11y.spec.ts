// @ts-expect-error playwright wired in epic 15
import AxeBuilder from "@axe-core/playwright";
// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Board page a11y specs — table view, kanban view, calendar view.
 *
 * AUTH FIXTURE GAP (document for epic 15):
 * These tests require a logged-in user with an existing board. No auth fixture
 * or seeding mechanism exists yet — that is epic 15's responsibility.
 * Until then, the tests are skipped via test.skip(true, ...) but the spec
 * itself is fully written so epic 15 only needs to:
 *  1. Remove the skip.
 *  2. Replace WORKSPACE_SLUG / BOARD_ID with seed-script output.
 *  3. Wire test.use({ storageState: 'e2e-auth.json' }) for the auth fixture.
 *
 * Run locally (when auth is wired) with:
 *   pnpm dlx playwright test tests/e2e/a11y/board.a11y.spec.ts
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "replace-with-board-id-from-seed";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Board page — axe-core a11y", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  test("board table view has no axe violations", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`);
    // Wait for the board table to hydrate
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("board kanban view has no axe violations", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban`);
    // Wait for kanban board to be present
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
