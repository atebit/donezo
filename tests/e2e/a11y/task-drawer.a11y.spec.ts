// @ts-expect-error playwright wired in epic 15
import AxeBuilder from "@axe-core/playwright";
// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Task drawer a11y spec.
 *
 * AUTH FIXTURE GAP (document for epic 15):
 * Requires a logged-in user with a board containing at least one task.
 * Epic 15 owns seeding + auth fixture wiring. Until then, tests are skipped.
 *
 * To enable in epic 15:
 *  1. Remove test.skip.
 *  2. Replace constants with seed-script output.
 *  3. Wire test.use({ storageState: 'e2e-auth.json' }).
 *
 * Run locally (when auth is wired) with:
 *   pnpm dlx playwright test tests/e2e/a11y/task-drawer.a11y.spec.ts
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "replace-with-board-id-from-seed";
const TASK_ID = "replace-with-task-id-from-seed";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Task drawer — axe-core a11y", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  test("task drawer (open) has no axe violations", async ({ page }) => {
    // Navigate to the board and open the task drawer via the intercept route
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/t/${TASK_ID}`);
    // Wait for the dialog/drawer to be visible
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
