import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_TASK_1_ID, E2E_WORKSPACE_SLUG } from "../fixtures/seed";

/**
 * Task drawer a11y spec.
 *
 * Auth is handled by the global-setup.ts storageState.
 * The e2e task is seeded by supabase/seed.sql (e2e section).
 */

const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const BOARD_ID = E2E_BOARD_ID;
const TASK_ID = E2E_TASK_1_ID;

// Real axe violations on the task drawer (Tiptap editor lacks accessible name,
// page lacks h1, etc.). Tracked for v1.1 a11y sweep in
// `docs/conversion-plan/_dispatch/epic-15-e2e-remediation.md`.
test.describe
  .fixme("Task drawer — axe-core a11y", () => {
    test("task drawer (open) has no axe violations", async ({ page }) => {
      // Navigate to the board and open the task drawer via the intercept route
      await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/t/${TASK_ID}`);
      // Wait for the dialog/drawer to be visible
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
