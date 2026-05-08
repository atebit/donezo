# Epic 05 — Stage 4 Review

## Review summary

- **Stage reviewed:** Stage 4 — workspace + board pages (slices 11, 12, 13, 14).
  Commit range: `f8db52d..4b4b3ea` on `epic/05-workspaces-boards`. Specifically:
  - `6fb736c` — Slice 13 (workspace trash page).
  - `5e74753` — Slice 11 (workspace landing + BoardCard + CreateBoardModal + sidebar swap).
  - `1b4410a` — Slice 12 (workspace settings shell + general/members/billing + MemberModal + InviteModal).
  - `4b4b3ea` — Slice 14 (board layout + BoardHeader split + view tabs + settings menu + description/archive/delete modals + board home placeholder).
- **Verdict:** FOLLOWUP REQUIRED.
- The functional surface area defined for Stage 4 lands. Followup is required to retire concrete `CLAUDE.md` token violations (raw Tailwind colors and undefined CSS-variable fallbacks) and to repair one role-gating bug in `BoardSettingsMenu`. These do **not** block Stage 5; they are surgical and parallel-safe.
- **Stage 5 is unblocked** modulo the followup landing — Slice 15 (board settings) and Slice 16 (first-run redirect) do not depend on any of the gaps below.
- See **`docs/conversion-plan/_dispatch/epic-05-followup-3.md`** for the followup slice specs.

### Definition-of-done items met

**Slice 11 — Workspace landing + CreateBoardModal + BoardCard**
- `app/(app)/w/[workspaceSlug]/layout.tsx` resolves slug → workspace, runs `getWorkspaceRole`, calls `loadSidebarBoards`, and provides via `WorkspaceProvider`. Matches the binding amendment (Slice 4 reconciliation).
- `WorkspaceContext.sidebarBoards` is consumed by `WorkspaceSidebar` (verified — F2.1 already wired this) and by `BoardCardGrid` on the landing page.
- `app/(app)/w/[workspaceSlug]/page.tsx` is RSC, renders `<LastViewed boards={[]} />` (gracefully renders nothing when empty) and `<BoardCardGrid />`.
- `BoardCardGrid` partitions starred vs non-starred and falls back to `<NoBoardsInWorkspace>` when both are empty. Grid uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` per spec.
- `CreateBoardModal` is `"use client"`, Base UI `Dialog`, 500px wide, `--shadow-modal`, padding `16px 32px 32px`. Form: title (required), description, visibility (radio: workspace / private), template (Blank only; others disabled with "Coming soon"). Calls `createBoard` and `router.push('/w/<slug>/b/<id>')` on success; sonner toast on failure.
- `NewBoardButton` opens the real `CreateBoardModal` (cross-slice swap landed cleanly).

**Slice 12 — Workspace settings**
- Settings layout redirects member/viewer to the workspace landing; admin/owner pass through. Matches the spec's "admin/owner only" cohort gate.
- Settings nav highlights the active route via `--color-surface-active`; "Billing" is a disabled "Coming soon" item.
- `general/page.tsx` renders the `GeneralForm` and an owner-only "Delete workspace" section. Admins see a disabled-with-tooltip variant of the same affordance, matching the spec's "admin cannot delete" requirement.
- `DeleteWorkspaceModal` requires typing the workspace name; calls `deleteWorkspace`; redirects to `/`.
- `members/page.tsx` loads workspace members + active (non-revoked, non-expired, non-accepted) workspace-level pending invitations. Maps the joined `profile` shape correctly (handles array vs object via `Array.isArray` guard).
- `members-table.tsx` renders a plain semantic `<table>` (TanStack Table deferred to epic 06 per spec). Role dropdown is disabled for the current user's own row when their role is `owner` (no self-demotion path); Remove button is hidden for the current user (`!isSelf`). Both Resend and Revoke actions wire to Slice 5 server actions.
- `MemberModal` is presentational; chip background `--color-chip-member`, radius 8, avatar 22.
- `InviteModal` parses comma-separated emails, validates each, loops `inviteToWorkspace` per email, surfaces a sonner progress toast and per-email error aggregation.
- Pending-invitations section conditionally renders only when invitations exist.

**Slice 13 — Workspace trash**
- `app/(app)/w/[workspaceSlug]/trash/page.tsx` is RSC, runs `requireWorkspaceRole(_, 'admin').catch(() => null)` and 404s for non-admins. Members and viewers correctly land on `notFound()`.
- Archived board query relies on the `board_select_archived` policy from Slice 1 — the migration is on the branch, types are regenerated, no `as any` workarounds.
- `trash-list.tsx` renders Restore (admin+) and `Delete permanently` (workspace-owner only — gated client-side by `role === "owner"` and server-side by `deleteBoard`'s `requireWorkspaceRole(_, 'owner')`). Delete dialog requires typing the board name.
- Empty state renders `<TrashEmpty />` (Slice 10).

**Slice 14 — Board layout + BoardHeader + view tabs + board home**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` is RSC, loads board (with `description, is_private, created_by, deleted_at`), runs `getBoardRole`, queries `user_starred_board` for `isStarred`, wraps with `BoardProvider`. Matches the spec near-verbatim.
- `BoardHeader` ↔ `BoardHeaderClient` split is a defensible RSC boundary: the server file fetches board members + creator profile via two queries + a profile-id batch lookup; the client file owns interactive state. The original spec named only `BoardHeader.tsx`, but split files are not a regression — server data fetching cannot be `"use client"`. Acceptable.
- `BoardHeader` chrome: sticky `top-0`, `z-[var(--z-board-header)]`, padding `16px 30px 0 38px` (verified via `px-[38px] py-[16px] pr-[30px]`), inline `EditableTitle`, `BoardStarToggle`, tool row (Activity disabled, Members opens MemberModal, Invite is a TODO toast — see followup, Description opens BoardDescriptionModal), member avatar pile (`MemberStack` size 24 max 4), `BoardSettingsMenu` overflow.
- `BoardViewTabs`: 5 tabs (Table active, Kanban/Calendar/Timeline/Dashboard disabled with "Coming soon" tooltip). Active tab gets `border-b-2 border-primary`-equivalent via `after:` pseudo. RSC-friendly client component.
- `BoardStarToggle`: `useOptimistic` star state + `starBoard` action; aria-pressed correct.
- `BoardDescriptionModal`: 850×550 two-pane Base UI `Dialog`, right pane bg `--color-surface-info`, `EditableTitle` body variant for description, metadata pane (created-by, member count, workspace name).
- `BoardArchiveConfirmModal` + `BoardDeleteConfirmModal` exist; archive on confirm calls `archiveBoard` and navigates to `/w/<slug>`; delete requires typing the board name.
- `BoardSettingsMenu`: Rename, Set description, Duplicate, Toggle privacy (`isAdmin`), Archive (`isAdmin`), Delete permanently. Uses Base UI `Menu`. Each action wired to the correct server action.
- Board home `page.tsx` renders the empty-state placeholder.

