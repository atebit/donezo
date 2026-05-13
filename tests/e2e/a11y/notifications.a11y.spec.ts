// @ts-expect-error playwright wired in epic 15
import AxeBuilder from "@axe-core/playwright";
// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Notification center a11y spec.
 *
 * AUTH FIXTURE GAP (document for epic 15):
 * Requires a logged-in user. Epic 15 owns seeding + auth fixture wiring.
 * Until then, tests are skipped.
 *
 * To enable in epic 15:
 *  1. Remove test.skip.
 *  2. Wire test.use({ storageState: 'e2e-auth.json' }).
 *
 * Run locally (when auth is wired) with:
 *   pnpm dlx playwright test tests/e2e/a11y/notifications.a11y.spec.ts
 */

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Notification center — axe-core a11y", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  test("notification center has no axe violations", async ({ page }) => {
    await page.goto("/notifications");
    // Wait for the page to fully render (may show empty state or notification list)
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
