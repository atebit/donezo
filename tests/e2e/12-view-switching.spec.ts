import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

/**
 * Epic 12 — Cross-kind view-switching E2E spec.
 *
 * Spec stub — runner wired in Epic 15. Requires seeded users + Playwright config
 * with an authenticated browser context pointed at a local Supabase stack.
 *
 * Tests cover G.1 from the Slice G spec:
 *   T1: /b/<id> → redirect → /<kind>?view=<id>
 *   T2: table → kanban (switchView); URL becomes /kanban?view=<id>
 *   T3: kanban → table (switchView); persisted filter state preserved;
 *       draft state cleared (per Slice A contract)
 *   T4: direct load of /calendar?view=<id> renders with dateColumnId
 *
 * Setup requirements (epic 15):
 *   - Seed user USER_A as board admin in the Supabase test DB.
 *   - Seed a board with:
 *     - One shared "Main table" view  (TABLE_VIEW_ID, kind=table)
 *     - One kanban view               (KANBAN_VIEW_ID, kind=kanban, groupByColumnId set)
 *     - One calendar view             (CALENDAR_VIEW_ID, kind=calendar, dateColumnId set)
 *     - A status column               (STATUS_COLUMN_ID) used by the kanban view
 *     - A date column                 (DATE_COLUMN_ID)  used by the calendar view
 *     - At least two groups and three tasks
 *   - Configure playwright.config.ts with baseURL and storageState for USER_A.
 *   - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e`.
 *
 * All test bodies are fully written with assertions based on the UI contract.
 * The entire describe block is wrapped in `test.skip(true, ...)` per the
 * epic 09/10/11/12 convention so the suite compiles cleanly without a running
 * environment.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const _USER_A_EMAIL = "user-a+e2e@donezo.local";
const _USER_A_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const BOARD_ID = E2E_BOARD_ID;
const TABLE_VIEW_ID = "REPLACE_WITH_SEED_TABLE_VIEW_ID";
const KANBAN_VIEW_ID = "REPLACE_WITH_SEED_KANBAN_VIEW_ID";
const CALENDAR_VIEW_ID = "REPLACE_WITH_SEED_CALENDAR_VIEW_ID";

// URLs
const BOARD_ROOT_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;
const TABLE_URL = `${BOARD_ROOT_URL}/table?view=${TABLE_VIEW_ID}`;
const KANBAN_URL = `${BOARD_ROOT_URL}/kanban?view=${KANBAN_VIEW_ID}`;
const CALENDAR_URL = `${BOARD_ROOT_URL}/calendar?view=${CALENDAR_VIEW_ID}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function _signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

// ---------------------------------------------------------------------------
// Tests (all skipped until epic 15 e2e runner is wired)
// ---------------------------------------------------------------------------

test.describe("Epic 12 — cross-kind view switching", () => {
  test.beforeEach(async () => {
    // Auth handled by global storageState
  });

  /**
   * T1: Opening `/w/<slug>/b/<id>` (bare board route, no kind segment)
   *     triggers the index page redirect to the last-used view's kind route.
   *
   *     Contract: board/page.tsx calls loadBoardSnapshot, resolves active view,
   *     and calls redirect() to /<kind>?view=<id>.
   */
  test.fixme("T1: bare board URL redirects to per-kind route with ?view param", async ({
    page,
  }) => {
    // Navigate to the bare board index route.
    await page.goto(BOARD_ROOT_URL);

    // Wait for the redirect to settle.
    await page.waitForLoadState("networkidle");

    // The URL must have moved to a per-kind route (table, kanban, etc.)
    // with a ?view= param appended.
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/b\/[^/]+\/(table|kanban|calendar|timeline|dashboard|form)/);
    expect(currentUrl).toContain("?view=");

    // The board layout must be visible (view tabs, board header).
    await expect(
      page.locator('[data-testid="view-tabs"]').or(page.locator('[role="tablist"]')),
    ).toBeVisible();
  });

  /**
   * T2: From the table view, switching to a kanban view via the view tabs
   *     or AddViewMenu updates the URL to /kanban?view=<kanban-view-id>.
   *
   *     Contract: useBoardView.switchView() clears draft, determines target
   *     kind from the target view row, and calls router.push for cross-kind.
   */
  test.fixme("T2: switchView from table → kanban updates URL to /kanban?view=<id>", async ({
    page,
  }) => {
    // Start on the table view.
    await page.goto(TABLE_URL);
    await page.waitForLoadState("networkidle");

    // The current URL should be on the table kind.
    expect(page.url()).toContain("/table");
    expect(page.url()).toContain(`view=${TABLE_VIEW_ID}`);

    // Find the kanban view tab and click it.
    // ViewTabs renders tabs as buttons with the view name; the kanban view is
    // seeded with a recognisable name (e.g. "Kanban view").
    const kanbanTab = page
      .locator(`[data-testid="view-tab-${KANBAN_VIEW_ID}"]`)
      .or(page.getByRole("tab", { name: /kanban/i }));
    await kanbanTab.click();

    // Wait for URL to transition.
    await page.waitForURL(`**/kanban?view=${KANBAN_VIEW_ID}**`, { timeout: 5000 });

    // Verify the kanban board is visible (at minimum: the kanban container).
    // KanbanBoard renders either the picker (no groupByColumnId) or the lane list.
    // Since KANBAN_VIEW_ID is seeded with groupByColumnId set, lanes should appear.
    const kanbanContainer = page.locator('[data-testid="kanban-board"]').or(
      page.locator(".flex.flex-row.gap-4"), // kanban horizontal scroll container
    );
    await expect(kanbanContainer).toBeVisible({ timeout: 5000 });
  });

  /**
   * T3: From the kanban view, switching back to the table view restores the
   *     table's URL (/table?view=<table-view-id>).
   *
   *     Persisted filter state (stored in view.config, not URL draft) is
   *     preserved — the saved config on the view row is the same.
   *
   *     Draft state (unsaved URL params like ?f=, ?s=) is cleared on switchView
   *     per Slice A's switchView contract.
   */
  test.fixme("T3: switchView kanban → table restores table URL; draft state cleared", async ({
    page,
  }) => {
    // Start on the kanban view with a filter draft in the URL
    // (simulating a user who navigated to kanban with an unsaved filter).
    const kanbanWithDraft = `${KANBAN_URL}&f=eyJraW5kIjoiYW5kIiwiY2xhdXNlcyI6W119`; // base64 "and" filter
    await page.goto(kanbanWithDraft);
    await page.waitForLoadState("networkidle");

    // Confirm the draft filter param is present.
    expect(page.url()).toContain("&f=");

    // Click the table view tab.
    const tableTab = page
      .locator(`[data-testid="view-tab-${TABLE_VIEW_ID}"]`)
      .or(page.getByRole("tab", { name: /main table|table/i }));
    await tableTab.click();

    // Wait for URL to transition to the table kind.
    await page.waitForURL(`**/table?view=${TABLE_VIEW_ID}**`, { timeout: 5000 });

    // The draft filter param must NOT be present in the new URL.
    // switchView calls setDraftConfig(null) which clears ?f= / ?s= etc.
    expect(page.url()).not.toContain("&f=");
    expect(page.url()).not.toContain("?f=");

    // The table view must be visible.
    const boardTable = page
      .locator('[data-testid="board-table"]')
      .or(page.locator("table").or(page.locator('[role="grid"]')));
    await expect(boardTable).toBeVisible({ timeout: 5000 });
  });

  /**
   * T4: Direct-loading /calendar?view=<calendar-view-id> renders the calendar
   *     and respects the seeded dateColumnId (events appear on the calendar
   *     rather than the "pick a column" empty state).
   *
   *     Contract: CalendarView reads effective.calendar.dateColumnId from the
   *     store (which is hydrated from the view row's config on page load).
   */
  test.fixme("T4: direct load of /calendar?view=<id> renders calendar with dateColumnId", async ({
    page,
  }) => {
    // Navigate directly to the calendar view (CALENDAR_VIEW_ID is seeded with
    // dateColumnId set, so the calendar should render with events, not the empty state).
    await page.goto(CALENDAR_URL);
    await page.waitForLoadState("networkidle");

    // The "Pick a date column" empty-state text must NOT be visible.
    const emptyState = page.getByText("Pick a date column to show your tasks on a calendar");
    await expect(emptyState).not.toBeVisible({ timeout: 5000 });

    // The react-big-calendar container must be visible.
    // react-big-calendar renders a container with the class "rbc-calendar".
    const calendar = page.locator(".rbc-calendar");
    await expect(calendar).toBeVisible({ timeout: 5000 });

    // The view's dateColumnId should be shown in the CalendarDateColumnPicker
    // (it should have a non-empty selection — not the "No column" placeholder).
    const columnPicker = page.getByLabel("Pick the date column that drives the calendar");
    await expect(columnPicker).toBeVisible();
    // The picker should NOT show the empty/default placeholder.
    await expect(columnPicker).not.toHaveValue("");
  });
});
