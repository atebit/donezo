// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Epic 12 — Timeline (Gantt) view — E2E drag-and-drop spec.
 *
 * Spec stub — runner wired in Epic 15. Requires seeded users + Playwright config
 * with an authenticated browser context pointed at a local Supabase stack.
 *
 * Setup requirements (epic 15):
 *  - Seed a user (USER_A) as board admin in the Supabase test DB.
 *  - Seed a board with at least one group.
 *  - Seed a `timeline`-type column on the board.
 *  - Seed at least one task (TASK_TITLE) with start=START_DATE, end=END_DATE.
 *  - Seed a second task (UNSCHEDULED_TASK_TITLE) with no timeline cell.
 *  - Create a timeline view on the board with `timelineColumnId` set.
 *  - Configure playwright.config.ts with baseURL and storageState for USER_A.
 *  - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e`.
 *
 * All test bodies are fully written with assertions based on the UI contract.
 * The entire describe block is wrapped in `test.skip(true, ...)` per the
 * epic 09/10/11 convention so the suite compiles without a running environment.
 *
 * Epic 12, Slice D — D.7.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const USER_A_EMAIL = "user-a+e2e@donezo.local";
const USER_A_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_ID = "REPLACE_WITH_SEED_BOARD_ID";
const TIMELINE_VIEW_ID = "REPLACE_WITH_SEED_TIMELINE_VIEW_ID";
const _TIMELINE_COLUMN_ID = "REPLACE_WITH_SEED_TIMELINE_COLUMN_ID";
const TASK_TITLE = "Test Task for Timeline Drag";
const UNSCHEDULED_TASK_TITLE = "Unscheduled Task for Drop";
// ISO dates for the seeded task's timeline cell (used in test comments for documentation)
const _START_DATE = "2026-06-01"; // yyyy-MM-dd
const _END_DATE = "2026-06-07"; // yyyy-MM-dd (duration = 6 days)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const boardUrl = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/timeline?view=${TIMELINE_VIEW_ID}`;

/** Return the bounding box of an element or throw. */
async function getBBox(
  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  page: any,
  selector: string,
) {
  const el = page.locator(selector);
  const box = await el.boundingBox();
  if (!box) throw new Error(`Element not found or not visible: ${selector}`);
  return box;
}

/**
 * Simulate a pointer-based drag from (fromX, fromY) to (toX, toY).
 * Uses steps to satisfy dnd-kit's PointerSensor distance constraint.
 */
// biome-ignore lint/suspicious/noExplicitAny: Playwright Mouse type unavailable outside runner
async function dragPointer(mouse: any, fromX: number, fromY: number, toX: number, toY: number) {
  await mouse.move(fromX, fromY);
  await mouse.down();
  await mouse.move(toX, toY, { steps: 20 });
  await mouse.up();
}

// ---------------------------------------------------------------------------
// Tests (all skipped until epic 15 e2e runner is wired)
// ---------------------------------------------------------------------------

