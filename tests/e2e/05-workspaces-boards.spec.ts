// @ts-expect-error playwright wired in epic 15
import { expect, test } from "@playwright/test";

/**
 * Spec stub — runner wired in epic 15. Requires seeded users + Playwright config.
 *
 * TODO (epic 15):
 *  - Seed a primary user (owner) and a secondary user (invitee) in the
 *    Supabase test DB via pgTAP fixtures or a setup script.
 *  - Configure `playwright.config.ts` with baseURL pointing to the local dev
 *    server (or Vercel preview URL in CI).
 *  - Wire `test.use({ storageState })` so sign-in persists across tests in the
 *    same describe block (avoids re-logging in for every test).
 *  - Replace placeholder values (WORKSPACE_SLUG, BOARD_ID, INVITE_TOKEN) with
 *    values emitted by the seed script.
 */

// ---------------------------------------------------------------------------
// Constants — replace with seed-script output in epic 15
// ---------------------------------------------------------------------------
const OWNER_EMAIL = "owner+e2e@donezo.local";
const OWNER_PASSWORD = "test-password-12345";
const INVITEE_EMAIL = "invitee+e2e@donezo.local";
const INVITEE_PASSWORD = "test-password-12345";
const WORKSPACE_NAME = "E2E Workspace";
const WORKSPACE_SLUG = "e2e-workspace";
const BOARD_NAME = "My E2E Board";
const BOARD_NAME_RENAMED = "My E2E Board (renamed)";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("Epic 05 — Workspaces & Boards", () => {
  // Skip all tests until epic 15 wires the Playwright runner and fixtures.
  test.skip(
    true,
    "Spec stub — runner wired in epic 15. Requires seeded users + Playwright config.",
  );

  // ── Step 1: Sign in and land on first workspace ──────────────────────────
  test("1 — sign in → land on first workspace", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    // The first-run gate (/) should redirect to the primary workspace.
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
    // Navigate to the board (URL captured from step 2 or passed from seed)
    await page.goto(`/w/${WORKSPACE_SLUG}`);

    // Click the board name link in the sidebar or workspace home
    await page.getByRole("link", { name: BOARD_NAME }).first().click();
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}/b/`));

    // EditableTitle renders as a blockquote with role="heading" when not editing.
    // Clicking it switches to role="textbox".
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

    // BoardStarToggle renders a button with aria-label="Star board" when not starred.
    const starBtn = page.getByRole("button", { name: "Star board" });
    await expect(starBtn).toBeVisible();
    await starBtn.click();

    // After toggling, aria-label switches to "Unstar board" and aria-pressed is true.
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

    // Open the Board settings menu (aria-label="Board settings")
    await page.getByRole("button", { name: "Board settings" }).click();

    // Click "Archive" in the dropdown
    await page.getByRole("menuitem", { name: "Archive" }).click();

    // BoardArchiveConfirmModal opens with title "Archive board?"
    await expect(page.getByRole("heading", { name: "Archive board?" })).toBeVisible();

    // Click the "Archive" confirm button inside the modal
    await page.getByRole("button", { name: "Archive" }).click();

    // After archive success the router pushes to /w/<slug>
    await expect(page).toHaveURL(new RegExp(`/w/${WORKSPACE_SLUG}`));
    // The board should no longer appear in the workspace board list
    await expect(page.getByRole("link", { name: BOARD_NAME_RENAMED })).not.toBeVisible();
  });

  // ── Step 6: Restore board from /w/<slug>/trash ───────────────────────────
  test("6 — restore board from workspace trash (admin+)", async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_SLUG}/trash`);

    // TrashList renders an accessible table with aria-label="Archived boards"
    const trashTable = page.getByRole("table", { name: "Archived boards" });
    await expect(trashTable).toBeVisible();

    // The archived board row should appear
    const boardRow = trashTable.getByRole("row").filter({ hasText: BOARD_NAME_RENAMED });
    await expect(boardRow).toBeVisible();

    // Click the "Restore" button in that row
    await boardRow.getByRole("button", { name: "Restore" }).click();

    // After restore the row disappears (optimistic removal)
    await expect(boardRow).not.toBeVisible();

    // Navigate to workspace home and verify the board is back
    await page.goto(`/w/${WORKSPACE_SLUG}`);
    await expect(page.getByRole("link", { name: BOARD_NAME_RENAMED })).toBeVisible();
  });

  // ── Step 7: Delete board permanently from trash (workspace owner) ─────────
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

    // Now go to trash and permanently delete
    await page.goto(`/w/${WORKSPACE_SLUG}/trash`);

    const trashTable = page.getByRole("table", { name: "Archived boards" });
    const boardRow = trashTable.getByRole("row").filter({ hasText: BOARD_NAME_RENAMED });
    await expect(boardRow).toBeVisible();

    // Owner sees a "Delete permanently" button per row
    await boardRow.getByRole("button", { name: "Delete permanently" }).click();

    // The DeleteDialog opens — title contains the board name
    await expect(page.getByRole("heading", { name: /permanently delete/i })).toBeVisible();

    // Type the board name to confirm (label: "Type <board name> to confirm:")
    await page.getByLabel(/type .* to confirm/i).fill(BOARD_NAME_RENAMED);

    // "Delete permanently" button should now be enabled
    const deleteBtn = page.getByRole("button", { name: "Delete permanently" });
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // Row should disappear
    await expect(boardRow).not.toBeVisible();
  });

  // ── Step 8: Invite a second user via workspace settings → InviteModal ─────
  test("8 — invite second user via InviteModal (email capture; no send asserted)", async ({
    page,
  }) => {
    // TODO: epic 13 wires Resend; this test only asserts the invitation is
    // created in the DB (or that the success toast appears). No email send
    // assertion is made here.

    await page.goto(`/w/${WORKSPACE_SLUG}/settings/members`);

    // The members settings page renders an "Invite members" button
    await page.getByRole("button", { name: "Invite members" }).click();

    // InviteModal opens with title "Invite members"
    await expect(page.getByRole("heading", { name: "Invite members" })).toBeVisible();

    // Fill the email addresses field (label: "Email addresses")
    await page.getByLabel("Email addresses").fill(INVITEE_EMAIL);

    // Select role — default is "Member", keep it
    await expect(page.getByLabel("Role")).toHaveValue("member");

    // Submit
    await page.getByRole("button", { name: "Send invitations" }).click();

    // Success toast: "Invitation sent."
    await expect(page.getByText("Invitation sent.")).toBeVisible();

    // Modal closes
    await expect(page.getByRole("heading", { name: "Invite members" })).not.toBeVisible();
  });

  // ── Step 9: Invitee accepts invite at /join/<token> ───────────────────────
  test("9 — accept invite at /join/<token> → second user is now a member", async ({ page }) => {
    // TODO: epic 15 — retrieve the invitation token from the DB seed or from a
    // test helper that intercepts the `inviteToWorkspace` server action.
    //
    // For now the token is a placeholder. Replace with the actual token value
    // emitted by the seed script or the invitation-creation helper.
    const INVITE_TOKEN = "REPLACE_WITH_SEED_TOKEN";

    // Sign in as the invitee
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(INVITEE_EMAIL);
    await page.getByLabel("Password").fill(INVITEE_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL("/");

    // Navigate to the join page
    await page.goto(`/join/${INVITE_TOKEN}`);

    // The active-invitation state renders heading "You've been invited"
    await expect(page.getByRole("heading", { name: "You've been invited" })).toBeVisible();
    await expect(page.getByText(new RegExp(WORKSPACE_NAME, "i"))).toBeVisible();

    // Accept the invitation
    await page.getByRole("button", { name: "Accept invitation" }).click();

    // After acceptance the server action redirects to "/"
    await expect(page).toHaveURL("/");

    // ── Verify membership: sign back in as owner and check members list ──────
    // Sign out as invitee
    // (Playwright context maintains session — open a new context for the owner
    //  or rely on storageState fixture in epic 15.)

    await page.goto("/sign-out"); // assumes a sign-out GET route or uses sign-in page
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password").fill(OWNER_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.goto(`/w/${WORKSPACE_SLUG}/settings/members`);
    await expect(page.getByText(INVITEE_EMAIL)).toBeVisible();
  });
});
