// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Epic 12 — Form view — E2E form submit spec.
 *
 * Spec stub — runner wired in Epic 15. Requires seeded users + Playwright config
 * with an authenticated browser context pointed at a local Supabase stack.
 *
 * Setup requirements (epic 15):
 *  - Seed a user (USER_A) as board member in the Supabase test DB.
 *  - Seed a board with at least one group.
 *  - Seed a "Title" text column and a "Status" status column on the board.
 *  - Create a form view on the board configured with those two columns.
 *  - Configure playwright.config.ts with baseURL and storageState for USER_A.
 *  - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e`.
 *
 * All test bodies are fully written with assertions based on the UI contract.
 * The entire describe block is wrapped in `test.skip(true, ...)` per the
 * epic 09/10/11 convention so the suite compiles without a running environment.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const USER_A_EMAIL = "user-a+e2e@donezo.local";
const USER_A_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const FORM_VIEW_ID = "REPLACE_WITH_SEED_FORM_VIEW_ID";
const TABLE_VIEW_ID = "REPLACE_WITH_SEED_TABLE_VIEW_ID";
// biome-ignore lint/correctness/noUnusedVariables: seed constants — wired in epic 15
const TITLE_COLUMN_ID = "REPLACE_WITH_SEED_TITLE_COLUMN_ID";
// biome-ignore lint/correctness/noUnusedVariables: seed constants — wired in epic 15
const STATUS_COLUMN_ID = "REPLACE_WITH_SEED_STATUS_COLUMN_ID";

const TASK_TITLE = "E2E Form Submission Task";
// biome-ignore lint/correctness/noUnusedVariables: used in future test assertions — wired in epic 15
const STATUS_LABEL = "Done";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formUrl = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/form?view=${FORM_VIEW_ID}`;
const tableUrl = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/table?view=${TABLE_VIEW_ID}`;

// ---------------------------------------------------------------------------
// Tests (all skipped until epic 15 e2e runner is wired)
// ---------------------------------------------------------------------------

test.describe("Form view — submit creates task", () => {
  test.skip(true, "Epic 15 e2e runner — wired when Playwright infra is ready");

  test.beforeEach(async ({ page }) => {
    // Authenticate via UI login (or use storageState pre-auth from epic 15 setup).
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(USER_A_EMAIL);
    await page.getByLabel("Password").fill(USER_A_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/w\//);
  });

  // -------------------------------------------------------------------------
  // Test 1: Form renders configured fields
  // -------------------------------------------------------------------------
  test("renders form with configured fields", async ({ page }) => {
    await page.goto(formUrl);

    // Wait for the form to mount.
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();

    // Both configured fields should be present.
    await expect(page.getByText("Title")).toBeVisible();
    await expect(page.getByText("Status")).toBeVisible();

    // The submit button should use the configured label.
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 2: Empty-state when no fields configured
  // -------------------------------------------------------------------------
  test("shows empty state when no fields configured", async ({ page }) => {
    // Navigate to a form view with no fields (assumes a separate view seeded with 0 fields).
    const emptyFormViewId = "REPLACE_WITH_SEED_EMPTY_FORM_VIEW_ID";
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/form?view=${emptyFormViewId}`);

    await expect(page.getByText("Configure form fields from the view menu.")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 3: Submit fills title field and submits successfully
  // -------------------------------------------------------------------------
  test("fills title field and submits the form", async ({ page }) => {
    await page.goto(formUrl);
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();

    // Fill in the Title field (text input inside the FormField container).
    const titleInput = page.locator(`[aria-label="Edit text"]`).first();
    await titleInput.fill(TASK_TITLE);
    // Commit the value by blurring (text editor commits on blur).
    await titleInput.blur();

    // Submit the form.
    await page.getByRole("button", { name: "Submit" }).click();

    // Success message should appear.
    await expect(page.getByText("Submitted!")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 4: Submitted task is visible in the table view
  // -------------------------------------------------------------------------
  test("submitted task is visible in the table view", async ({ page }) => {
    // First, submit the form.
    await page.goto(formUrl);
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();

    const titleInput = page.locator(`[aria-label="Edit text"]`).first();
    await titleInput.fill(TASK_TITLE);
    await titleInput.blur();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Submitted!")).toBeVisible();

    // Navigate to the table view.
    await page.goto(tableUrl);

    // The task should appear in the table.
    await expect(page.getByText(TASK_TITLE)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 5: Required field validation prevents submission
  // -------------------------------------------------------------------------
  test("blocks submission when required field is empty", async ({ page }) => {
    await page.goto(formUrl);
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();

    // Do NOT fill in the title field (assume it is marked required).
    // Attempt to submit.
    await page.getByRole("button", { name: "Submit" }).click();

    // A toast error should appear mentioning the required field.
    await expect(page.getByText(/required/i)).toBeVisible();

    // The form should still be visible (not navigated away).
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 6: "Submit another response" resets the form
  // -------------------------------------------------------------------------
  test("submit-another-response button resets the form", async ({ page }) => {
    await page.goto(formUrl);
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();

    const titleInput = page.locator(`[aria-label="Edit text"]`).first();
    await titleInput.fill(TASK_TITLE);
    await titleInput.blur();
    await page.getByRole("button", { name: "Submit" }).click();

    // Success state shows the "Submit another response" button.
    await expect(page.getByRole("button", { name: "Submit another response" })).toBeVisible();
    await page.getByRole("button", { name: "Submit another response" }).click();

    // Form should be back to the initial empty state.
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 7: FormBuilder opens via "Configure form" in the view dropdown
  // -------------------------------------------------------------------------
  test("configure form opens the form builder", async ({ page }) => {
    await page.goto(formUrl);
    await expect(page.getByRole("form", { name: "Form view" })).toBeVisible();

    // Click the view tab dropdown chevron for the form view.
    // (Assumes the view tab for the form view is visible and has a chevron button.)
    const viewChevron = page.getByRole("button", { name: /chevron|dropdown/i }).first();
    await viewChevron.click();

    // "Configure form" menu item should appear.
    await expect(page.getByRole("menuitem", { name: "Configure form" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Configure form" }).click();

    // Form builder dialog/panel should open.
    await expect(page.getByRole("dialog", { name: "Configure form" })).toBeVisible();

    // Left pane should show columns.
    await expect(page.getByText("Fields")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 8: FormBuilder persists field toggle
  // -------------------------------------------------------------------------
  test("form builder toggles a field and persists", async ({ page }) => {
    await page.goto(formUrl);

    // Open the form builder.
    const viewChevron = page.getByRole("button", { name: /chevron|dropdown/i }).first();
    await viewChevron.click();
    await page.getByRole("menuitem", { name: "Configure form" }).click();
    await expect(page.getByRole("dialog", { name: "Configure form" })).toBeVisible();

    // Find the Status column checkbox and toggle it off if it was on.
    const statusCheckbox = page.getByLabel(`Include Status`);
    const wasChecked = await statusCheckbox.isChecked();
    await statusCheckbox.click();

    // Close the builder.
    await page.getByRole("button", { name: "Close form builder" }).click();

    // The form should now not show the Status field (if we unchecked it).
    if (wasChecked) {
      await expect(page.getByText("Status")).not.toBeVisible();
    } else {
      await expect(page.getByText("Status")).toBeVisible();
    }
  });
});