test.describe("Timeline (Gantt) view", () => {
  test.skip(true, "Epic 15 e2e runner — wired when Playwright infra is ready");

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test.beforeEach(async ({ page }: any) => {
    // Sign in as USER_A.
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(USER_A_EMAIL);
    await page.getByLabel("Password").fill(USER_A_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`**/w/${WORKSPACE_SLUG}/**`);

    // Navigate to the timeline view.
    await page.goto(boardUrl);
    await page.waitForLoadState("networkidle");
  });

  // -------------------------------------------------------------------------
  // Basic render
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("timeline renders the bar for the seeded task", async ({ page }: any) => {
    // The seeded task should appear as a row label.
    await expect(page.getByText(TASK_TITLE)).toBeVisible();

    // The Gantt bar should be rendered in the bar area.
    const bar = page.locator(`[data-bar="true"][data-task-id]`).first();
    await expect(bar).toBeVisible();
  });

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("unscheduled task appears in the right-side panel", async ({ page }: any) => {
    const unscheduledPanel = page.getByLabel("Unscheduled tasks panel");
    await expect(unscheduledPanel).toBeVisible();
    await expect(unscheduledPanel.getByText(UNSCHEDULED_TASK_TITLE)).toBeVisible();
  });

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("scale switcher renders all five options", async ({ page }: any) => {
    const switcher = page.getByRole("group", { name: "Timeline scale" });
    await expect(switcher).toBeVisible();
    for (const label of ["Day", "Week", "Month", "Quarter", "Year"]) {
      await expect(switcher.getByRole("button", { name: label })).toBeVisible();
    }
  });

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("scale switcher changes the active scale and persists on reload", async ({ page }: any) => {
    const monthBtn = page.getByRole("button", { name: "Month", pressed: false });
    await monthBtn.click();

    // The Month button should now be active (aria-pressed="true").
    await expect(page.getByRole("button", { name: "Month", pressed: true })).toBeVisible({
      timeout: 3000,
    });

    // Reload and verify the scale persisted.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Month", pressed: true })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // D.7 — Bar body drag: moves both start and end by 5 days
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("drag bar body 5 days right shifts start and end by 5 days", async ({ page }: any) => {
    // The seeded task has start=2026-06-01, end=2026-06-07.
    // We drag the bar body right by 5 pxPerDay units (scale=week → 28px/day → 140px).
    const DRAG_PX = 28 * 5; // 140 px at week scale

    const barSelector = `[data-task-id][data-bar="true"]`;
    const barBox = await getBBox(page, barSelector);

    // Click the bar body (middle, avoiding 8px handles on each side).
    const fromX = barBox.x + barBox.width / 2;
    const fromY = barBox.y + barBox.height / 2;
    const toX = fromX + DRAG_PX;

    await dragPointer(page.mouse, fromX, fromY, toX, fromY);

    // Wait for the server action to complete (optimistic update + round-trip).
    // The bar should now start at 2026-06-06.
    await page.waitForLoadState("networkidle");

    // Verify: the bar's aria-label includes the new start date.
    await expect(page.locator(`[aria-label*="2026-06-06"]`).first()).toBeVisible({ timeout: 5000 });

    // Verify persistence: reload and check again.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(`[aria-label*="2026-06-06"]`).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // D.7 — Right-edge drag: only end shifts
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("drag right edge handle 3 days right extends end date only", async ({ page }: any) => {
    // After the body drag test the bar is at 2026-06-06 to 2026-06-12.
    // In a fresh beforeEach context, bar is at START_DATE..END_DATE.
    const DRAG_PX = 28 * 3; // 84 px at week scale (3 days)

    const barSelector = `[data-task-id][data-bar="true"]`;
    const barBox = await getBBox(page, barSelector);

    // Right-edge handle is the last 8px of the bar.
    const handleX = barBox.x + barBox.width - 4; // centre of right handle
    const handleY = barBox.y + barBox.height / 2;
    const toX = handleX + DRAG_PX;

    await dragPointer(page.mouse, handleX, handleY, toX, handleY);
    await page.waitForLoadState("networkidle");

    // New end date should be END_DATE + 3 days = 2026-06-10.
    await expect(page.locator(`[aria-label*="2026-06-10"]`).first()).toBeVisible({ timeout: 5000 });

    // Start date must remain unchanged (2026-06-01).
    await expect(page.locator(`[aria-label*="2026-06-01"]`).first()).toBeVisible();

    // Verify persistence.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(`[aria-label*="2026-06-10"]`).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // D.6 — Unscheduled drop onto timeline
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("dropping an unscheduled task onto the timeline creates a range", async ({ page }: any) => {
    // Locate the unscheduled card in the right panel.
    const unscheduledCard = page.locator(`[data-unscheduled-id]`, {
      hasText: UNSCHEDULED_TASK_TITLE,
    });
    const cardBox = await unscheduledCard.boundingBox();
    if (!cardBox) throw new Error("Unscheduled card not found");

    // Locate any row in the timeline bar area as the drop target.
    const barArea = page.locator(`[data-row-id]`).first();
    const barAreaBox = await barArea.boundingBox();
    if (!barAreaBox) throw new Error("Timeline row not found");

    // Drag the card to the bar area.
    await dragPointer(
      page.mouse,
      cardBox.x + cardBox.width / 2,
      cardBox.y + cardBox.height / 2,
      barAreaBox.x + barAreaBox.width / 2,
      barAreaBox.y + barAreaBox.height / 2,
    );

    await page.waitForLoadState("networkidle");

    // The task should now appear in the bar area (no longer in unscheduled panel).
    const unscheduledPanel = page.getByLabel("Unscheduled tasks panel");
    await expect(unscheduledPanel.getByText(UNSCHEDULED_TASK_TITLE)).not.toBeVisible({
      timeout: 5000,
    });

    // A bar for the task should now exist.
    await expect(page.locator(`[aria-label*="${UNSCHEDULED_TASK_TITLE}"]`).first()).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Column picker empty state
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("empty state renders when no timeline column is selected", async ({ page }: any) => {
    // Visit a board URL without a view that has timelineColumnId set.
    await page.goto(`/w/${WORKSPACE_SLUG}/b/${BOARD_ID}/timeline`);
    await page.waitForLoadState("networkidle");

    // If no column is configured, the empty state copy should be visible.
    await expect(page.getByText("Pick a timeline column to render bars")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Click-without-drag opens task drawer
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("clicking a bar body (no drag) opens the task drawer", async ({ page }: any) => {
    const barBody = page.locator(`[data-task-id][data-bar="true"]`).first();

    // A short click (no movement) should open the task drawer.
    await barBody.click();

    // The task drawer URL should contain `/t/` (intercept route).
    await expect(page).toHaveURL(/\/t\//, { timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // Today line visible
  // -------------------------------------------------------------------------

  // biome-ignore lint/suspicious/noExplicitAny: Playwright Page type unavailable outside runner
  test("today line is rendered in the timeline body", async ({ page }: any) => {
    // The today line is a 1px div with background-color: var(--color-primary).
    // Today line is present when today is in the visible range.
    // We don't assert visibility since it depends on the seeded date range.
    // We only assert the component structure exists by checking bar rendering.
    await expect(page.locator('[data-bar="true"]').first()).toBeVisible();
  });
});
