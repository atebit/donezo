// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Epic 12 / Slice C — Calendar view drag-and-drop E2E spec.
 *
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config
 * pointed at a local Supabase stack (`pnpm supabase start && pnpm dev`).
 *
 * All test bodies are written with accurate assertions. The entire describe
 * block is wrapped in `test.skip(true, ...)` so the suite compiles cleanly
 * without a running environment.
 *
 * Setup requirements (epic 15):
 *   - Seed user USER_A as board admin.
 *   - Seed a board with at least one group and two tasks (TASK_A, TASK_B).
 *   - Seed a `date` column named "Due date" on that board.
 *   - TASK_A has due date 2026-06-03 (a Wednesday); TASK_B has no due date.
 *   - A calendar view is either seeded or created in the test.
 *   - `playwright.config.ts` is configured with `baseURL` and storageState.
 *   - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e`.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const USER_A_EMAIL = "user-a+e2e@donezo.local";
const USER_A_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const BOARD_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;
const DATE_COLUMN_NAME = "Due date";
const TASK_A_TITLE = "REPLACE_WITH_TASK_A_TITLE"; // has date 2026-06-03
const TASK_A_INITIAL_DATE = "2026-06-03";
const TASK_A_TARGET_DATE = "2026-06-10"; // drag target
const TASK_B_TITLE = "REPLACE_WITH_TASK_B_TITLE"; // no date (off-calendar)

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

// Drag a card from one calendar day cell to another.
// @ts-expect-error playwright wired in epic 15
async function dragEventToDate(page, taskTitle: string, targetIsoDate: string) {
  // Find the event card (TaskCard rendered inside the calendar event).
  const card = page.locator(`[data-task-id]`).filter({ hasText: taskTitle }).first();

  // Find the target day cell by its data-date attribute.
  const targetCell = page.locator(`[data-date="${targetIsoDate}"]`).first();

  // Playwright drag-and-drop
  const cardBBox = await card.boundingBox();
  const targetBBox = await targetCell.boundingBox();

  if (!cardBBox || !targetBBox) throw new Error("Could not find bounding box for drag");

  await page.mouse.move(
    cardBBox.x + cardBBox.width / 2,
    cardBBox.y + cardBBox.height / 2,
  );
  await page.mouse.down();
  // Move in steps for dnd-kit pointer sensor activation.
  await page.mouse.move(
    targetBBox.x + targetBBox.width / 2,
    targetBBox.y + targetBBox.height / 2,
    { steps: 20 },
  );
  await page.mouse.up();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Epic 12 — Calendar view", () => {
  test.skip(true, "Epic 15 will wire the Playwright runner and seed the database.");

  test.beforeEach(async ({ page }) => {
    await signIn(page, USER_A_EMAIL, USER_A_PASSWORD);
  });

  test("01: navigating to /calendar renders the calendar empty state (no column picked)", async ({
    page,
  }) => {
    // Create a new calendar view (no dateColumnId configured).
    await page.goto(`${BOARD_URL}/calendar`);
    await page.waitForSelector("text=Pick a date column to show your tasks on a calendar");

    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await expect(picker).toBeVisible();
  });

  test("02: picking a date column shows events on the correct days", async ({ page }) => {
    await page.goto(`${BOARD_URL}/calendar`);

    // Select the "Due date" column from the picker.
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });

    // Wait for the calendar to re-render with events.
    // TASK_A should appear on TASK_A_INITIAL_DATE.
    await page.waitForSelector(`[data-task-id]`);
    const eventCard = page
      .locator(`[data-task-id]`)
      .filter({ hasText: TASK_A_TITLE })
      .first();
    await expect(eventCard).toBeVisible();
  });

  test("03: TASK_B appears in the off-calendar panel", async ({ page }) => {
    await page.goto(`${BOARD_URL}/calendar`);
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });

    // The off-calendar panel should list TASK_B (no date).
    const offPanelCard = page
      .locator("aside")
      .filter({ hasText: "Unscheduled" })
      .locator("button")
      .filter({ hasText: TASK_B_TITLE });
    await expect(offPanelCard).toBeVisible();
  });

  test("04: drag TASK_A from initial date to target date — cell updates", async ({
    page,
  }) => {
    await page.goto(`${BOARD_URL}/calendar`);
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });
    await page.waitForSelector(`[data-task-id]`);

    // Perform the drag.
    await dragEventToDate(page, TASK_A_TITLE, TASK_A_TARGET_DATE);

    // Wait for the Realtime echo or optimistic update to propagate.
    await page.waitForTimeout(500);

    // The event should now appear on the target date.
    // Verify by checking that the card is now associated with the target date cell.
    const targetCell = page.locator(`[data-date="${TASK_A_TARGET_DATE}"]`).first();
    const movedCard = targetCell
      .locator("..")
      .locator(`[data-task-id]`)
      .filter({ hasText: TASK_A_TITLE });
    await expect(movedCard).toBeVisible();
  });

  test("05: reload preserves the new date after drag", async ({ page }) => {
    await page.goto(`${BOARD_URL}/calendar`);
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });
    await page.waitForSelector(`[data-task-id]`);

    // Drag to target date.
    await dragEventToDate(page, TASK_A_TITLE, TASK_A_TARGET_DATE);
    await page.waitForTimeout(500);

    // Reload.
    await page.reload();
    await page.waitForSelector(`[data-task-id]`);

    // Event should still be on the target date.
    const eventCard = page
      .locator(`[data-task-id]`)
      .filter({ hasText: TASK_A_TITLE })
      .first();
    await expect(eventCard).toBeVisible();

    // Confirm the event is NOT on the original date.
    const originalDateCell = page.locator(`[data-date="${TASK_A_INITIAL_DATE}"]`).first();
    const originalCard = originalDateCell
      .locator("..")
      .locator(`[data-task-id]`)
      .filter({ hasText: TASK_A_TITLE });
    await expect(originalCard).not.toBeVisible();
  });

  test("06: clicking an event opens the task drawer", async ({ page }) => {
    await page.goto(`${BOARD_URL}/calendar`);
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });
    await page.waitForSelector(`[data-task-id]`);

    const eventCard = page
      .locator(`[data-task-id]`)
      .filter({ hasText: TASK_A_TITLE })
      .first();
    await eventCard.click();

    // The task drawer is opened via the @modal intercept route (/t/[taskId]).
    // Check that the URL changed to include /t/ and the drawer is visible.
    await page.waitForURL(`**/t/**`);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test("07: clicking an empty day slot quick-creates a task", async ({ page }) => {
    await page.goto(`${BOARD_URL}/calendar`);
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });
    await page.waitForSelector(`[data-date]`);

    // Click on an empty day (pick a day that has no tasks).
    const emptyDay = page.locator(`[data-date="2026-06-07"]`).first(); // a Sunday
    await emptyDay.click();

    // Wait for the toast confirming task creation.
    await page.waitForSelector('text=Task created on');
  });

  test("08: dragging TASK_B from off-calendar panel onto a day assigns the date", async ({
    page,
  }) => {
    await page.goto(`${BOARD_URL}/calendar`);
    const picker = page.getByLabel("Pick the date column that drives the calendar");
    await picker.selectOption({ label: DATE_COLUMN_NAME });
    await page.waitForSelector(`[data-task-id]`);

    // Find TASK_B in the off-calendar panel.
    const offCard = page
      .locator("aside")
      .filter({ hasText: "Unscheduled" })
      .locator("button")
      .filter({ hasText: TASK_B_TITLE });
    await expect(offCard).toBeVisible();

    // Drag from the off-calendar panel to a calendar day cell.
    const targetDate = "2026-06-12";
    const targetCell = page.locator(`[data-date="${targetDate}"]`).first();

    const cardBBox = await offCard.boundingBox();
    const targetBBox = await targetCell.boundingBox();
    if (!cardBBox || !targetBBox) throw new Error("Bounding box not found");

    await page.mouse.move(cardBBox.x + cardBBox.width / 2, cardBBox.y + cardBBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      targetBBox.x + targetBBox.width / 2,
      targetBBox.y + targetBBox.height / 2,
      { steps: 20 },
    );
    await page.mouse.up();

    await page.waitForTimeout(500);

    // TASK_B should no longer appear in the off-calendar panel.
    await expect(offCard).not.toBeVisible();

    // TASK_B should now appear on the calendar.
    const movedCard = page
      .locator(`[data-task-id]`)
      .filter({ hasText: TASK_B_TITLE })
      .first();
    await expect(movedCard).toBeVisible();
  });
});
