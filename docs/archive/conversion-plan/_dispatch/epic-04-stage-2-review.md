# Epic 04 Stage 2 Review

**Verdict:** FOLLOWUP REQUIRED
**Diff:** 5ebb014..9dd26b4 (Stage-2 merges 5efe8da, 316ea3f, 0465ddf, 9dd26b4)
**Date:** 2026-05-07

## Slice D — PASS WITH CALL-OUT

The migration file `supabase/migrations/20260507120200_invitations_and_creation_rpcs.sql` matches the dispatch spec essentially line-for-line. Concrete checks:

- **Timestamp ordering:** `20260507120200` is strictly greater than B's `20260507120100`. Apply order A → B → D enforced. PASS.
- **`invitation` table shape:** all 10 columns, types, constraints, defaults match the spec. `expires_at` default `now() + interval '14 days'`, `role` check constraint correct. PASS.
- **`invitation_email_idx`:** `lower(email)` index present. (Note: dispatch hinted at `where accepted_at is null` partial index per the epic doc; the executor shipped a full index. Acceptable — partial would have been more selective but not required by spec.)
- **RLS enabled:** yes. PASS.
- **`invitation_select` policy:**
  - Admits invitee on non-accepted rows: `lower(email) = lower(auth.users.email) AND accepted_at IS NULL`. PASS.
  - Admits admin+ on parent workspace: `role_rank(workspace_member.role) >= role_rank('admin')`. PASS.
  - Admits admin+ on parent board (when `board_id` is not null): uses `role_for_board` which subsumes workspace-admin, so workspace admins implicitly cover both branches. PASS.
- **`invitation_insert` policy:**
  - Requires workspace admin+. PASS.
  - If `board_id` is not null, requires admin+ on board too (via `role_for_board`). PASS.
  - Requires `invited_by = (select auth.uid())` — prevents impersonating an inviter. PASS.
  - **Spec-level concern (not a bug in the implementation):** the policy requires workspace admin+ AND board admin+ for board-scoped invites. A board owner who is only a workspace `member` cannot insert a board-scoped invite. The action's `requireBoardRole(boardId, "admin")` would pass but the RLS write would reject. This matches the dispatch spec language verbatim and is therefore implementation-correct, but the design is questionable. Flagged in cross-cutting concerns; not a Stage-2 followup blocker.
- **`invitation_update` policy:** invitee can mark own non-accepted invitation. The before-update trigger restricts column-level changes. PASS.
- **No DELETE policy** in v1. PASS (matches Q3=(b) intent; deletion is admin/service-role-only).
- **Before-update trigger `invitation_only_accept_update`:** lists every immutable column (`id`, `workspace_id`, `board_id`, `email`, `role`, `token`, `invited_by`, `expires_at`, `created_at`) — only `accepted_at` may change. Raises `42501`. PASS.
- **`wsm_insert` and `bm_insert` drop+recreate:** correctly drops then re-issues with the invitation-gated form. Q13=(b) honored — `bm_insert`'s self-insert clause checks `i.board_id = board_member.board_id` (board-scoped only), and `wsm_insert`'s requires `i.board_id IS NULL` (workspace-scoped only). PASS.
- **`create_workspace` RPC:** raises `28000` on unauthenticated; otherwise inserts workspace + owner workspace_member. PASS.
- **`create_board` RPC:** raises `28000` unauth; raises `42501` for forbidden (no membership or below `member`). Correctly inserts `board_member(role='owner')` only when `is_private=true`, NOT for public boards. PASS.
- **Grants:** `create_workspace` and `create_board` granted only to `authenticated`. PASS.
- All policies use `(select auth.uid())` for plan-cache stability. PASS.

**Verdict: PASS.** The minor `invitation_email_idx` non-partial form is acceptable.

## Slice E — PASS WITH CONCERN

`app/(app)/actions.ts`, `app/(app)/w/[workspaceSlug]/actions.ts`, `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts`, `app/(auth)/join/[token]/actions.ts`, and `lib/utils/invitation-token.ts` all match the dispatch spec.

