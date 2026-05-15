# Epic 06 — Followup Round 2

## Review summary

- **Stage reviewed:** Stage 3 (S7 RSC + BoardTable shell, S8 Group/Task primitives, S9 AddTask/Group footers + empty states)
- **Diff range:** `de94778..HEAD` (commits `e08fa6c`, `5391cfc`, `173da02`)
- **Verdict:** FOLLOWUP REQUIRED
- **DoD items met:**
  - `page.tsx` is RSC, loads groups/tasks/columns in parallel, then cells in a second round-trip; correctly omits `deleted_at` filters on `column` and `cell` (no such schema column).
  - `<BoardTable />` is `"use client"`, hydrates the Zustand store, renders `<GroupSection />` per group.
  - `<GroupSection />` and `<TaskRow />` render with the locked group color stripe via `--color-group-N` token (no raw hex).
  - `<TaskTitleCell />` uses `<EditableTitle>` with optimistic update + revert + toast on server failure (per Q1 = (a) decision).
  - `<AddTaskFooter />` chain-adds: clears value after Enter, input persists in DOM so focus is naturally retained.
  - `<AddGroupFooter />` opens an inline input with pre-selected "New Group" default; uses the two-call `applyGroupDelete` + `applyGroupUpsert` pattern noted as v1-acceptable in the spec.
  - `<NoGroupsEmptyState>` and `<NoTasksInGroupHint>` render and wire correctly.
  - All three guardrail audits pass cleanly across the 10 changed files: zero raw hex, zero `rgba()`, zero raw Tailwind color-scale classes, zero `as any`, zero `var(--x, #abc)` fallbacks, zero `router.refresh()` from optimistic flows.
  - All referenced CSS tokens (`--size-cell-h`, `--size-cell-w-task`, `--color-surface-row-hover`, `--z-sticky`, `--motion-base`, `--color-fg-muted`, etc.) exist in `app/globals.css`.
  - All referenced store methods (`hydrate`, `reset`, `applyTaskUpsert`, `applyTaskUpsertReplaceTemp`, `applyTaskDelete`, `applyGroupUpsert`, `applyGroupDelete`, `toggleGroupCollapse`) exist in `stores/board-store.ts`.
  - Hook order is preserved in every component (no conditional hooks; `useTransition` hoisted above the `TaskTitleCell` early-return).
  - Stage 3 touched only the 10 in-scope files; no edits to legacy or out-of-scope routes.
  - `pnpm lint` and `pnpm typecheck` clean per orchestrator confirmation.

- **DoD items NOT met:**
  - **S7 hydrate effect deviates from spec** (spec line 683: "cleanup calls `useBoardStore.getState().reset()` when boardId changes or component unmounts"). Implementation in `BoardTable.tsx` lines 22–36 uses `useEffect` deps `[boardId, initial.groups, initial.tasks, initial.cells]`. The ref-guard prevents re-hydration on dep change, but the cleanup `reset()` still fires on every dep change. When (a future) `router.refresh()` runs against the board page while `BoardTable` stays mounted, the new `initial` arrays from RSC will trigger cleanup → store reset → re-hydration BLOCKED by the ref-guard → empty store → empty UI until full unmount. Latent now (no current code path triggers it under Stage 3), but Realtime (epic 08) and any future board-header refresh-after-mutation flow will trip it. The executor's done-report for S7 explicitly flagged this as the trade-off it shipped.

- **Other issues found:**
  - None. The token discipline, optimistic-flow contracts, and file-scope discipline are all clean.

- **Items explicitly NOT followed up (deferred per spec):**
  - On-typing wash via `EditableTitle.onEditingChange` — deferred per S8 escalation note.
  - Drag handle / bulk-select checkbox / overflow menu placeholders in `<TaskRow>` and `<GroupSection>` — S11/S12/S13 cross-slice handoffs; their `aria-label`s already document the deferral; spec rule #25 explicitly permits this.
  - `applyGroupUpsertReplaceTemp` not added — the v1 two-call pattern is spec-acceptable.
  - Vitest not installed — pre-existing, tracked for epic 15.
  - Comment count badge on `<TaskRow>` — deferred to epic 09 per S8 spec.
  - `<TaskTitleCell />` returning a non-editable "Untitled" span for empty-title tasks — defensive fallback for legacy/migrated data; cannot trigger via Stage-3 flows because `<AddTaskFooter />` rejects empty titles at three guard points (`submitTask`, `handleKeyDown`, `handleBlur`).

