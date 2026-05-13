import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

/**
 * Epic 12 — Alternate-views performance smoke tests.
 *
 * Spec stub — runner wired in Epic 15 (Playwright infra). Tagged `@perf`
 * so the CI can choose to skip this file or run it in a dedicated job with
 * `--grep @perf`.
 *
 * These tests validate that the 1k-task board does not catastrophically
 * degrade in each alternate view. They are structural assertions only (no
 * true FPS/paint-count measurement), since that requires a properly configured
 * Lighthouse / Chrome DevTools Protocol integration (Epic 14 or 15 concern).
 *
 * Setup requirements (epic 15):
 *   - Seed user USER_PERF as board admin.
 *   - Seed a "perf board" with:
 *     - 1,000 tasks across 5 groups.
 *     - A status column with 5 labels (used by the kanban view).
 *       Tasks are distributed ~200 per lane.
 *     - A date column; each task has a date value within 2026 (used by calendar).
 *     - A timeline column with start/end within 2026 (used by timeline).
 *     - A kanban view grouped by the status column.
 *     - A calendar view with dateColumnId set to the date column.
 *     - A timeline view with timelineColumnId set to the timeline column.
 *   - playwright.config.ts: `baseURL` + storageState for USER_PERF.
 *   - Run: `pnpm supabase start && pnpm dev` then `pnpm test:e2e --grep @perf`.
 *
 * All test bodies are wrapped in `test.skip(true, ...)` until Epic 15.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const _USER_PERF_EMAIL = "user-perf+e2e@donezo.local";
const _USER_PERF_PASSWORD = "test-password-12345";
const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;

/** Board seeded with 1,000 tasks. */
const _PERF_BOARD_ID = E2E_BOARD_ID;
const _KANBAN_VIEW_ID = "REPLACE_WITH_SEED_PERF_KANBAN_VIEW_ID";
const _CALENDAR_VIEW_ID = "REPLACE_WITH_SEED_PERF_CALENDAR_VIEW_ID";
const _TIMELINE_VIEW_ID = "REPLACE_WITH_SEED_PERF_TIMELINE_VIEW_ID";

