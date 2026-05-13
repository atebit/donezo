// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Visual snapshot specs — Workspace Home
 *
 * Captures screenshots at three viewports (mobile, tablet, desktop) in both
 * light and dark color schemes.
 *
 * AUTH FIXTURE GAP (document for epic 15):
 * These tests require a logged-in user with at least one workspace.
 * No auth fixture or seeding mechanism exists yet — that is epic 15's
 * responsibility. Until then, tests are skipped via test.skip(true, ...) but
 * the spec is fully written so epic 15 only needs to:
 *  1. Remove the skip.
 *  2. Replace WORKSPACE_SLUG with seed-script output.
 *  3. Wire test.use({ storageState: 'e2e-auth.json' }) for the auth fixture.
 *
 * Run locally (when auth is wired) with:
 *   pnpm dlx playwright test tests/e2e/visual/workspace-home.visual.spec.ts
 *
 * Snapshots are committed under __snapshots__/ on first run (--update-snapshots).
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const WORKSPACE_SLUG = "e2e-workspace";

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

test.describe("Workspace home — visual snapshots", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`workspace home — ${viewportName} — ${colorScheme}`, async ({ page }) => {
        // Apply viewport and color scheme.
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        // Navigate to workspace home.
        await page.goto(`/w/${WORKSPACE_SLUG}`);

        // Wait for the primary content to stabilise before snapping.
        // The board list or empty state should be visible.
        await page.waitForLoadState("networkidle");

        // Snapshot. First-run will create the baseline; subsequent runs diff.
        await expect(page).toHaveScreenshot(`workspace-home-${viewportName}-${colorScheme}.png`, {
          fullPage: false,
          // Allow minor anti-aliasing / font-rendering variance.
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
