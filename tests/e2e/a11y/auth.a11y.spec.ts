// @ts-expect-error playwright wired in epic 15
import AxeBuilder from "@axe-core/playwright";
// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Auth page a11y specs (sign-in, sign-up).
 *
 * These pages are anonymous — no auth fixture required.
 *
 * Runner wiring (config, baseURL, retries) is owned by epic 15.
 * Run locally with: pnpm dlx playwright test tests/e2e/a11y/auth.a11y.spec.ts
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
