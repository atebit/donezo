import { expect, test } from "@playwright/test";

/**
 * Visual snapshot specs — Account Settings
 *
 * BASELINE NOTE: Baselines must be generated in Linux/Docker for font determinism.
 * See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
 *
 * Auth is handled by global-setup.ts storageState.
 */

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

test.describe("Account settings — visual snapshots", () => {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ["light", "dark"] as const) {
      test.fixme(`account settings — ${viewportName} — ${colorScheme}`, async ({ page }) => {
        // test.fixme: baselines require Linux Docker environment for font determinism.
        // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme });

        await page.goto("/account");
        await page.waitForLoadState("networkidle");
        await page
          .locator('[data-testid="account-settings"], form')
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {});

        await expect(page).toHaveScreenshot(`account-settings-${viewportName}-${colorScheme}.png`, {
          fullPage: false,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
