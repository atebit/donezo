// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

test.describe("invitation accept", () => {
  test.skip("authed user can accept invitation and land on /", async ({ page }) => {
    // TODO: epic 15 wires Playwright runner + auth fixtures.
    await page.goto("/join/sample-token");
    await expect(page.getByRole("heading", { name: /invited/i })).toBeVisible();
  });
});
