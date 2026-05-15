# Epic 05 — Stage 5 Review (Slices 15 + 16)

## Review summary
- **Stage reviewed:** Stage 5 — Slice 15 (Board settings: general + members) at `15bf1cb`; Slice 16 (First-run gate at `/` + `CreateWorkspaceModal`) at `d29eda9`. Sibling Stage-4 followup commits `9cb5a1d`, `ab52082`, `59f28c2` are out of scope (reviewed separately).
- **Verdict:** **FOLLOWUP REQUIRED** — one user-facing bug (mislabelled/non-functional "Make private" button) blocks the stage; everything else is clean enough to ride forward to F2 + the epic-level review.

### Definition-of-done items met

**Slice 15:**
- Settings routes render under a settings layout that visually mirrors the workspace settings shell (`bg-surface-rail`, max-w-5xl, w-48 nav rail, same h1 chrome).
- `setBoardPrivacy` action seeds the caller into `board_member` as `owner` when going private (verified at `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions.ts:32-39`); the form just calls it.
- Archive flow opens the existing `BoardArchiveConfirmModal` and routes to `/w/<slug>` on success.
- Permanent-delete is gated server-side on `getWorkspaceRole(board.workspace_id) === "owner"` (verified — `general/page.tsx:26` computes the role server-side and passes down to the form, which only renders the row when `workspaceRole === "owner"`).
- Permanent-delete uses the existing `BoardDeleteConfirmModal` (type-name confirm) and routes to `/w/<slug>` on success.
- Members page is conditional on `is_private`: public renders the notice card, private renders the full members + pending-invitations tables.
- Pending board-scoped invitations are listed with resend/revoke actions wired to the existing workspace-level `resendInvitation` / `revokeInvitation` server actions.
- Settings layout gates non-admins via `notFound()`; `general/page.tsx` and `members/page.tsx` re-gate as defense-in-depth.
- Slice did NOT modify server actions (forbidden scope respected — `settings/general/actions.ts` and `settings/members/actions.ts` were created in Slice 6 commit `ce7bbdf`, not in `15bf1cb`).
- `BoardArchiveConfirmModal` / `BoardDeleteConfirmModal` props match: both expose `{ open, onOpenChange, onSuccess }` and resolve `board.id` / `board.name` from `useBoard()` (the BoardProvider wraps `b/[boardId]` and therefore wraps `b/[boardId]/settings/*` too — verified via `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`).

