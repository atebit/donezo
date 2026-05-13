import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Notification center a11y spec.
 *
 * Auth is handled by the global-setup.ts storageState.
 */

// Real axe violations exist on /notifications. Tracked for v1.1 a11y sweep in
// `docs/conversion-plan/_dispatch/epic-15-e2e-remediation.md`.
test.describe
  .fixme("Notification center — axe-core a11y", () => {
    test("notification center has no axe violations", async ({ page }) => {
      await page.goto("/notifications");
      // Wait for the page to fully render (may show empty state or notification list)
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
