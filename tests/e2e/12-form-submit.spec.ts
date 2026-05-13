// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Epic 12 Slice F — Form view E2E spec.
 *
 * Tests the full form-view flow:
 *   1. Navigate to the form view.
 *   2. Configure form fields (via the inline "Configure fields" button).
 *   3. Fill out and submit the form.
 *   4. Navigate to the table view and verify the new task appears.
 *   5. Reload; confirm form config (fields selection) persisted.
 *
 * Requires:
 *   - Local Supabase running: `pnpm supabase start`
 *   - Dev server: `pnpm dev`
 *   - Seed users set up (see setup requirements below)
 *   - Playwright config pointing at http://localhost:3000
 *
 * Setup requirements (epic 15):
 *   - USER_A (admin), USER_B (member), USER_C (viewer on the board) seeded.
 *   - BOARD has at least one group and one text column.
 *   - A "form" view already exists on the board with `view.config.form.fields = []`
 *     OR the test creates one via the "+ Add view" menu.
 *   - Constants below replaced with seed-script output.
 *
 * All test bodies are fully written. The whole suite is wrapped in
 * `test.skip(true, ...)` per the epic 09–11 pattern so it compiles without
 * a running environment.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const USER_A_EMAIL = "user-a+e2e@donezo.local";
const USER_A_PASSWORD = "test-password-12345";
const USER_C_EMAIL = "user-c+e2e@donezo.local";
const USER_C_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const BOARD_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;
const FORM_VIEW_ID = "REPLACE_WITH_SEED_FORM_VIEW_ID";
const TEXT_COLUMN_NAME = "Title";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// @ts-expect-error playwright wired in epic 15
async function signIn(page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/w/**");
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Epic 12 — Form View", () => {
  test.skip(true, "Requires local Supabase + dev server (wired in epic 15)");

  // -------------------------------------------------------------------------
  // T1: Navigate to the form view
  // -------------------------------------------------------------------------
  test("T1: form page renders at /form?view=<id>", async ({ page }) => {
    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await page.goto(`${BOARD_URL}/form?view=${FORM_VIEW_ID}`);

    // Should not redirect away — stay on /form.
    await expect(page).toHaveURL(/\/form/);
    // Either the empty state or the form itself renders.
    await expect(
      page.locator('[data-testid="form-view-form"], [data-testid="form-no-fields"]'),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T2: Configure fields (member+) and verify they persist
  // -------------------------------------------------------------------------
  test("T2: configure form fields as member; fields persist across reload", async ({ page }) => {
    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await page.goto(`${BOARD_URL}/form?view=${FORM_VIEW_ID}`);

    // Click "Configure fields" button (visible because USER_A is admin/member).
    const configureBtn = page.getByTestId("form-configure-btn");
    await expect(configureBtn).toBeVisible();
    await configureBtn.click();

    // The FormBuilder should be visible.
    await expect(page.locator("text=Configure form fields")).toBeVisible();

    // Toggle on the text column.
    const columnToggle = page.locator(`button[aria-label*="${TEXT_COLUMN_NAME}"]`);
    await columnToggle.click();

    // Wait for the form field to appear in the form.
    await expect(page.locator(`text=${TEXT_COLUMN_NAME}`)).toBeVisible();

    // Reload and verify the field is still there (config persisted via applyDraft + save).
    await page.reload();
    await expect(page.locator(`text=${TEXT_COLUMN_NAME}`)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T3: Fill and submit the form; task appears in the table view
  // -------------------------------------------------------------------------
  test("T3: fill form → submit → new task visible in table view", async ({ page }) => {
    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await page.goto(`${BOARD_URL}/form?view=${FORM_VIEW_ID}`);

    // Ensure the form has at least one field configured.
    const form = page.getByTestId("form-view-form");
    await expect(form).toBeVisible();

    // Fill in the title field (text cell type).
    const titleInput = form.locator('input[type="text"]').first();
    const uniqueTaskTitle = `E2E Form Task ${Date.now()}`;
    await titleInput.fill(uniqueTaskTitle);

    // Submit.
    const submitBtn = page.getByTestId("form-submit-btn");
    await submitBtn.click();

    // Success banner / toast should appear.
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 5000 });

    // Navigate to the table view.
    await page.goto(`${BOARD_URL}/table?view=${FORM_VIEW_ID}`);

    // The new task should appear.
    await expect(page.locator(`text=${uniqueTaskTitle}`)).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // T4: Viewer role can submit the form (Q24 verification)
  // -------------------------------------------------------------------------
  test("T4: viewer-role user can submit the form", async ({ page }) => {
    await signIn(page, USER_C_EMAIL, USER_C_PASSWORD);
    await page.goto(`${BOARD_URL}/form?view=${FORM_VIEW_ID}`);

    const form = page.getByTestId("form-view-form");
    await expect(form).toBeVisible();

    // Viewer should NOT see the "Configure fields" button.
    await expect(page.getByTestId("form-configure-btn")).not.toBeVisible();

    // Fill and submit.
    const input = form.locator('input[type="text"]').first();
    const viewerTaskTitle = `Viewer Task ${Date.now()}`;
    await input.fill(viewerTaskTitle);

    await page.getByTestId("form-submit-btn").click();

    // Success state.
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // T5: Empty state — no groups on the board
  // -------------------------------------------------------------------------
  test("T5: renders NO_GROUPS empty state when board has no groups", async ({ page }) => {
    // This test requires a separate board with no groups — would be seeded separately.
    // Documenting the assertion path here for epic 15 wiring.
    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);

    // Assume BOARD_NO_GROUPS_URL is set up in seed.
    const BOARD_NO_GROUPS_URL = `${BOARD_URL}-no-groups`;
    await page.goto(`${BOARD_NO_GROUPS_URL}/form?view=${FORM_VIEW_ID}`);

    await expect(page.getByTestId("form-no-groups")).toBeVisible();
    await expect(
      page.locator("text=Add a group to this board before accepting submissions."),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // T6: Submit resets the form for another response
  // -------------------------------------------------------------------------
  test("T6: clicking 'Submit another response' resets the form", async ({ page }) => {
    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
    await page.goto(`${BOARD_URL}/form?view=${FORM_VIEW_ID}`);

    const form = page.getByTestId("form-view-form");
    await expect(form).toBeVisible();

    const input = form.locator('input[type="text"]').first();
    await input.fill("First response");

    await page.getByTestId("form-submit-btn").click();

    const successBanner = page.getByTestId("form-success");
    await expect(successBanner).toBeVisible({ timeout: 5000 });

    // Click "Submit another response".
    await page.getByRole("button", { name: /submit another/i }).click();

    // Success banner should be gone and form should be back.
    await expect(successBanner).not.toBeVisible();
    await expect(page.getByTestId("form-view-form")).toBeVisible();

    // Input should be cleared.
    await expect(input).toHaveValue("");
  });
});
