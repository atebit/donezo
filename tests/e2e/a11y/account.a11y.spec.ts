// @ts-expect-error playwright wired in epic 15
import AxeBuilder from "@axe-core/playwright";
// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Account settings + theme toggle a11y specs.
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
 *   pnpm dlx playwright test tests/e2e/a11y/account.a11y.spec.ts
 */

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Account settings — axe-core a11y", () => {
  // Skip all tests until epic 15 wires the Playwright runner and auth fixtures.
  test.skip(true, "Auth fixture not wired — epic 15 owns seeding + runner config.");

  test("account settings page has no axe violations", async ({ page }) => {
    await page.goto("/account");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("notification settings page has no axe violations", async ({ page }) => {
    await page.goto("/account/notifications");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("theme toggle is accessible (page-level axe check)", async ({ page }) => {
    // The theme toggle lives in the user menu in the sidebar topbar area.
    // A page-level axe scan covers it.
    await page.goto("/account");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