**Cross-cutting**
- All routes are server components except where `"use client"` is required (forms, modals, optimistic toggles, sidebar interaction).
- All Stage-4 server actions reuse Stage-2 actions; no actions were re-implemented in pages.
- All migrations referenced (`user_starred_board`, `board.description`, `column.icon`, `restore_board`, `clone_board`, `board_select_archived`) are present and reflected in `lib/supabase/types.ts` (F1 already ran).
- `pnpm lint` is green.
- `pnpm typecheck`: only the documented Zod 4 / RHF resolver TS2769 noise (now extends to `CreateBoardModal`, `InviteModal`, and `general-form.tsx` — these are inherited from the same root cause as `sign-in`/`sign-up`/etc., per dispatch plan Risk 4 and the epic-04 final-review tracker). No other typecheck failures introduced by Stage 4.
- No legacy `frontend/` or `backend/` modifications.

### Definition-of-done items NOT met

1. **Token drift — raw Tailwind color classes.** `CLAUDE.md` is explicit that Tailwind v4 + design-system tokens are non-negotiable; the design system requires color tokens from `app/globals.css` (or `--color-label-*`) and never raw scale numbers or hex literals. Stage 4 introduces multiple raw Tailwind color usages:
   - `components/board/BoardArchiveConfirmModal.tsx:63` — `bg-red-600 hover:bg-red-700`.
   - `components/board/BoardDeleteConfirmModal.tsx:90` — `bg-red-600 hover:bg-red-700`.
   - `components/board/BoardSettingsMenu.tsx:150` — `text-red-600 hover:bg-red-50 focus-visible:bg-red-50`.
   - `components/board/BoardStarToggle.tsx:46` — `fill-amber-400 stroke-amber-400`. The design system `[component-system.md §1.3]` specifies the star uses `--color-label-yellow`, not Tailwind amber.
