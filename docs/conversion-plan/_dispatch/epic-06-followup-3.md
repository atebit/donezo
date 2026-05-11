# Epic 06 — Followup Round 3 (Stage 4 review)

## Review summary

- **Stage reviewed:** Stage 4 (S10 virtualization, S11 dnd-kit, S12 bulk selection, S13 overflow menus + ColorPalette + AddColumnButton)
- **Diff range:** `e14777e..HEAD` on `epic/06-groups-tasks-table` (commits `c05a05f`, `db659b0`, `2d36cb0`, `7143cdc`)
- **Verdict:** **FOLLOWUP REQUIRED**

### Definition-of-done items met

- S11: dnd-kit DnD wired for groups + tasks; within-group reorder uses `positionBetween`; cross-group falls through to "append at end" when destination tasks aren't in DOM (documented limitation).
- S11: optimistic move sets only `group_id` and `position`; **no `task.board_id` writes** (verified — only mention is a comment citing guardrail #20).
- S12: Base UI `<Checkbox.Root indeterminate>` confirmed supported by `@base-ui/react@^1` (`indeterminate` prop in `CheckboxRoot.js`); tri-state board-level + group-level checkboxes wired to store; bulk-delete uses Base UI `<Dialog>` confirm; bulk-move via Base UI `<Popover>`; "Apply column value" disabled with Base UI `<Tooltip>` ("Coming in epic 07").
- S12: optimistic snapshot+revert pattern correct for bulk delete and bulk move; bulk duplicate is pessimistic.
- S13: GroupOverflowMenu + TaskOverflowMenu use the `<MenuList />` recipe; Recolor opens nested `<ColorPalette>` Popover (12 swatches via `--color-group-N`); Delete uses Base UI `<Dialog>` confirm.
- S13: AddColumnButton is **disabled with Base UI Tooltip** (NOT a toast — Q8 = (a) honored).
- S13: TaskOverflowMenu "Open task" links to the epic-09 placeholder route as planned.
- All 28 guardrails verified clean across the 15 modified/created files: no raw hex, no `as any`, no `window.confirm`, no raw Tailwind color-scale (`bg-red-*` etc.), no `task.board_id` writes.
- `pnpm lint` and `pnpm typecheck` pass clean (per orchestrator).

### Definition-of-done items NOT met

1. **S10 virtualization is structurally non-functional under the actual board route layout.** The S10 done report claimed "the parent SidebarShell chain guarantees 100dvh at the root with all intermediate divs set to overflow: hidden". This is FALSE for the board route:
   - `app/(app)/layout.tsx` → `SidebarShell` ends with `<main style={{ flex: 1, overflow: "auto" }}>` (`components/shared/sidebar/SidebarShell.tsx:61–67`).
   - `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` returns `<BoardProvider>{<BoardHeader/><BoardViewTabs/>{children}}</BoardProvider>` — **no flex column wrapper around children**.
   - `<BoardTable>` is the root `{children}`; it applies `className="flex flex-col flex-1 min-h-0"`. Because its parent is not a flex container, `flex-1` is a no-op and `min-h-0` is irrelevant.
   - Net effect: `<BoardTable>` collapses to its natural content height; `<TableVirtualizer>`'s inner `flex-1 min-h-0 overflow-auto` likewise has no constraining height; **the virtualizer does not virtualize** — every row paints; the `<main>` element handles scrolling.
   - This violates S10's primary DoD: *"1,000 rendered rows do not blow up the DOM (virtualizer drops off-screen rows)."*
   - This also breaks S12's `<BulkActionBar />` `sticky bottom-4` placement (it sticks to the bottom of an unconstrained table, not the viewport).

2. **S12 BulkActionBar diverges from the must-match spec.** `docs/conversion-plan/component-system.md §3.9` requires `position: fixed; bottom: 35px; height: 63px; width: 60%` (fidelity bar = `must-match`). The implementation uses `sticky bottom-4` with no fixed height/width. Even if the layout chain were fixed, this still misses the must-match contract.

### Other issues found

- **Orphaned file `components/board/table/GroupSection.tsx`** is no longer reachable from any callsite (sole references are this file, the inline comment in `BoardTable.tsx:37–40`, and the comment in `GroupOverflowMenu.tsx:7–8`). Acceptable for the epic, but should be deleted (or re-wired) to avoid drift. Tracked as a small followup slice below.

- **S13 Rename menu items are silent no-ops** (`GroupOverflowMenu.tsx:178–187`, `TaskOverflowMenu.tsx:141–150`) pending S14 imperative `focus()` API on `EditableTitle`. Per the strict reading of guardrail #25 ("no callsite stubs for in-scope features"), this is borderline; pragmatic reading allows it because S14 is the next slice in Stage 5 and the stubs are TODO-tagged. **Verdict: acceptable as a controlled deferral** because (a) the stubs do not lie to the user (no toast claiming success), (b) S14 is dispatched as the very next sequential step, (c) the spec for S13 itself anticipates this exact path. No followup needed; S14 will close it.

- **S13 `duplicateGroup` returns only the new group row, not its cloned tasks.** `GroupOverflowMenu.handleDuplicate` calls `applyGroupUpsert(result.data) + router.refresh()`. The user briefly sees an empty duplicated group until the RSC refresh completes. Acceptable v1 — the alternative (changing the server action signature to return tasks) is not a Stage 4 scope item and the RSC refresh fully resolves it. No followup required.

- **`bulkDeleteTasks` revert is correct** (snapshots all selected tasks, re-inserts on failure). The cascade-during-revert concern noted in the worklist applies only to S13's `deleteGroup` flow (where `applyGroupDelete` cascades client-side to tasks; revert restores the group only). Acceptable — server-side delete didn't happen on failure, so the cascaded tasks reappear on the next `router.refresh()` / navigation. No followup required.

- **TableScrollContext API matches S18 spec** (`useTableScroll(): { scrollToTaskId(taskId): void }`). No followup.

---

## Followup slices

Two followup slices. The first is mandatory for the epic to ship (fixes the broken virtualization deliverable). The second is small cleanup.

### Followup F3.1 — Fix board route layout chain so virtualization works + restore BulkActionBar fixed-position spec

**Owner:** epic-executor (sonnet) · **Stage 4 followup, sequential (only slice in this round at this sequencing position)**

**Scope (files this slice may touch):**

- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (modify — wrap `{children}` in a flex-column container with constrained height)
- `components/board/table/BulkActionBar.tsx` (modify — replace `sticky bottom-4` with `position: fixed` per the must-match spec)

**Forbidden scope:**

- `<main>` in `components/shared/sidebar/SidebarShell.tsx` — do not touch app shell layout. SidebarShell's `<main overflow:auto>` is a workspace-wide contract used by every other route; the fix belongs in the board layout, which is the only sub-route that needs a clipped scroll container.
- Any other Stage 4 file. No drive-by changes.
- `BoardTable.tsx` — its `flex flex-col flex-1 min-h-0` shape is already correct given a proper flex parent.

**Spec — board layout fix:**

The board layout currently renders three siblings into `{children}` of `<main overflow:auto>`:

```tsx
<BoardProvider ...>
  <BoardHeader boardId={board.id} />
  <BoardViewTabs />
  {children}
</BoardProvider>
```

Change to:

```tsx
<BoardProvider ...>
  <div className="flex flex-col h-full min-h-0">
    <BoardHeader boardId={board.id} />
    <BoardViewTabs />
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {children}
    </div>
  </div>
</BoardProvider>
```

Why `h-full` on the outer wrapper: `<main>` already has `flex: 1; overflow: auto` from SidebarShell. Wrapping its child in a `flex-col h-full min-h-0` container converts that auto-grow space into a fixed-height flex column. The inner `<div className="flex flex-col flex-1 min-h-0 overflow-hidden">` clips children (e.g. `<BoardTable>`) so that the BoardTable's own `flex-1 min-h-0` finally has a constraining parent. The `overflow-hidden` on the inner wrapper means `<main>`'s `overflow: auto` no longer drives scrolling for the board route — the virtualizer's inner scroll container becomes the only scroll surface, which is what S10 requires.

**Risk:** `<main overflow:auto>` is shared with non-board routes. Wrapping inside the board layout (not in SidebarShell) means non-board routes still get the existing `overflow: auto` behavior. That's intentional and matches what other routes need.

**Verification (manual):**
- Open `/w/<slug>/b/<board>` with React DevTools — the BoardTable's TableVirtualizer scroll div should now have a fixed pixel height equal to `<main height> - <BoardHeader height> - <BoardViewTabs height>`.
- Scroll the table — only the inner div should scroll; `<main>` should not show a second scrollbar.
- Verify with a board containing 100+ tasks: the rendered DOM should contain only ~22 row divs (overscan 12 above + visible + overscan 12 below), not all 100.

**Spec — BulkActionBar fix:**

Replace the current `sticky bottom-4` outer wrapper with `position: fixed` per the `component-system.md §3.9` must-match spec:

- Outer: `position: fixed`, `bottom: 35px`, `height: 63px`, `width: 60%`, `left: 50%`, `transform: translateX(-50%)`. Z-index `var(--z-popover)` (10) so it floats above tables but below modals (`var(--z-modal)` = 51).
- Keep the existing slide-in animation on `opacity` + `transform` (the `translateY` should compose with `translateX(-50%)` — apply both transforms together, e.g. `translate(-50%, 0)` when visible and `translate(-50%, 100%)` when hidden, so the centering is preserved during the slide).
- Keep all other internals (count tile, action buttons, popover, dialog) unchanged.

**Risk:** `position: fixed` viewports the bar over the workspace sidebar on narrow viewports; for now `width: 60%` per the spec is acceptable. Document any narrow-viewport overflow as out of scope (epic 14 a11y/responsive polish owns it).

**Definition of done:**
- The board route layout wraps `{children}` in a `flex flex-col h-full min-h-0` container with an inner `flex-1 min-h-0 overflow-hidden` div around `{children}`.
- A board with ≥100 tasks renders only the visible window + overscan in the DOM (verifiable via React DevTools or a simple `document.querySelectorAll('[data-task-id]').length` check).
- BulkActionBar uses `position: fixed`, `bottom: 35px`, `height: 63px`, `width: 60%`, centered horizontally; remains visible while the table scrolls.
- ZERO raw hex; ZERO `as any`; `pnpm typecheck` and `pnpm lint` clean.
- No regression in non-board routes (the SidebarShell `<main>` was not touched).

**Escalation triggers:**
- If the inner `overflow-hidden` div breaks BoardHeader sticky positioning or the BoardSettingsMenu popover positioning (both rendered above this wrapper at the layout level — should be unaffected, but verify), escalate.
- If `position: fixed` on BulkActionBar fights with the Topbar (Topbar is part of SidebarShell, not the board layout — they shouldn't interact, but verify z-indexes).

**Guardrails applied:** #1 (no raw hex), #5 (Base UI primitives untouched), #15 (no `as any`), #23 (`"use client"` discipline — board layout stays a server component), #26 (file-scope discipline — only the two files listed).

---

### Followup F3.2 — Delete orphaned `GroupSection.tsx`

**Owner:** epic-executor (sonnet) · **Stage 4 followup, parallel-safe with F3.1**

**Scope (files this slice may touch):**

- `components/board/table/GroupSection.tsx` (delete)

**Forbidden scope:** any other file.

**Spec:**

`GroupSection.tsx` is unreachable from any callsite. The S10 virtualizer flattening replaced it with the inline `GroupHeaderRow` helper in `BoardTable.tsx` (lines 47–213). All Stage 4 slices explicitly avoided modifying `GroupSection.tsx`. Leaving it in place creates drift (future contributors may try to import it, then discover its props don't match the virtualizer-flattened layout).

Delete the file. Verify nothing imports it:

```sh
rg -n 'from\s+["'\''][^"'\'']*GroupSection' components app
rg -n 'import\s+\{[^}]*GroupSection' components app
```

Both should return zero matches after the file is removed. Update the inline comment in `BoardTable.tsx:37–40` and `GroupOverflowMenu.tsx:7–8` to remove the "GroupSection.tsx is orphaned/untouched" notes (they become misleading once the file is gone).

**Wait — that touches `BoardTable.tsx` and `GroupOverflowMenu.tsx`, both modified in F3.1's adjacent epic 06 surface area.** Resolution: this slice IS allowed to edit those two files for the *single purpose* of removing the now-obsolete orphan-comments. F3.1's scope is `app/.../layout.tsx` and `BulkActionBar.tsx` only, so the file scopes do not collide.

**Definition of done:**
- `components/board/table/GroupSection.tsx` is deleted.
- The orphan-status comments in `BoardTable.tsx:37–40` and `GroupOverflowMenu.tsx:7–8` are removed.
- `rg -n 'GroupSection' components app` returns zero matches (or only matches inside legacy gitignored paths).
- `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If `pnpm typecheck` reveals a hidden import path you didn't find, do not silently re-add the file — escalate.

**Guardrails applied:** #26 (file-scope discipline), #15 (no casts).

---

## Open questions for the user

None. F3.1 is the necessary fix to deliver S10's DoD; F3.2 is mechanical cleanup. Both can be dispatched in parallel — they touch disjoint files.
