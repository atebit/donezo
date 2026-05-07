// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

test.skip(true, "playwright wired in epic 15");

test.describe("auth happy path", () => {
  test("sign up → verify email → sign in → sign out", async ({ page }) => {
    // Signup
    await page.goto("/sign-up");
    await page.fill('input[name="email"]', "test+e2e@donezo.local");
    await page.fill('input[name="displayName"]', "E2E Test");
    await page.fill('input[name="password"]', "test-password-12345");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/verify-email/);

    // (Inbucket / mailpit click of verify link omitted in scaffold; epic 15 wires it.)

    // Sign-in
    await page.goto("/sign-in");
    await page.fill('input[name="email"]', "test+e2e@donezo.local");
    await page.fill('input[name="password"]', "test-password-12345");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Signed in as")).toBeVisible();

    // Sign-out
    await page.click('text="Sign out"');
    await expect(page).toHaveURL(/sign-in/);
  });

  test("forgot password sends an email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.fill('input[name="email"]', "test+e2e@donezo.local");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/check your inbox/i)).toBeVisible();
  });

  test("Google OAuth button initiates redirect", async ({ page }) => {
    await page.goto("/sign-in");
    const popupPromise = page.waitForEvent("popup");
    await page.click('text="Continue with Google"');
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/accounts\.google\.com/);
  });
});
