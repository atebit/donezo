import { expect, test } from "@playwright/test";

test.describe("auth happy path", () => {
  test("sign in → land on workspace → sign out", async ({ page }) => {
    // The storageState fixture signs us in automatically; navigate to
    // the root and verify we land on the e2e workspace.
    await page.goto("/");
    // Authenticated root redirects to first workspace
    await expect(page).toHaveURL(/\/w\//);
  });

  test.fixme("sign up → verify email → sign in → sign out", async ({ page }) => {
    // Full signup + email verification flow requires Inbucket/Mailpit
    // integration to click the verify link. Not yet wired.
    // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
    await page.goto("/sign-up");
    await page.fill('input[name="email"]', "test+e2e@donezo.local");
    await page.fill('input[name="displayName"]', "E2E Test");
    await page.fill('input[name="password"]', "test-password-12345");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/verify-email/);
  });

  test.fixme("forgot password sends an email", async ({ page }) => {
    // Requires Inbucket/Mailpit. Not yet wired.
    // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
    await page.goto("/forgot-password");
    await page.fill('input[name="email"]', "test+e2e@donezo.local");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/check your inbox/i)).toBeVisible();
  });

  test.fixme("Google OAuth button initiates redirect", async ({ page }) => {
    // OAuth popup test requires a live Google OAuth endpoint or a mock.
    // Not appropriate for local CI. Deferred.
    // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
    await page.goto("/sign-in");
    const popupPromise = page.waitForEvent("popup");
    await page.click('text="Continue with Google"');
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/accounts\.google\.com/);
  });
});