**Slice 16:**
- `app/(app)/page.tsx` exists; `app/page.tsx` and `app/_components/{ping-button,sign-out-button}.tsx` are deleted (no dangling references — grep is clean).
- The gate handles all three branches: `last_workspace_id` → `/w/<slug>`; otherwise oldest membership (ordered by `workspace_member.created_at ASC`, deterministic); otherwise renders `<FirstRun />` inside the inherited SidebarShell.
- `<NoWorkspaces onCreate={...} />` is wired through the `FirstRun` client wrapper.
- `CreateWorkspaceModal` mirrors `CreateBoardModal` chrome (Base UI Dialog, identical inline-style tokenization, same `color: "white"` on the primary button), uses `createWorkspace` server action, and `router.push(/w/<slug>)` on success.
- The `FirstRun` client wrapper pattern (RSC page → small `"use client"` wrapper for the open-state + modal) matches the spec's recommended pattern.
- No raw hex/rgba in any new file. No `red-*` / `amber-*` / etc. Tailwind color-scale classes in any new file (only design tokens via `[color:var(--…)]`).
- `pnpm lint` is clean. `pnpm typecheck` only emits the pre-existing Zod 4 / @hookform TS2769 noise (Risk Note #4 in dispatch plan; standing tracker per epic-04 final review). No new typecheck regressions.

### Definition-of-done items NOT met

1. **Slice 15 — `Make private` button on the public-board members notice is broken.** The button is rendered with label "Make private", but its `onClick` calls `toast.info("Board invitations — coming next")` (members-table.tsx:217-223). The label and the behavior do not match. This is not a deferred feature — it is a copy-paste bug from the "Invite members" TODO above it. As-shipped, an admin who clicks "Make private" gets a toast about invitations and the board stays public.

### Other issues found (not blocking, but flag for epic-level review)

- **Slice 15 — privacy toggle confirm uses `window.confirm`** rather than a styled Base UI Dialog. The action is reversible (admin can flip back), and `window.confirm` is functionally correct, but it is visually inconsistent with the rest of the app's confirm chrome (BoardDeleteConfirmModal, BoardArchiveConfirmModal, MemberRemoveConfirm, etc.). Acceptable for v1; flag for the epic-level visual fidelity sweep.
- **Slice 15 — "Invite members" button on the private-board members table is a stub toast** (`toast.info("Board invitations — coming next")`). This is the long-running deferred item: the InviteModal needs a `boardId` extension (and `inviteToBoard` server-action consumer wiring). Slice 12's executor escalated this; the Stage 4 reviewer deferred to the epic review. Confirming here that it should ride forward to the **epic-level review**, NOT close in Stage 5 — see hand-off below.
- **Minor: settings layout duplicates the board fetch** that the parent board layout already runs. Not a correctness issue, just a small render-time cost; not worth a followup.

### Token + visual fidelity audit

- Grep for `#[0-9a-fA-F]{3,8}` and `rgba?(` across all 10 new files: no hits.
- Grep for `(red|amber|blue|green|gray|slate|zinc|emerald|rose)-(50|100…900)` across all 10 new files: no hits.
- One `color: "white"` literal in `CreateWorkspaceModal.tsx:237` (primary-button text on `--color-primary` background). This matches the existing `CreateBoardModal.tsx:286` pattern exactly — not a regression.

### Cross-slice integration sanity

- `BoardArchiveConfirmModal` / `BoardDeleteConfirmModal` reuse: imports, props, and `useBoard()` context all work because the settings tree inherits `BoardProvider` from `b/[boardId]/layout.tsx`. ✓
- Settings layout server-side gates on `getBoardRole(boardId)` against `viewer` / `member` (passes admin / owner). ✓
- Permanent-delete gating goes through `getWorkspaceRole(board.workspace_id)` server-side and is passed down via prop, not computed client-side. ✓
- `app/(app)/page.tsx` correctly inherits `app/(app)/layout.tsx`'s SidebarShell. ✓
- `<NoWorkspaces onCreate={…} />` (Slice 10) signature matches `FirstRun`'s usage. ✓
- `CreateWorkspaceModal` uses the `createWorkspace` server action; on success navigates to `/w/<slug>` via `router.push`. ✓
- `app/page.tsx` deletion is clean (no dangling imports, no dangling references to `ping-button` or `sign-out-button`). ✓

---

## Followup slices

A single small followup, file-scoped to one component, parallel-safe with anything else.

### Slice 15.F1 — Fix the "Make private" button on the public-board members notice

**Owner:** epic-executor (sonnet) · single-file slice

**Files:**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/members-table.tsx` (modify only)

**Problem:**
The public-board notice card (rendered when `isPrivate === false`) shows a "Make private" button (members-table.tsx:213-224) whose `onClick` is a stub toast about invitations. The label and behavior are mismatched.

**Spec — the binding choice:**
Wire the button to actually flip the board to private, with a confirm step.

1. Import `setBoardPrivacy` from `@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions`. (No new server action; just consume the existing one — Slice 15's "Does not modify server actions" forbidden scope still holds.)
2. Add a `useTransition` and a `useRouter` to the component. (The component is already `"use client"`.)
3. The button's `onClick` should:
   - Show a `window.confirm("Making this board private will hide it from workspace members who aren't invited. You can flip it back from the General tab.")` confirm prompt — matching the existing `PrivacySection` confirm style in `general-form.tsx:182-185` (this preserves consistency with the only other privacy-toggle entry point; do not introduce a different confirm chrome here).
   - On confirm, `startTransition` → `await setBoardPrivacy({ boardId, isPrivate: true })` → on `result.ok` toast success and `router.refresh()` (the page will then re-render as the private members table); on `!result.ok` toast `result.error.message`.
4. Disable the button while pending, swap label to "Updating…" while pending, otherwise keep the label "Make private".

**Forbidden scope:**
- Do NOT touch any server action.
- Do NOT touch the `general-form.tsx` privacy toggle.
- Do NOT touch the "Invite members" stub button on the private-board path (that one rides forward to the epic-level review as the documented deferred InviteModal `boardId` extension).
- Do NOT introduce a new Dialog component for the confirm — match the existing `window.confirm` pattern used by `PrivacySection` in `general-form.tsx`. (Both confirm-styled and `window.confirm`-styled boards exist in the app; the binding rule here is "match the only other privacy confirm callsite" so the epic-level review can decide on a single replacement pass.)

**Definition of done:**
- Clicking "Make private" on the public-board notice triggers the existing `setBoardPrivacy` server action with `isPrivate: true` after a confirm prompt.
- On success, the page re-renders with the private members table (because `setBoardPrivacy` already seeds the caller into `board_member` as owner; `getBoardRole` will return `"owner"`, the layout still admits, and `members/page.tsx` will now see `is_private=true` and render the table).
- The "Invite members" stub button on the private-board path is left untouched (deferred).
- `pnpm lint` and `pnpm typecheck` remain at the same green/pre-existing-noise baseline.

**Escalation triggers:**
- If the executor finds that `setBoardPrivacy` does not in fact seed the caller into `board_member` (it does — verified at lines 32-39 of `settings/general/actions.ts` — but if for any reason the executor reads otherwise, escalate before proceeding; the user could lock themselves out).

---

## Notes for the epic-level review (hand-off)

The epic-level review pass should sweep the full epic against `docs/conversion-plan/05-workspaces-boards.md`'s definition of done. The following items were **deliberately deferred** by Stage 4/5 reviewers and the dispatch plan; the epic-level review owns the close-out decision (close in this epic vs punt to a later epic).

1. **InviteModal `boardId` extension + `inviteToBoard` consumer wiring.**  
   The Slice 12 executor escalated this; Stage 4 review deferred; Slice 15 punts to two stub toasts on the board-members table ("Invite members" on the private path; the public-path button is being closed by the followup above). The epic doc lists "board-specific membership" and "invite, change role, remove" in the in-scope bullets; "invite" specifically is not yet wired for board-scoped invitations from the UI. Decide whether this is an epic-05 close-out or an epic-13 follow-on (notifications/email epic likely owns the invitation send-path anyway).

2. **`BoardCard` member stack** (Slice 11 executor punt — flagged to epic review per Stage 4 followup).

3. **`LastViewed` empty-state data pipeline** (no source for "recently viewed boards" yet — Slice 10 placeholder; flagged to epic review).

4. **`EditableTitle` imperative focus on board create** (Slice 11 follow-up: after creating a board the title should auto-focus for rename — currently doesn't).

5. **Privacy-toggle confirm chrome** (`window.confirm` everywhere → unified Base UI Dialog). Cosmetic; works as-is. Best closed as one batch in the epic-level visual sweep alongside any other stylistic-confirm cleanups.

6. **F2 — Playwright spec stub at `tests/e2e/05-workspaces-boards.spec.ts`** is the next sequential dispatch (per the dispatch plan, line 1775). Not blocked by this followup; can proceed in parallel to Slice 15.F1. The spec covers the happy-path documented at dispatch-plan line 1777 and is single-file, so no scope conflicts with the followup above.

