import { expect, test } from "@playwright/test";
import {
  E2E_WORKSPACE_NAME,
  E2E_WORKSPACE_SLUG,
  SMOKE_BOARD_ID,
  SMOKE_BOARD_NAME,
} from "./fixtures/seed";

/**
 * Epic 16 — Workspace sidebar tests.
 *
 * Verifies that the WorkspaceSwitcher shows the active workspace name
 * (not "Select workspace") and that BoardList shows at least the smoke board.
 *
 * Slice D fixed the WorkspaceProvider context wiring so the sidebar
 * sits inside the provider tree. These tests assert that fix holds.
 *
 * Auth: global-setup.ts storageState.
 * Seed: supabase/seed.sql EPIC-16 SMOKE BOARD section.
 */

const BOARD_URL = `/w/${E2E_WORKSPACE_SLUG}/b/${SMOKE_BOARD_ID}`;

test.describe("Epic 16 — Workspace sidebar state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BOARD_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
  });

  test("sidebar workspace switcher shows active workspace name, not placeholder", async ({
    page,
  }) => {
    // WorkspaceSwitcher renders the current workspace name in its trigger button.
    // Before Slice D fix: showed "Select workspace".
    // After fix: shows the actual workspace name.
    const switcherTrigger = page.getByRole("button", { name: /Switch workspace/i });
    await expect(switcherTrigger).toBeVisible({ timeout: 10_000 });

    // The trigger should contain the workspace name.
    const triggerText = await switcherTrigger.textContent();
    expect(triggerText, "Workspace switcher should show workspace name").toContain(
      E2E_WORKSPACE_NAME,
    );

    // It must NOT show the fallback placeholder.
    expect(triggerText, "Workspace switcher must not show Select workspace").not.toContain(
      "Select workspace",
    );
  });

  test("sidebar does not show 'Select a workspace' empty state when on a board", async ({
    page,
  }) => {
    // The "Select a workspace to see your boards" copy must not appear when
    // a workspace is active.
    await expect(page.getByText(/select a workspace/i)).not.toBeVisible();
  });

  test("sidebar board list shows at least the smoke board", async ({ page }) => {
    // BoardList renders board links for the active workspace.
    // The smoke board (Epic 16 Smoke Board) must appear.
    await expect(page.getByText(SMOKE_BOARD_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar board list shows at least one board item", async ({ page }) => {
    // BoardListItem renders links to boards.
    // At least the E2E Board and the Smoke Board should appear.
    const boardLinks = page.locator("a").filter({ hasText: /board/i });
    const count = await boardLinks.count();
    expect(count, "Sidebar should show at least 1 board link").toBeGreaterThan(0);
  });

  test("workspace switcher opens dropdown with workspace entry", async ({ page }) => {
    // Open the workspace switcher dropdown and verify it lists the workspace.
    const switcherTrigger = page.getByRole("button", { name: /Switch workspace/i });
    await switcherTrigger.click();

    // The workspace should appear in the dropdown menu.
    await expect(page.getByText(E2E_WORKSPACE_NAME).first()).toBeVisible({ timeout: 5_000 });

    // Close by pressing Escape.
    await page.keyboard.press("Escape");
  });
});