- All five actions wrapped in `withUser`. PASS.
- All call the right Zod schemas (`CreateWorkspaceSchema`, `CreateBoardSchema`, `InviteToWorkspaceSchema`, `InviteToBoardSchema`, `AcceptInvitationSchema`). PASS.
- `requireWorkspaceRole` / `requireBoardRole` used correctly:
  - `createBoard` → `requireWorkspaceRole(workspaceId, "member")`. PASS.
  - `inviteToWorkspace` → `requireWorkspaceRole(workspaceId, "admin")`. PASS.
  - `inviteToBoard` → `requireBoardRole(boardId, "admin")`. PASS.
  - `acceptInvitation` does no friendly-role check (RLS is the gate; the invitee match is on email + token). PASS.
- `acceptInvitation` flow: lookup → membership insert → `accepted_at` update — all under user session, no `adminClient`. PASS. Non-atomic risk noted in the action's comment per Risk #2.
- `inviteToBoard` correctly looks up the board's `workspace_id` first via the user's authed client, then inserts the invitation with both `workspace_id` and `board_id` set. PASS.
- Token generation: `crypto.getRandomValues(Uint8Array(24))` → URL-safe base64 → 32 chars (192 bits). PASS.
- No imports of `@/lib/supabase/admin` in any of the five files. PASS.
- Email is lowercased on insert (`input.email.toLowerCase()`). Matches the `lower(email)` index. PASS.
- All eight `(supabase as any)` casts are annotated with the `// TODO(F1): tighten once db:types regenerates the RPC + invitation types.` comment plus a `biome-ignore` reason. The actual call shapes (`.rpc("create_workspace", {p_name, p_slug}).single()` etc.) match Slice D's RPC signatures exactly:
  - `create_workspace(p_name text, p_slug text)` — call uses `{p_name, p_slug}`. MATCH.
  - `create_board(p_workspace_id uuid, p_name text, p_is_private boolean)` — call uses `{p_workspace_id, p_name, p_is_private}`. MATCH.
  - `invitation` insert columns (`workspace_id`, `board_id`, `email`, `role`, `token`, `invited_by`) match the table shape. MATCH.
  - `workspace_member` / `board_member` insert columns match. MATCH.
  - F1 type tightening will cleanly remove the casts.
- `withUser` returns `ActionResult<T>`; the inline `accept()` server action in slice F's page calls `acceptInvitation` and checks `result.ok`. Compatible.

**Concern (not a blocker):** `acceptInvitation` does not call `requireWorkspaceRole` / `requireBoardRole` — it relies entirely on the invitation lookup + RLS gating. This is correct per Q3=(b), but if the user already has membership at a HIGHER role, accepting a new invitation could downgrade them (the membership insert will conflict on the composite PK `(workspace_id, user_id)` and 23505 will surface as `code:"DB"`). Friendly-error handling for "already a member" would polish the UX but isn't a Stage-2 blocker. Tracked as a cross-cutting concern.

**Verdict: PASS.** All eight casts will tighten cleanly post-F1.

## Slice F — PASS

`app/(auth)/join/[token]/page.tsx`:
- Async `params` and `searchParams` shapes match Next 15 RSC contract. PASS.
- Unauth redirect to `/sign-in?next=...` with URL-encoded next param. PASS.
- Inline `accept()` server action with `"use server"` directive. Calls `acceptInvitation({ token })`, redirects to `/join/<token>?error=...` on failure or `/` on success. The `redirect()` is **outside** the `withUser`-wrapped action (which can't compose with `redirect()`'s NEXT_REDIRECT throw), per the action-file's NOTE comment. PASS.
- **`<h1>` → `<h2>` demotion is correct.** `app/(auth)/layout.tsx` already renders `<h1>Donezo</h1>`. Page using `<h2>` for "You've been invited" preserves a single h1 per page (a11y best practice). PASS.
- **`text-muted-foreground` is a valid token.** `app/globals.css` defines `--muted-foreground` and `--color-muted-foreground` in both root and dark themes. Tailwind v4's `text-muted-foreground` resolves correctly. PASS.
- `bg-primary` / `text-primary-foreground` / `hover:bg-primary/90` also resolve via `app/globals.css`'s `--color-primary` / `--color-primary-foreground`. PASS.
- Skeleton e2e test `tests/e2e/invitation-accept.spec.ts` exists with `test.skip` and a `@ts-expect-error` for the `@playwright/test` import (Playwright wired in epic 15). Syntactically valid. PASS.
- `"use client"` not used anywhere in this slice. PASS.

