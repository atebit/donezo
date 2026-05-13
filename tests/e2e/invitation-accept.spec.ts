import { expect, test } from "@playwright/test";

test.describe("invitation accept", () => {
  test.fixme("authed user can accept invitation and land on /", async ({ page }) => {
    // Invitation token must be seeded in advance — requires a second user
    // and a pre-created invitation row. Wiring deferred to follow-up slice.
    // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
    await page.goto("/join/sample-token");
    await expect(page.getByRole("heading", { name: /invited/i })).toBeVisible();
  });
});
