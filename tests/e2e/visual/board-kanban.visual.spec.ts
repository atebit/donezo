// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Visual snapshot specs — Board Kanban View
 *
 * Captures screenshots at three viewports (mobile, tablet, desktop) in both
 * light and dark color schemes.
 *
 * On mobile (375px) the kanban renders as horizontal snap-scrolling lanes.
 * The snapshot captures the initial lane position (leftmost).
 *
 * AUTH FIXTURE GAP (document for epic 15):
 * These tests require a logged-in user with an existing board that has a
 * status column with at least two groups. No auth fixture or seeding
 * mechanism exists yet — that is epic 15's responsibility. Until then,
 * tests are skipped via test.skip(true, ...) but the spec is fully written
 * so epic 15 only needs to:
 *  1. Remove the skip.
 *  2. Replace WORKSPACE_SLUG / BOARD_ID with seed-script output.
 *  3. Wire test.use({ storageState: 'e2e-auth.json' }) for the auth fixture.
 *
 * Run locally (when auth is wired) with:
 *   pnpm dlx playwright test tests/e2e/visual/board-kanban.visual.spec.ts
 *
 * Snapshots are committed under __snapshots__/ on first run (--update-snapshots).
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "replace-with-board-id-from-seed";

// ---------------------------------------------------------------------------
// Viewport presets
// ---------------------------------------------------------------------------
const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Board kanban view — visual snapshots", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`board kanban — ${viewportName} — ${colorScheme}`, async ({ page }) => {
        // Apply viewport and color scheme.
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        // Navigate to kanban view.
        await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/kanban`);

        // Wait for kanban lanes to appear.
        await page.waitForLoadState("networkidle");
        await page
          .locator('[data-testid="kanban-board"]')
          .waitFor({ timeout: 10_000 })
          .catch(() => {
            // Fallback if testid not yet wired.
          });

        await expect(page).toHaveScreenshot(`board-kanban-${viewportName}-${colorScheme}.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