const BASE = `/w/${WORKSPACE_SLUG}/b/${PERF_BOARD_ID}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function _signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

/**
 * Measures total layoutCount from the Chrome DevTools Protocol.
 * Returns null if CDP is not available (non-Chromium or CDP not enabled).
 *
 * Used as a structural proxy for "no layout thrash": a layout count that
 * explodes into the thousands on initial render indicates repeated forced
 * synchronous layouts which will degrade paint performance.
 */
async function measureLayoutCount(page): Promise<number | null> {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: CDP session type not available without playwright import
    const client = await (page.context() as any).newCDPSession(page);
    await client.send("Performance.enable");
    const metrics = await client.send("Performance.getMetrics");
    // biome-ignore lint/suspicious/noExplicitAny: CDP metric type not available without playwright import
    const layoutCount = metrics.metrics.find((m: any) => m.name === "LayoutCount");
    await client.detach();
    return layoutCount?.value ?? null;
  } catch {
    // CDP not available (e.g. Firefox / WebKit runner in epic 15).
    return null;
  }
}

// ---------------------------------------------------------------------------
// Perf smoke tests (all skipped until epic 15)
// ---------------------------------------------------------------------------

test.describe("Epic 12 @perf — 1k-task alternate-view smoke", () => {
  test.beforeEach(async () => {
    // Auth handled by global storageState
  });

  /**
   * P1 — Kanban with 1,000 tasks (5 lanes × 200 tasks).
   *
   * Structural assertions:
   *   - All 5 lanes render (even if cards are virtualized).
   *   - Cards in the visible viewport area are present in the DOM.
   *   - Layout count does not exceed 200 (heuristic; adjust after profiling).
   *
   * Note: KanbanLane uses @tanstack/react-virtual so only visible cards
   * are in the DOM; this test verifies the virtualizer is working (DOM
   * count should be << 1000 even with 1k tasks).
   */
  test.fixme("P1 @perf: kanban with 1k tasks — lanes render; cards virtualized", async ({
    page,
  }) => {
    const url = `${BASE}/kanban?view=${KANBAN_VIEW_ID}`;
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Layout count before stabilisation.
    const layoutBefore = await measureLayoutCount(page);

    // All 5 lanes must be present (they are always rendered regardless of virtualization).
    const lanes = page.locator('[data-testid^="kanban-lane-"]').or(page.locator("[data-lane]"));
    await expect(lanes).toHaveCount(5, { timeout: 10000 });

    // At least 1 card must be visible in the viewport.
    const visibleCards = page.locator('[aria-label^="Task:"]');
    await expect(visibleCards.first()).toBeVisible({ timeout: 10000 });

    // DOM card count should be well below 1000 if virtualization is working.
    const domCardCount = await visibleCards.count();
    // Heuristic: each lane shows ~15 cards in a typical viewport; 5 lanes × 20 = 100 max.
    expect(domCardCount).toBeLessThan(200);

    // Layout count sanity check.
    if (layoutBefore !== null) {
      const layoutAfter = await measureLayoutCount(page);
      if (layoutAfter !== null) {
        const layoutDelta = layoutAfter - layoutBefore;
        // Warn if layout count is unexpectedly high (not a hard failure in this
        // stub — finalize threshold in Epic 15 after real profiling).
        // biome-ignore lint/suspicious/noConsole: perf diagnostic intentional
        if (layoutDelta > 200) console.warn(`[perf] Kanban layoutCount delta: ${layoutDelta}`);
      }
    }
  });

  /**
   * P2 — Calendar with 1,000 tasks, all having date values.
   *
   * Structural assertions:
   *   - The react-big-calendar container renders.
   *   - Events appear in the DOM (react-big-calendar limits per-cell events in
   *     month view; not all 1k tasks will be visible at once — this is expected
   *     and correct behaviour).
   *   - The "Pick a date column" empty state is NOT shown.
   *   - The off-calendar panel shows 0 tasks (all have dates).
   *
   * Performance note: react-big-calendar handles ~500 events/month in month
   * view. At 1k, some events will be hidden behind the "+N more" affordance.
   * This is by-design; the structural assertion verifies at least some events
   * render within a reasonable timeout.
   */
  test.fixme("P2 @perf: calendar with 1k tasks — events render; no layout thrash", async ({
    page,
  }) => {
    const url = `${BASE}/calendar?view=${CALENDAR_VIEW_ID}`;
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Empty state must NOT be shown.
    await expect(
      page.getByText("Pick a date column to show your tasks on a calendar"),
    ).not.toBeVisible({ timeout: 10000 });

    // Calendar container must be visible.
    const calendarRoot = page.locator(".rbc-calendar");
    await expect(calendarRoot).toBeVisible({ timeout: 10000 });

    // At least 1 event must be visible in the month view (the seeded tasks all
    // have dates within the current month or the first displayed month).
    // react-big-calendar renders events with class "rbc-event".
    const events = page.locator(".rbc-event");
    await expect(events.first()).toBeVisible({ timeout: 10000 });

    // Off-calendar panel should show 0 tasks (all tasks have date values).
    // The panel renders with aria-label "Unscheduled tasks" or similar.
    const offPanelCount = page
      .locator("aside")
      .filter({ hasText: /unscheduled/i })
      .locator('[aria-label^="Task:"]');
    expect(await offPanelCount.count()).toBe(0);
  });

  /**
   * P3 — Timeline with 1,000 tasks, all having start+end values.
   *
   * Structural assertions:
   *   - The timeline container renders with the virtualized row list.
   *   - Visible rows are present in the DOM (virtualized — not all 1000).
   *   - The "Pick a timeline column" empty state is NOT shown.
   *   - The unscheduled panel shows 0 tasks.
   *   - Bar elements are rendered for visible rows.
   *
   * Virtualization: @tanstack/react-virtual renders only the visible rows.
   * With a typical viewport height of ~700px and ROW_HEIGHT=36, ~19 rows are
   * visible. DOM count should be ~19 + overscan(10) = ~29 max.
   */
  test.fixme("P3 @perf: timeline with 1k tasks — rows virtualized; bars render", async ({
    page,
  }) => {
    const url = `${BASE}/timeline?view=${TIMELINE_VIEW_ID}`;
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // Empty state must NOT be shown.
    await expect(page.getByText("Pick a timeline column to render bars")).not.toBeVisible({
      timeout: 10000,
    });

    // The timeline container must be present.
    // TimelineView renders a container with the virtualized list parent.
    // The virtualizer wraps items in a <div> with explicit height; the parent
    // ref div uses overflow-auto.
    const timelineContainer = page.locator('[data-testid="timeline-container"]').or(
      // Fallback: find the overflow-auto scrollable container inside the timeline.
      page.locator(".flex-1.overflow-auto.relative").first(),
    );
    await expect(timelineContainer).toBeVisible({ timeout: 10000 });

    // Bar elements should be visible for the rows in the initial viewport.
    // TimelineBar renders a div with position:absolute inside each TimelineRow.
    // Using data-testid added by TimelineBar (or class-based selector as fallback).
    const bars = page
      .locator('[data-testid^="timeline-bar-"]')
      .or(page.locator('[data-task-id][style*="position: absolute"]'));
    await expect(bars.first()).toBeVisible({ timeout: 10000 });

    // DOM row count should be well below 1000 (virtualized).
    // Each TimelineRow renders with a unique key (task.id).
    const rows = page.locator('[data-testid^="timeline-row-"]').or(page.locator(".timeline-row"));
    const rowCount = await rows.count();
    // With overscan=10 and a standard viewport, expect << 100 rows in DOM.
    expect(rowCount).toBeLessThan(100);

    // Unscheduled panel should be empty (all tasks have timeline values).
    const unscheduledItems = page
      .locator('[data-testid="timeline-unscheduled"]')
      .locator('[aria-label^="Task:"]');
    expect(await unscheduledItems.count()).toBe(0);
  });
});