**Verdict: PASS.**

## Slice G — FOLLOWUP REQUIRED (1 test logic bug)

**File counts and structure:** PASS.
- `00_setup.sql`: 12 helper functions in `tests` schema (more than the four named in spec — `seed_group`, `seed_task`, `seed_column`, `seed_comment`, `seed_view`, `seed_invitation`, `seed_board_member`, `reset_to_service_role`). Helpers are isolated from `authenticated` role. Acceptable extension; matches "additional helpers" comment block.
- `10_workspace.sql`: 11 assertions. PASS.
- `20_board.sql`: 13 assertions, including the **`prosecdef = true` assertion on `role_for_board`** (test 1, lines 96-103). PASS — Risk #10 is covered.
- `30_task_cell.sql`: 13 assertions. PASS.
- `40_invitation.sql`: 12 assertions. Covers admin/member insert; invitee select; trigger column block; valid/expired/mismatched-email/board-scoped self-insert; already-accepted reuse. **One test logic bug (see below).**
- `50_view.sql`: 8 assertions. Covers Q5-corrected (`is_shared`, `owner_id`) policies. PASS.
- **Total: 57 assertions** — exceeds the ~50 target.

**SQL spot-checks (one assertion per file):**
- `10_workspace.sql` test 11 (line 233-242): `throws_ok` on insert into `workspace_member` from a non-member without invitation → `42501`. SQL is valid; matches `wsm_insert` with-check policy. PASS.
- `20_board.sql` test 11 (line 215-222): `set_jwt_user` to ws-member, count rows on private board where ws-member has no `board_member` row → expect 0. SQL is valid; matches `role_for_board` returning null on private board for non-board-members. PASS.
- `30_task_cell.sql` test 13 (line 349-361): member tries to insert `comment` with `author_id = admin_id` — `with check (author_id = auth.uid())` raises 42501. SQL is valid. PASS.
- `40_invitation.sql` test 6 (line 213-219): invitee tries to UPDATE `email` column → trigger raises 42501. SQL is valid. PASS.
- `50_view.sql` test 7 (line 175-184): member (owner of a shared view) tries to UPDATE → 0 rows because `view_modify` policy requires admin+ when `is_shared=true`. SQL is valid; matches policy CASE branch. PASS.

**Bypass surface coverage in `40_invitation.sql`:**
- Role mismatch: NOT explicitly covered. The policy gates `i.role = workspace_member.role`; tests 7 and 12 happen to use mismatched-role indirectly (test 12 inserts `viewer` while only `member`/already-accepted-`viewer` invitations exist), but no test directly inserts with an arbitrary role differing from a valid invitation.
- Expired: covered by test 8 — **but this test has a logic bug (see below)**.
- Mismatched email: covered by test 9. PASS.
- Board-scoped invite into `workspace_member` rejected: covered by test 10. PASS (Q13).
- Already-accepted reuse rejected: covered by test 12. PASS.

**Test logic bug — `40_invitation.sql` test 8 (lines 246-265):**

Setup state on entry to test 8:
- `i4...001` (`tok_valid_workspace_invite`): `role=member`, `accepted_at=null` (reset to null on line 209, again on line 229).
- `i4...002` (`tok_expired_workspace_invite`): `role=member`, expired.
- `i4...004` (`tok_already_accepted`): `role=viewer`, `accepted_at` set.

