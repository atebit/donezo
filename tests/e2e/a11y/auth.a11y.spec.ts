import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Auth page a11y specs (sign-in, sign-up, forgot-password).
 *
 * These pages are anonymous — no auth fixture required.
 * The storageState fixture from global-setup.ts is applied but these
 * pages redirect unauthenticated users, so cookies are ignored here.
 */

test.describe("Auth pages — axe-core a11y", () => {
  test("sign-in page has no axe violations", async ({ page }) => {
    await page.goto("/sign-in");
    // Wait for the form to be visible before running axe
    await expect(page.locator("form")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("sign-up page has no axe violations", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator("form")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("forgot-password page has no axe violations", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator("form")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
