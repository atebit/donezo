import { expect, test } from "@playwright/test";
import { E2E_WORKSPACE_NAME, E2E_WORKSPACE_SLUG } from "./fixtures/seed";

/**
 * Workspaces & Boards e2e spec.
 *
 * Auth is handled by the global-setup.ts storageState — no per-test sign-in.
 * The e2e workspace and board are seeded by supabase/seed.sql (e2e section).
 *
 * Steps that require a second user (invitee) or dynamic invitation tokens are
 * marked test.fixme — they need a second storageState fixture or live email
 * capture, which is follow-up work.
 */

const WORKSPACE_SLUG = E2E_WORKSPACE_SLUG;
const WORKSPACE_NAME = E2E_WORKSPACE_NAME;
const BOARD_NAME = "My E2E Board";
const BOARD_NAME_RENAMED = "My E2E Board (renamed)";
const INVITEE_EMAIL = "invitee+e2e@donezo.local";

test.describe("Epic 05 — Workspaces & Boards", () => {
  // ── Step 1: Authenticated → land on first workspace ──────────────────────
  test("1 — authenticated → land on workspace", async ({ page }) => {
    await page.goto("/");
    // storageState makes us authenticated; root redirects to e2e workspace.
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}`));
    await expect(page.getByRole("heading", { name: WORKSPACE_NAME })).toBeVisible();
  });

  // ── Step 2: Create a board via NewBoardButton → CreateBoardModal ─────────
  test("2 — create board via sidebar NewBoardButton", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}`);

    // NewBoardButton renders with aria-label="Create new board"
    await page.getByRole("button", { name: "Create new board" }).click();

    // CreateBoardModal opens with title "Create board"
    await expect(page.getByRole("heading", { name: "Create board" })).toBeVisible();

    // Fill the board name
    await page.getByLabel("Board name").fill(BOARD_NAME);

    // Submit
    await page.getByRole("button", { name: "Create board" }).click();

    // Modal closes and we're redirected to the new board
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/[a-f0-9-]{36}`));
    await expect(page.getByRole("heading", { name: BOARD_NAME })).toBeVisible();
  });

  // ── Step 3: Rename board via inline EditableTitle in BoardHeader ──────────
  test("3 — rename board via inline EditableTitle", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}`);

    // Click the board name link in the sidebar or workspace home
    await page.getByRole("link", { name: BOARD_NAME }).first().click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/`));

    // EditableTitle renders as a heading when not editing; click to edit.
    const titleEl = page.getByRole("heading", { name: BOARD_NAME }).first();
    await titleEl.click();

    // Now it should be a textbox (contentEditable)
    const editable = page.getByRole("textbox", { name: /board title/i });
    await editable.selectText();
    await editable.fill(BOARD_NAME_RENAMED);
    // Commit by pressing Enter
    await editable.press("Enter");

    // Wait for the optimistic update / server round-trip
    await expect(page.getByRole("heading", { name: BOARD_NAME_RENAMED })).toBeVisible();
  });

  // ── Step 4: Star the board via BoardStarToggle ───────────────────────────
  test("4 — star board via BoardStarToggle", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}`);
    await page.getByRole("link", { name: BOARD_NAME_RENAMED }).first().click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/`));

    const starBtn = page.getByRole("button", { name: "Star board" });
    await expect(starBtn).toBeVisible();
    await starBtn.click();

    await expect(page.getByRole("button", { name: "Unstar board" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unstar board" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // ── Step 5: Archive board via BoardSettingsMenu → confirm modal ──────────
  test("5 — archive board via BoardSettingsMenu → returns to workspace home", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}`);
    await page.getByRole("link", { name: BOARD_NAME_RENAMED }).first().click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/`));

    await page.getByRole("button", { name: "Board settings" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();

    await expect(page.getByRole("heading", { name: "Archive board?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();

    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}`));
    await expect(page.getByRole("link", { name: BOARD_NAME_RENAMED })).not.toBeVisible();
  });

  // ── Step 6: Restore board from /w/<slug>/trash ───────────────────────────
  test("6 — restore board from workspace trash (admin+)", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/trash`);

    const trashTable = page.getByRole("table", { name: "Archived boards" });
    await expect(trashTable).toBeVisible();

    const boardRow = trashTable.getByRole("row").filter({ hasText: BOARD_NAME_RENAMED });
    await expect(boardRow).toBeVisible();

    await boardRow.getByRole("button", { name: "Restore" }).click();
    await expect(boardRow).not.toBeVisible();

    await page.goto(`/w/${WORKSPACE_SLUG}`);
    await expect(page.getByRole("link", { name: BOARD_NAME_RENAMED })).toBeVisible();
  });

  // ── Step 7: Delete board permanently from trash ─────────────────────────
  test("7 — delete board permanently from trash (workspace owner, type-name confirm)", async ({
    page,
  }) => {
    // First archive the board again so it's in the trash
    await page.goto(`/w/${WORKSPACE_SLUG}`);
    await page.getByRole("link", { name: BOARD_NAME_RENAMED }).first().click();
    await page.getByRole("button", { name: "Board settings" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await expect(page.getByRole("heading", { name: "Archive board?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}`));

    await page.goto(`/w/${WORKSPACE_SLUG}/trash`);

    const trashTable = page.getByRole("table", { name: "Archived boards" });
    const boardRow = trashTable.getByRole("row").filter({ hasText: BOARD_NAME_RENAMED });
    await expect(boardRow).toBeVisible();

    await boardRow.getByRole("button", { name: "Delete permanently" }).click();

    await expect(page.getByRole("heading", { name: /permanently delete/i })).toBeVisible();

    await page.getByLabel(/type .* to confirm/i).fill(BOARD_NAME_RENAMED);

    const deleteBtn = page.getByRole("button", { name: "Delete permanently" });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    await expect(boardRow).not.toBeVisible();
  });

  // ── Step 8: Invite a second user via workspace settings → InviteModal ─────
  test.fixme("8 — invite second user via InviteModal", async ({ page }) => {
    // Requires a second seeded user (invitee). Deferred.
    // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
    await page.goto(`/w/${WORKSPACE_SLUG}/settings/members`);
    await page.getByRole("button", { name: "Invite members" }).click();
    await expect(page.getByRole("heading", { name: "Invite members" })).toBeVisible();
    await page.getByLabel("Email addresses").fill(INVITEE_EMAIL);
    await expect(page.getByLabel("Role")).toHaveValue("member");
    await page.getByRole("button", { name: "Send invitations" }).click();
    await expect(page.getByText("Invitation sent.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invite members" })).not.toBeVisible();
  });

  // ── Step 9: Invitee accepts invite at /join/<token> ───────────────────────
  test.fixme("9 — accept invite at /join/<token> → second user is now a member", async ({
    page,
  }) => {
    // Requires: a second user storageState fixture + live invitation token.
    // See: docs/conversion-plan/_dispatch/epic-15-test-debt.md
    const INVITE_TOKEN = "REPLACE_WITH_SEED_TOKEN";
    await page.goto(`/join/${INVITE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "You've been invited" })).toBeVisible();
  });
});