Test 7 (lines 234-242) inserts the membership using the valid `i4...001` invitation. Test 8 then deletes that membership and re-attempts insert with `role='member'` for the same user. The `wsm_insert` policy admits if **any** matching valid invitation exists. Since `i4...001` is still `accepted_at=null` (the application would set it; the policy doesn't auto-update it), test 8's insert **succeeds** rather than throws 42501.

Test 8 will fail when the runner is wired (epic 15). Fix: in service-role context before test 8, either (a) delete `i4...001` or (b) set `i4...001.accepted_at = now()`. Then only the expired invitation remains → policy correctly rejects → `throws_ok` passes.

**Test coverage gap — role mismatch path:**

The policy gate explicitly checks `i.role = workspace_member.role`, but no test directly verifies "valid invitation, wrong role". The dispatch spec § Definition of done line 1029 calls out: "with expired/mismatched/wrong-role invitation fails". Add one assertion in `40_invitation.sql`: invitee with a `member`-role invitation tries to self-insert as `admin` → 42501.

**`board_delete` ambiguity in test 13 of `20_board.sql`:** the test documents the as-shipped policy (admin+ can delete) and asserts the negative case (member cannot). This itself is correct. The drift is in **Slice B's policy** — see "board_delete ruling" below.

**Verdict: FOLLOWUP REQUIRED** for the test 8 bug and the role-mismatch coverage gap. Plus the `board_delete` policy correction below.

## Cross-cutting concerns

1. **`invitation_insert` policy is stricter than the per-file `requireBoardRole` check.** A board owner who is only a workspace `member` would pass `requireBoardRole(boardId, "admin")` (because `role_for_board` returns the higher of workspace and board roles, so a board-owner gets `owner`), but the `invitation_insert` policy requires workspace admin+ AND board admin+. This is a real divergence between friendly-error layer and RLS truth. **Spec-conformant** but design-questionable. Recommend tracking as a debt item; not a Stage-2 blocker.

2. **`acceptInvitation` and the "already a member at a higher role" path.** If a user already has membership and re-accepts an invitation, the membership insert will fail on the composite PK constraint. The action surfaces `code:"DB"` rather than a friendly `code:"ALREADY_MEMBER"`. Polish, not a blocker.

3. **Stage 1 review missed the `board_delete` drift.** The Stage-1 reviewer marked Slice B CLEAN but `board_delete` was implemented as `>= admin` instead of "owner-only" per the epic doc § Definition of done line 514 and the Slice B dispatch spec line 206. Caught here in Stage 2. Fix in followup.

## board_delete ruling

**The policy is wrong; tighten it to workspace-owner-only.**

Reasoning:
- Epic doc § Definition of done line 514 explicitly: *"A board admin can update the board's title but not delete it (workspace owner only)."* This is a hard acceptance criterion of Epic 04.
- Slice B dispatch spec § Spec details item 1 line 206: *"`delete` owner-only."*
- Slice B as-shipped: `role_rank(role_for_board(...)) >= role_rank('admin')` — admits workspace admins, board admins, and board owners.
- This is a real authorization regression: an admin (workspace OR board) can permanently delete a board, contrary to the epic's explicit DoD line.

**Correct policy:** workspace-owner-only. Cannot use `role_for_board` because that returns the *max* of workspace and board roles — a board "owner" via `board_member` would still pass an `>= owner` rank check. Must consult `workspace_member` directly:

```sql
create policy "board_delete" on public.board for delete using (
  exists (
    select 1 from public.workspace_member wm
     where wm.workspace_id = board.workspace_id
       and wm.user_id = (select auth.uid())
       and wm.role = 'owner'
  )
);
```

This implementation matches the epic doc's intent: only the workspace owner can delete a board, regardless of board-level roles.

**pgTAP impact:** `20_board.sql` test 13 currently asserts "member cannot delete" — still valid. Add two new assertions: "admin cannot delete" (negative) and "owner can delete" (positive). Update the file's coverage-targets header comment to remove the "Slice B's actual policy" note.

## Verdict reasoning

Stage 2 is **mostly clean** — Slices D, E, F all match their specs and the epic's intent. Slice G's structure and coverage are excellent (57 assertions, well-organized, helpers are isolated, `prosecdef` covered). Three issues require a small, surgical followup round before Stage 2 can be marked CLEAN:

1. **`board_delete` policy correction** — drift from epic DoD identified in Slice B (carried over from Stage 1). Workspace-owner-only is the documented intent. New migration appended.
2. **`40_invitation.sql` test 8 logic bug** — fails when runner wires up in epic 15.
3. **`40_invitation.sql` role-mismatch coverage gap** — explicit assertion missing per dispatch spec line 1029.

All three are file-disjoint and parallel-safe. Followups are documented in `epic-04-followup-1.md`.
