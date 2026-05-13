import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Account settings + theme toggle a11y specs.
 *
 * Auth is handled by the global-setup.ts storageState.
 */

test.describe("Account settings — axe-core a11y", () => {
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
