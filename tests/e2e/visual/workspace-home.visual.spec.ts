import { expect, test } from "@playwright/test";
import { E2E_WORKSPACE_SLUG } from "../fixtures/seed";

/**
 * Visual snapshot specs — Workspace Home
 *
 * BASELINE NOTE: Baselines must be generated in Linux/Docker for font determinism.
 * See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
 *
 * Auth is handled by global-setup.ts storageState.
 */

const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

test.describe("Workspace home — visual snapshots", () => {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ["light", "dark"] as const) {
      test.fixme(`workspace home — ${viewportName} — ${colorScheme}`, async ({ page }) => {
        // test.fixme: baselines require Linux Docker environment for font determinism.
        // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        await page.goto(`/w/${WORKSPACE_SLUG}`);
        await page.waitForLoadState("networkidle");

        await expect(page).toHaveScreenshot(`workspace-home-${viewportName}-${colorScheme}.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