2. **Token drift — undefined CSS variables with raw-hex fallbacks.** These present as `var(--color-NAME, #raw)` patterns where the variable does not exist in `app/globals.css`, so the rendered color is the hex literal — i.e. the literal hex is the live source of truth, in violation of the no-hex rule:
   - `components/shared/board-card/BoardCard.tsx:73` — `var(--color-warning, #f59e0b)` (no `--color-warning` defined). Should be `var(--color-label-yellow)` per the same star-color spec as #1.
   - `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx:84,88,202` — `var(--color-danger, #e53e3e)`. There is no `--color-danger`; the existing token is `--color-destructive`.
   - `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx:203` — `var(--color-danger-muted, #feb2b2)` (undefined; the project does not currently have a destructive-muted token, so the hex always renders).
   - `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx:280` — `var(--color-surface-subtle)` (undefined; the table-header background falls through to the browser default since there's no fallback). The closest existing token is `--color-surface-row-hover` or `--color-surface-rail`.
3. **`BoardSettingsMenu` "Delete permanently" role gate is too lax.** `components/board/BoardSettingsMenu.tsx:33,148` checks `role === "owner"` against the **board role** from `useBoard()`. The epic-doc spec at `05-workspaces-boards.md:138` and the dispatch-plan spec at `epic-05.md:1655` both call this gate **workspace-owner**, not board-owner. For a private board where the caller has `board_member.role='owner'` but `workspace_member.role` is below owner, the menu currently exposes the destructive item. The server action `deleteBoard` correctly enforces workspace-owner, so this is a UI-only leak (no data risk) — but it shows an item the server will reject, which is a poor UX and contradicts the spec.

### Other issues found (deferred — not in scope for this followup)

The following gaps were surfaced during Stage-4 execution. None blocks Stage 5; the orchestrator should track them at the epic-level review pass or defer to a later epic per the recommendations below.

4. **`InviteModal` is hardcoded to workspace invitations.** Spec line 1527 required an optional `boardId` prop with `inviteToBoard` fallback. Slice 12 shipped only the workspace path; Slice 14's `BoardHeader` "Invite" tool is a TODO toast. **Defer to epic-level review pass.** Stage 5 (Slice 15: board settings) does not require board invitations from a header tool — the board settings members page surfaces invite via its own table flow. The board-header invite affordance can fold into the epic-level review or naturally land alongside epic 13 (Resend email-send), which is when the invitation flow becomes user-visible end-to-end.
5. **`BoardCard` member stack and last-activity are empty.** Slice 11 noted that `SidebarBoard` only carries `{ id, name, is_private, workspace_id }`; the card has no member data, no `updated_at`, no `description`. **Defer.** Expanding `loadSidebarBoards` to include per-board member previews and last-activity is a non-trivial query change (joins or aggregates), and the spec's card chrome can land with name + privacy + star without those affordances. Surface as an epic-level followup if the user wants the chrome filled in.
6. **`LastViewed` is rendered with `boards={[]}`** on the workspace landing. There is no `last_viewed_at` data source in the epic-05 schema; the widget renders nothing. **Defer.** Spec line 1455 implies wiring, but the underlying data pipeline (per-user board-visit tracking) is not in any Stage-1 migration and is out of scope for this epic. The widget gracefully no-ops when empty.
7. **`EditableTitle` does not expose an imperative focus method.** `BoardSettingsMenu`'s "Rename" item is a no-op toast that says "Click the board title to rename it." **Defer.** Adding a `ref`-based focus API to the primitive is a small but cross-cutting change that the title primitive should design intentionally (likely epic 06 when groups/tasks reuse it). The current toast is functional, if cosmetic.
8. **`BoardHeader` split into `BoardHeader.tsx` (Server) + `BoardHeaderClient.tsx` (Client).** The original file list named only `BoardHeader.tsx`, but server data fetching cannot live in a `"use client"` file. The split is a defensible RSC pattern — confirmed acceptable in this review.
9. **Workspace settings layout duplicates the workspace fetch.** Slice 12 noted that `useWorkspace()` is client-only and the settings layout is a server component, so the workspace row is fetched twice on `/w/<slug>/settings/*` — once in the parent workspace layout, once in the settings child layout. Acceptable DRY trade-off; both queries hit the same row and Postgres planner is fine. Optionally collapse via a server-side `getWorkspaceBySlug()` cache utility later (not in this followup).
10. **`CreateBoardModal.onSubmit` uses a targeted `as { id: string }` cast** because the Zod 4 / RHF resolver type-narrowing makes `result.data` inferable as `never`. Same root-cause class as `app/(auth)/sign-up/sign-up-form.tsx`. **Defer**, tracked under epic-04 final-review's standing Zod 4 / RHF item; do not flag as a new regression.

### Cross-slice consistency

- `WorkspaceProvider.sidebarBoards` flows from `loadSidebarBoards` in the workspace layout into `WorkspaceSidebar` (Stage 3 followup F2.1) and into `BoardCardGrid` (Slice 11). Both consumers read the same shape.
- `BoardProvider.{board,role,isStarred}` flows from the board layout into `BoardHeaderClient`, `BoardStarToggle`, `BoardSettingsMenu`, `BoardDescriptionModal`, and the confirm modals. Star toggle is optimistic on both card (workspace landing) and header (board page) and writes to the same `user_starred_board` table.
- `NewBoardButton` opens `CreateBoardModal` from anywhere it appears in the rail; the workspace landing page also renders `CreateBoardModal` via `BoardCardGrid` for the empty-state CTA.
- Trash page admin-gate matches the spec; `Delete permanently` is hidden from admins and visible to workspace owners.
- Workspace-settings layout redirects member/viewer to `/w/<slug>` (the workspace landing) — matches the spec.
- Members table disables role dropdown only for the current user's `owner` row (not for current-user rows of any role); this is correct per spec ("no self-demotion") — admins demoting themselves to member is allowed and the action server-side handles last-owner protection in Slice 5. Spec line 1517 says "disabled for the current user's own row" without role qualification; the current implementation is the safer interpretation.
- No Stage-4 page modifies a Stage-2 server action.
- No Stage-4 changes touch `frontend/` or `backend/`.

### Hand-off sanity for Stage 5

- **Slice 15 (board settings).** Routes (`app/(app)/w/[workspaceSlug]/b/[boardId]/settings/**`) inherit `BoardProvider` from the board layout, so `useBoard()` is available. `setBoardPrivacy`, `updateBoardDescription`, `setBoardMemberRole`, `removeBoardMember`, `archiveBoard`, `deleteBoard` all exist. `EditableTitle`, `Avatar`, button primitives all exist. **No Stage-4 contract blocks Slice 15.**
- **Slice 16 (`/` first-run redirect).** Reads `profile.last_workspace_id` (in Stage-1 migration; types regenerated) and uses `createWorkspace` (Slice 5) and `getWorkspaceRole`. **No Stage-4 contract blocks Slice 16.**
- The token-drift fixes in this followup do not change any public API or component contract; Slice 15/16 work in parallel with the followup.

---

## Notes for Stage 5 / epic-level review

- The "members table for board" in Slice 15 should mirror the Slice 12 members table closely. The plain-`<table>` approach + role dropdown + Remove button + InvitationActions are all reusable patterns; there's no shared component yet. Slice 15 may either copy the pattern (DRY-trade-off acceptable for now) or extract a `<MembersTable />` primitive — the dispatch plan does not require extraction.
- The board-settings members page must render the "This board is visible to all workspace members. Make it private to manage members individually." notice when `is_private = false` — confirmed in the spec; flag if Slice 15 misses it.
- `setBoardPrivacy(true)` already seeds `board_member { role: 'owner' }` for the caller (Slice 6 verified in followup-1). Slice 15 can rely on this.
- The InviteModal `boardId` extension (deferred issue #4) is the natural next followup after Stage 5 lands. Tracking note for the orchestrator: when Slice 15's members page surfaces "Invite to board" via the same InviteModal, the prop extension becomes mandatory. If Slice 15 implements board-invite UI and finds InviteModal lacking the prop, that slice should escalate (not invent the prop locally).
- The `BoardSettingsMenu` Toggle-privacy item shows for `isAdmin` — Slice 15's board-settings-general page also exposes the privacy toggle. Two surfaces, one server action, no conflict.

## Re-review pass — followup-3 verification

- **Pass scope:** F3.1 (`9cb5a1d`), F3.2 (`ab52082`), F3.3 (`59f28c2`).
  - Stage 5 commits `15bf1cb` (Slice 15) and `d29eda9` (Slice 16) are out of scope here and were not assessed.
- **Verdict:** **CLEAN.** All three Stage 4 followup gaps are closed. Stage 4 is done.

### F3.1 — destructive-UI tokenization in board confirm modals + settings menu

- `components/board/BoardArchiveConfirmModal.tsx:63` — destructive button is now `bg-destructive` + `hover:bg-destructive/90`. No raw `red-*` class remains.
- `components/board/BoardDeleteConfirmModal.tsx:90` — same swap; `disabled:cursor-not-allowed` preserved.
- `components/board/BoardSettingsMenu.tsx:150` — destructive `Menu.Item` uses `text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10`. No `text-red-*` / `bg-red-50` / `focus-visible:bg-red-50` remain.
- `grep -rEn 'red-(50|100|200|300|400|500|600|700|800|900)|amber-' components/board` → zero matches.

### F3.2 — undefined CSS variables and raw-hex fallbacks

- `components/shared/board-card/BoardCard.tsx:73` — starred color is `var(--color-label-yellow)`. The `var(--color-warning, #f59e0b)` form is gone.
- `components/board/BoardStarToggle.tsx:46-47` — starred icon uses `fill-[color:var(--color-label-yellow)] stroke-[color:var(--color-label-yellow)]`; unstarred path retained as `fill-none stroke-[color:var(--color-fg-muted)]`.
- `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx`:
  - Delete-permanently button (`:84,:88`) and modal confirm button (`:201`) → `var(--color-destructive)`. The `var(--color-danger, #e53e3e)` fallback chain is gone.
  - Cancel button (`:181-191`) — disabled state expressed via `opacity: pending ? 0.6 : 1` + `cursor: not-allowed`; no separate "muted" hex.
  - Table header row (`:278`) → `var(--color-surface-row-hover)`. The `var(--color-surface-subtle)` reference is gone.
- `grep -rEn '#[0-9a-fA-F]{3,8}|rgba?\(|var\(--color-(danger|warning|surface-subtle)' app/\(app\)/w/[workspaceSlug]/trash components/board/BoardStarToggle.tsx components/shared/board-card` → zero matches.

### F3.3 — Delete-permanently role gating in BoardSettingsMenu

- `components/board/BoardSettingsMenu.tsx:25` — pulls `role: workspaceRole` from `useWorkspace()`.
- `:33` — `const isWorkspaceOwner = workspaceRole === "owner"`.
- `:148` — Delete-permanently `Menu.Item` is gated on `{isWorkspaceOwner && …}`. Toggle-privacy (`:125`) and Archive (`:137`) gates remain on `isAdmin` (admin+) — unchanged, matches spec.
- `grep -n "isOwner" components/board/BoardSettingsMenu.tsx` → zero matches. The dropped board-`isOwner` symbol is gone.

### Other checks

- **Scope discipline.** `git show --stat` for the three F3 commits touches only the six files in the followup specs (3 + 3 + 1, with `BoardSettingsMenu.tsx` modified in both F3.1 and F3.3). No other files moved.
- **`pnpm lint`:** clean (verified by orchestrator).
- **`pnpm typecheck`:** 13 errors across 10 files. All are the pre-existing Zod 4 / `@hookform/resolvers` overload mismatch baseline — every error trace lives in `app/(auth)/*-form.tsx`, `app/(app)/account/account-settings.tsx`, the two `settings/general/general-form.tsx` files, `CreateBoardModal`, `CreateWorkspaceModal`, `InviteModal`. None of the F3-touched files (`BoardArchiveConfirmModal`, `BoardDeleteConfirmModal`, `BoardSettingsMenu`, `BoardCard`, `BoardStarToggle`, `trash-list.tsx`) appear in the error set. The +3 versus the recorded "Stage 4 + F3 baseline of 10" is fully accounted for by Slice 15's two new general-forms and Slice 16's account-settings — both out of scope here. **No new error originates in F3.**
- **Deferred items remain deferred.** Issue #4 (`InviteModal.boardId` extension), Issue #5 (`BoardCard` member stack), Issue #6 (`LastViewed` wiring), Issue #7 (`EditableTitle` imperative focus) are not flagged again here — they remain on the epic-level followup ledger as previously noted.

### Non-blocking observations

- F3.2 inlines `var(--color-label-yellow)` in `BoardCard` via inline `style.color`. Since the Tailwind arbitrary-property form (`fill-[color:var(...)]`) is used elsewhere (e.g. `BoardStarToggle`), there is a minor inconsistency between the two card surfaces. Not a violation — both reference the same defined token. Worth normalizing in a later polish pass, not now.
- The Trash list's table-row hover background (`var(--color-surface-row-hover)`) is reused as the table-header background. Semantically a stretch, but the token does exist and the visual is fine. If a dedicated `--color-surface-table-header` is introduced later, swap then.

**Stage 4 review loop closed. No Followup-4 needed.**
