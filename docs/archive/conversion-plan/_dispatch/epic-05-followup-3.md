# Epic 05 — Followup Round 3 (Stage 4)

Surgical fixes against `CLAUDE.md` token defaults and one role-gating bug found in the Stage 4 review (`epic-05-stage-4-review.md`). All three slices are parallel-safe — they touch disjoint files. None is required to unblock Stage 5; they should run in parallel with Stage 5 dispatch (or just before, at the orchestrator's discretion).

The **deferred** items from the review (InviteModal `boardId` extension, BoardCard member stack, LastViewed wiring, EditableTitle imperative focus) are intentionally **not** in this followup — see the "Other issues found" section of the review for the rationale and tracking notes.

## Followup slices

### Slice F3.1 — Tokenize destructive UI in board confirm modals + settings menu

**Owner:** epic-executor (sonnet) · **Stage:** Stage-4 followup, parallel-safe with F3.2 and F3.3

#### Files
- `components/board/BoardArchiveConfirmModal.tsx` (modify)
- `components/board/BoardDeleteConfirmModal.tsx` (modify)
- `components/board/BoardSettingsMenu.tsx` (modify)

#### Spec

`CLAUDE.md` requires Tailwind v4 + design-system tokens; raw color-scale classes (`bg-red-600`, `text-red-600`, etc.) are not allowed because they bypass the design system. The repo has a `--color-destructive` token (`#e2445c`, label-red) defined in `app/globals.css:208`, exposed as Tailwind utilities `bg-destructive`, `text-destructive`, `hover:bg-destructive/N`, etc. Use it.

Concrete edits:

**`components/board/BoardArchiveConfirmModal.tsx`**
- Line 63: replace `bg-red-600 ... hover:bg-red-700` with `bg-destructive text-white hover:bg-destructive/90` (or the existing project pattern — check `delete-workspace-modal.tsx` and `general/page.tsx` which already use `text-destructive` / `border-destructive` / `hover:bg-destructive/10`). Keep the `disabled:opacity-50` modifier and the surrounding spacing/text classes.

**`components/board/BoardDeleteConfirmModal.tsx`**
- Line 90: same replacement as above.

**`components/board/BoardSettingsMenu.tsx`**
- Line 150: replace `text-red-600 hover:bg-red-50 focus-visible:bg-red-50` with `text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10`. Keep all other classes on the `Menu.Item` unchanged.

Verification: after these edits, run `grep -rE 'red-(50|100|200|300|400|500|600|700|800|900)|amber-' components/board` and confirm zero matches.

#### Definition of done
- Zero raw Tailwind color-scale classes (`red-*`, `amber-*`, `emerald-*`, etc.) in the three files.
- All destructive surfaces use `--color-destructive` via Tailwind's `destructive` utility (e.g. `bg-destructive`, `text-destructive`, `hover:bg-destructive/N`).
- Visual fidelity: the Archive button, Delete button, and Delete-permanently menu item still read as red/destructive at runtime; only the source token changes.
- `pnpm lint` and `pnpm typecheck` are clean for these three files (the typecheck baseline does not regress).
- No behavioral changes — same disabled state, same handlers, same role gates (the role gate fix lives in F3.3).

#### Forbidden scope
- Does not modify `useBoard()`, `useWorkspace()`, or any context.
- Does not modify `BoardSettingsMenu`'s role gating (F3.3 owns that).
- Does not modify confirm-modal copy, layout, or aria.
- Does not introduce new tokens to `app/globals.css` — `--color-destructive` already exists and is sufficient.
- Does not touch `BoardStarToggle.tsx` (F3.2 owns the star color).
- Does not touch `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx` (F3.2 owns the destructive tokens there).

#### Escalation triggers
- If `bg-destructive` does not produce the expected red at runtime (i.e. the Tailwind v4 utility-name resolution fails), escalate — the project's Tailwind config is the upstream issue, not this slice.
- If a confirm-modal handler or aria attribute would need to change to satisfy the new class set, escalate — the spec is class-only.

---

### Slice F3.2 — Tokenize star color + workspace-trash destructive surfaces

**Owner:** epic-executor (sonnet) · **Stage:** Stage-4 followup, parallel-safe with F3.1 and F3.3

#### Files
- `components/shared/board-card/BoardCard.tsx` (modify)
- `components/board/BoardStarToggle.tsx` (modify)
- `app/(app)/w/[workspaceSlug]/trash/trash-list.tsx` (modify)

#### Spec

The design-system spec (`05-workspaces-boards.md:211`, `component-system.md §1.3`) states the board star uses `--color-label-yellow` filled. The current code uses `var(--color-warning, #f59e0b)` (BoardCard) and Tailwind `fill-amber-400 stroke-amber-400` (BoardStarToggle) — neither is the spec'd token. Additionally, the trash list ships several `var(--color-NAME, #raw)` patterns where the variable does not exist, leaving the raw hex as the live source of truth.

Concrete edits:

**`components/shared/board-card/BoardCard.tsx`** (line 73)
- Replace `optimisticStarred ? "var(--color-warning, #f59e0b)" : "var(--color-fg-muted)"` with `optimisticStarred ? "var(--color-label-yellow)" : "var(--color-fg-muted)"`.
- The `IconStar` `fill={optimisticStarred ? "currentColor" : "none"}` already inherits `color`, so no further changes needed.

**`components/board/BoardStarToggle.tsx`** (line 46)
- Replace the inline `fill-amber-400 stroke-amber-400` Tailwind classes with the same token via the `style` prop OR via the `cn()` arm: `optimisticStarred ? "fill-[color:var(--color-label-yellow)] stroke-[color:var(--color-label-yellow)]" : "fill-none stroke-[color:var(--color-fg-muted)]"`.
- Verify the rendered color matches the BoardCard star when both are active.

**`app/(app)/w/[workspaceSlug]/trash/trash-list.tsx`**
- Lines 84, 88, 202: replace `var(--color-danger, #e53e3e)` with `var(--color-destructive)`. There is no `--color-danger` token; `--color-destructive` is the project's standing token (`app/globals.css:208`).
- Line 203: replace `var(--color-danger-muted, #feb2b2)` with `color-mix(in oklch, var(--color-destructive) 30%, white)` OR the simpler `var(--color-destructive)` with `opacity: 0.4` on the disabled state. Prefer the latter; the disabled state uses `cursor: "not-allowed"` and `opacity` already, so route the disabled visual through a single `opacity` adjustment rather than introducing a new "muted" hex.
  - Concrete pattern: change the inline `style.backgroundColor` ternary to `canSubmit ? "var(--color-destructive)" : "var(--color-destructive)"` (single value), and add `opacity: canSubmit ? (pending ? 0.7 : 1) : 0.4` to the same `style` block. The semantics are identical — both branches were destructive red, just at different opacities.
- Line 280: replace `var(--color-surface-subtle)` with `var(--color-surface-row-hover)`. There is no `--color-surface-subtle` token defined; `--color-surface-row-hover` (`#f4f5f8`, `app/globals.css:18`) is the closest existing neutral table-stripe token. (Alternatively `var(--color-surface-rail)` — pick whichever produces the better visual contrast against the body background; both are defined.)

Verification: after these edits, run `grep -rEn '#[0-9a-fA-F]{3,8}|rgba?\(|var\(--color-(danger|warning|surface-subtle)' app/\(app\)/w components/board/BoardStarToggle.tsx components/shared/board-card` and confirm zero matches against the listed patterns. Tailwind `amber-*` and `red-*` should not appear in any of these three files.

#### Definition of done
- Zero hex literals in the three files.
- Zero references to undefined CSS variables (`--color-danger`, `--color-danger-muted`, `--color-warning`, `--color-surface-subtle`) in the three files.
- The board star renders `--color-label-yellow` when starred, on both `BoardCard` (workspace landing) and `BoardStarToggle` (board header).
- Trash list destructive controls render `--color-destructive`; disabled state via `opacity`, not via a separate undefined "muted" token.
- Trash table header background renders `--color-surface-row-hover` (or `--color-surface-rail`).
- `pnpm lint` and `pnpm typecheck` are clean for these three files.

#### Forbidden scope
- Does not introduce any new tokens to `app/globals.css`. The fix is consumer-side; if the user later wants `--color-warning` and `--color-danger-muted` as first-class tokens, that's a design-system.md amendment slice, not this one.
- Does not modify the confirm-name UX in `DeleteDialog` (the workflow is correct; only the colors change).
- Does not change `IconStar`'s API or props.
- Does not modify the board confirm modals (F3.1 owns).
- Does not modify `BoardSettingsMenu` role gating (F3.3 owns).

#### Escalation triggers
- If `var(--color-label-yellow)` does not produce the design-spec yellow at runtime (the variable IS defined at `globals.css:48` so it should), escalate.
- If `var(--color-destructive)` collides with an existing CSS rule that overrides destructive surfaces in a way the slice cannot reconcile, escalate — the project's destructive token resolution is upstream.

---

### Slice F3.3 — `BoardSettingsMenu`: gate "Delete permanently" on workspace-owner, not board-owner

**Owner:** epic-executor (sonnet) · **Stage:** Stage-4 followup, parallel-safe with F3.1 and F3.2

#### Files
- `components/board/BoardSettingsMenu.tsx` (modify only)

#### Spec

Per `05-workspaces-boards.md:138` ("Permanent delete (owner-only, type to confirm)") and `epic-05.md:1655` ("Delete (workspace-owner; opens type-name confirm)"), the destructive Delete-permanently menu item must be gated on the **workspace** role, not the **board** role. The current implementation reads `role === "owner"` from `useBoard()` (line 33) — this is the inherited board role, which can be `owner` for any user with a private-board membership of role `owner`, even if that user is `member` or `viewer` at the workspace level. The server action `deleteBoard` correctly enforces workspace-owner via `requireWorkspaceRole(_, 'owner')`, so this is a UI-only leak with no data risk — but it surfaces an action the server will reject and contradicts the spec.

Concrete edits:

1. Replace the `isOwner` derivation. Currently:
   ```tsx
   const { board, role } = useBoard();
   // ...
   const isOwner = role === "owner";
   ```
   Change to read the workspace role from `useWorkspace()`:
   ```tsx
   const { board, role } = useBoard();
   const { workspace, role: workspaceRole } = useWorkspace();
   // ...
   const isAdmin = ROLE_RANK[role] >= ROLE_RANK.admin;          // unchanged — board role
   const isWorkspaceOwner = workspaceRole === "owner";          // new — replaces isOwner
   ```
2. Update the "Delete permanently" Menu.Item gate (line 148): change `{isOwner && (` to `{isWorkspaceOwner && (`.
3. Leave `isAdmin` (board role admin+) as the gate for Toggle-privacy and Archive — those gates match the spec (admin+).
4. The existing `useWorkspace()` import on line 12 already provides `workspace`; this slice extends the destructure to include `role`. No new imports.

Verification:
- The test matrix to confirm: a private board where `board_member.role='owner'` for the caller AND `workspace_member.role IN ('admin','member','viewer')` should NOT see the Delete-permanently item. A board where the caller's `workspace_member.role='owner'` should see it.
- Any user without a workspace membership row never reaches the BoardLayout (notFound on `getBoardRole` returning null), so this UI is unreachable for non-members.

#### Definition of done
- `BoardSettingsMenu` reads `workspaceRole` from `useWorkspace()` and gates the Delete-permanently item on `workspaceRole === "owner"`.
- Toggle-privacy and Archive gates remain on board `isAdmin` (unchanged).
- The diff is local to `BoardSettingsMenu.tsx`. No other file changes.
- `pnpm lint` and `pnpm typecheck` are clean.
- No behavioral changes for users whose board role and workspace role are both `owner` (the common case for the workspace creator).

#### Forbidden scope
- Does not modify `useBoard()` / `useWorkspace()` hooks or context shapes.
- Does not modify `deleteBoard` server action — it already enforces workspace-owner correctly.
- Does not modify any other gate (Toggle privacy, Archive) — those stay at board-admin+.
- Does not touch tokens (F3.1 / F3.2 own).

#### Escalation triggers
- If the `useWorkspace()` hook does not expose `role` (it should — `WorkspaceContextValue.role` is in `lib/workspace-context.tsx`), escalate.
- If there is a hidden expectation that `BoardSettingsMenu` renders outside `WorkspaceProvider` (e.g., a future board-detail surface that bypasses the workspace layout), escalate — the spec assumes `BoardSettingsMenu` is always inside `WorkspaceProvider`, which is true in the current routing tree.

---

## Sequential follow-ups (after F3.1/F3.2/F3.3 land)

None within this round. All three slices are parallel and independent. The orchestrator can dispatch them simultaneously and merge in any order.

After this round lands, the Stage 4 verdict should flip to CLEAN. The epic-level review pass (after Stage 5) will track:
- Issue #4 (InviteModal `boardId` extension) — fold into Slice 15's board-members invite UI, or defer to epic 13.
- Issue #5 (BoardCard member stack + last-activity) — requires a `loadSidebarBoards` shape extension; defer to a polish followup or epic 09 (board members + activity).
- Issue #6 (LastViewed data wiring) — requires a per-user `last_viewed_at` data source; defer to epic 11 (filtering/views) or a dedicated slice.
- Issue #7 (EditableTitle imperative focus) — small primitive enhancement; bundle with epic 06 (groups/tasks) where the primitive sees more callsites.

## Risk notes

- All three slices are pure refactors. F3.1 and F3.2 are color-token replacements (no behavior change). F3.3 narrows a UI gate (no data risk; server already enforces).
- Visual fidelity: the destructive red shifts from `#dc2626` (Tailwind red-600) to `#e2445c` (`--color-destructive`). The latter is the project's brand red and is the correct value per the design system; the change is intentional.
- The board-star color shifts from `#fbbf24` (amber-400) to `#ffcb00` (`--color-label-yellow`). Brand-correct.
- No migration required. No types regen. No new server actions.
- These fixes are not Stage-5 prerequisites; the orchestrator may dispatch Stage 5 in parallel with this followup.

## Open questions for the user

None. All three slices have unambiguous concrete edits.

