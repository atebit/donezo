// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Visual snapshot specs — Account Settings
 *
 * Captures screenshots at three viewports (mobile, tablet, desktop) in both
 * light and dark color schemes.
 *
 * AUTH FIXTURE GAP (document for epic 15):
 * These tests require a logged-in user. No auth fixture or seeding mechanism
 * exists yet — that is epic 15's responsibility. Until then, tests are
 * skipped via test.skip(true, ...) but the spec is fully written so
 * epic 15 only needs to:
 *  1. Remove the skip.
 *  2. Wire test.use({ storageState: 'e2e-auth.json' }) for the auth fixture.
 *
 * Run locally (when auth is wired) with:
 *   pnpm dlx playwright test tests/e2e/visual/account-settings.visual.spec.ts
 *
 * Snapshots are committed under __snapshots__/ on first run (--update-snapshots).
 */

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

test.describe("Account settings — visual snapshots", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`account settings — ${viewportName} — ${colorScheme}`, async ({ page }) => {
        // Apply viewport and color scheme.
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        // Navigate to account settings.
        await page.goto("/account");

        // Wait for the settings form to be visible.
        await page.waitForLoadState("networkidle");
        await page
          .locator('[data-testid="account-settings"], form')
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {
            // Fallback if testid not yet wired.
          });

        await expect(page).toHaveScreenshot(`account-settings-${viewportName}-${colorScheme}.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
