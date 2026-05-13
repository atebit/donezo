import { expect, test } from "@playwright/test";
import { E2E_BOARD_ID, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

/**
 * Epic 08 — Realtime & Presence e2e spec.
 *
 * These tests require two authenticated browser contexts (two users) sharing
 * the same board. This requires:
 *  - A second seeded user (User B) with its own storageState fixture.
 *  - Both users being workspace + board members.
 *  - Supabase Realtime running (supabase start).
 *
 * All tests are marked test.fixme until a second-user storageState fixture
 * is wired. See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
 */

const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const BOARD_ID = E2E_BOARD_ID;
const BOARD_URL = `/w/${WORKSPACE_SLUG}/b/${BOARD_ID}`;

// Seed task + column ids (e2e section of seed.sql)
const TASK_ID_T1 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10";
const COLUMN_ID_C1 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04";
const CELL_TEST_VALUE = `e2e-val-${Date.now()}`;

// Second user credentials — need a second storageState fixture (follow-up)
const USER_B_EMAIL = "user-b+e2e@donezo.local";
const USER_B_PASSWORD = "test-password-12345";

test.describe("Epic 08 — Realtime & Presence", () => {
  // ── Test 1: Live cell edit ────────────────────────────────────────────────
  test.fixme("1 — live cell edit: User A edits → User B sees update within 1500ms", async ({
    browser,
  }) => {
    // Requires second user storageState. See epic-15-test-debt.md
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    const cellA = pageA.locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`);
    await cellA.click();
    await pageA.keyboard.type(CELL_TEST_VALUE);
    await pageA.keyboard.press("Enter");

    await expect
      .poll(
        async () => {
          const cellB = pageB.locator(
            `[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`,
          );
          return cellB.textContent();
        },
        { timeout: 1500, intervals: [100] },
      )
      .toContain(CELL_TEST_VALUE);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 2: Live task add ─────────────────────────────────────────────────
  test.fixme("2 — live task add: User A adds task → User B sees it within 1500ms", async ({
    browser,
  }) => {
    // Requires second user storageState. See epic-15-test-debt.md
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    const newTaskName = `Realtime task ${Date.now()}`;

    await pageA
      .getByRole("button", { name: /add task/i })
      .first()
      .click();
    await pageA.getByRole("textbox", { name: /task title/i }).fill(newTaskName);
    await pageA.keyboard.press("Enter");

    await expect
      .poll(
        async () => {
          return pageB.getByText(newTaskName).isVisible();
        },
        { timeout: 1500, intervals: [100] },
      )
      .toBe(true);

    await contextA.close();
    await contextB.close();

    void USER_B_EMAIL;
    void USER_B_PASSWORD;
  });

  // ── Test 3: Presence pile ─────────────────────────────────────────────────
  test.fixme("3 — presence pile: both users see each other; pile updates on navigate away", async ({
    browser,
  }) => {
    // Requires second user storageState. See epic-15-test-debt.md
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    const presencePileA = pageA.locator("[data-testid='presence-pile']");
    const presencePileB = pageB.locator("[data-testid='presence-pile']");

    await expect
      .poll(async () => presencePileA.locator("[data-testid='presence-avatar']").count(), {
        timeout: 3000,
      })
      .toBe(1);

    await expect
      .poll(async () => presencePileB.locator("[data-testid='presence-avatar']").count(), {
        timeout: 3000,
      })
      .toBe(1);

    await pageA.goto("/");

    await expect
      .poll(async () => presencePileB.locator("[data-testid='presence-avatar']").count(), {
        timeout: 5000,
        intervals: [200],
      })
      .toBe(0);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 4: Connection status ─────────────────────────────────────────────
  test.fixme("4 — connection status: offline pill appears; reconnect syncs missed edits", async ({
    browser,
  }) => {
    // Requires second user storageState. See epic-15-test-debt.md
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    await contextA.setOffline(true);

    const connectionPill = pageA.locator("[data-testid='connection-status']");
    await expect
      .poll(async () => connectionPill.isVisible(), {
        timeout: 5000,
        intervals: [200],
      })
      .toBe(true);

    const offlineTestValue = `offline-val-${Date.now()}`;
    const cellB = pageB.locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`);
    await cellB.click();
    await pageB.keyboard.type(offlineTestValue);
    await pageB.keyboard.press("Enter");

    await contextA.setOffline(false);

    await expect
      .poll(async () => connectionPill.isVisible(), {
        timeout: 10000,
        intervals: [500],
      })
      .toBe(false);

    await expect
      .poll(
        async () => {
          const cellA = pageA.locator(
            `[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`,
          );
          return cellA.textContent();
        },
        { timeout: 5000, intervals: [200] },
      )
      .toContain(offlineTestValue);

    await contextA.close();
    await contextB.close();
  });

  // ── Test 5: Cursor dot ────────────────────────────────────────────────────
  test.fixme("5 — cursor dot: User A hover → User B sees colored dot within 500ms", async ({
    browser,
  }) => {
    // Requires second user storageState. See epic-15-test-debt.md
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto(BOARD_URL);
    await pageB.goto(BOARD_URL);

    const cellA = pageA.locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`);
    await cellA.hover();

    const cursorDotInB = pageB
      .locator(`[data-task-id="${TASK_ID_T1}"][data-column-id="${COLUMN_ID_C1}"]`)
      .locator("[data-testid='cursor-dot']");

    await expect
      .poll(async () => cursorDotInB.count(), {
        timeout: 500,
        intervals: [50],
      })
      .toBeGreaterThan(0);

    await contextA.close();
    await contextB.close();
  });
});