---

## Followup slices

### Slice F2.1 — Fix `<BoardTable />` hydrate effect deps

**Owner:** epic-executor (sonnet) · **sequential, single-slice followup**

**Files (only):**
- `components/board/table/BoardTable.tsx` (modify — narrow change in the hydrate `useEffect`)

**Forbidden scope:**
- Any other file. Do not touch the store, the page, or any other table component. Do not refactor anything else in `BoardTable.tsx`.

**Spec:**

The current effect (lines 22–36) uses dep array `[boardId, initial.groups, initial.tasks, initial.cells]` and a `hydratedRef` to guard the body. This is wrong: the cleanup runs whenever the deps change (including on RSC re-render that produces fresh `initial` array references), but the ref-guard prevents re-hydration — so the store gets reset and stays empty.

Replace with the spec contract: the effect runs once per mounted board id; cleanup only runs on board change or unmount.

The minimum change:

```tsx
useEffect(() => {
  if (!hydratedRef.current) {
    hydratedRef.current = true;
    useBoardStore.getState().hydrate({
      boardId,
      groups: initial.groups,
      tasks: initial.tasks,
      cells: initial.cells,
    });
  }

  return () => {
    useBoardStore.getState().reset();
    hydratedRef.current = false;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [boardId]);
```

Key changes from the current shape:
1. **Deps array is `[boardId]` only.** `initial.*` arrays are intentionally excluded — those are server-fetched bootstrap data and must not retrigger hydration on a parent re-render. Use the `eslint-disable-next-line react-hooks/exhaustive-deps` comment with a short rationale comment immediately above (e.g. `// initial.* are bootstrap data; rehydration is keyed on boardId only — see followup-2.`).
2. **Cleanup resets the ref** so that when `boardId` changes the next effect run will re-hydrate against the new board's `initial` data.
3. The StrictMode double-invocation case still works: the first effect cycle hydrates + sets the ref; StrictMode's synthetic unmount fires cleanup (resets store + ref); StrictMode's synthetic remount runs the body again and re-hydrates from the same `initial` reference. This is correct behavior — StrictMode dev double-invocation is meant to surface exactly this kind of cleanup/setup symmetry.

Acceptance behaviors to manually verify (no test runner yet):
- Open a board → groups + tasks render (verifies first hydrate).
- Add a task via `<AddTaskFooter />` → row appears immediately (Zustand-driven re-render must NOT trigger a re-hydration cycle that would clobber the optimistic insert).
- Navigate to a different board (`/w/<slug>/b/<otherId>`) → other board's groups + tasks render (verifies boardId-change re-hydration).
- Navigate back → original board's groups + tasks render again.

**Definition of done:**
- `BoardTable.tsx`'s hydrate `useEffect` has dep array `[boardId]`.
- Cleanup resets `hydratedRef.current = false`.
- A short comment explains why `initial.*` are intentionally excluded from deps.
- `pnpm lint` and `pnpm typecheck` clean.
- ZERO changes to any other file.
- ZERO behavior change for the four manual-verification flows above.

**Escalation triggers:**
- If removing `initial.*` from deps surfaces a TypeScript error (it shouldn't — they're props, not closure-captured stale values), escalate before working around with a cast.
- If StrictMode dev mode shows a flicker after the change, escalate. The expected behavior is one hydrate → cleanup → hydrate again, all synchronous; no flicker.

**Guardrails applied:** #15 (no `as any`), #23 (RSC vs client — n/a, this is a client component), #24 (hooks at top level — preserved), #26 (file-scope discipline — single file).

---

## Open questions for the user

None. The fix is mechanical and the spec is unambiguous about the intended cleanup contract.
