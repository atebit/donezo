# Epic 06 — Followup Round 4

## Review summary

- **Stage reviewed:** Epic-level final review against `docs/conversion-plan/06-groups-tasks-table.md` Definition of Done across the cumulative diff `main..HEAD` (15 feature commits + 4 doc commits).
- **Verdict:** FOLLOWUP REQUIRED.
- **Definition-of-done items met:**
  - Loading a board renders groups + tasks via the RSC page (`page.tsx`) hydrating the Zustand store on mount (S7).
  - Add / duplicate / delete / recolor for groups + tasks update the UI immediately and persist (S5, S6, S8, S9, S13). Optimistic with revert on failure.
  - Drag-reordering groups and tasks (within group + cross-group) works via dnd-kit (S11). Touch deferred to epic 14 per spec.
  - Bulk-selecting and bulk-deleting completes in one server roundtrip via `bulkDeleteTasks` (S12).
  - Every mutation server action calls `logActivity` best-effort (verified across S5, S6, F1).
  - 5,000 tasks scroll budget covered by virtualizer (S10) + manual perf smoke harness (S17). Vitest/Playwright runners deferred to epic 15.
  - Acceptance scenario code paths exist end-to-end (verified per orchestrator note).
  - localStorage-persisted group collapse via Zustand `persist`, key `donezo:board-collapsed:v1`, partialized to only `collapsedByBoard`.
  - Keyboard navigation: ArrowUp/Down move between rows, Enter enters edit mode, Esc exits, off-screen rows trigger `scrollToTaskId` (S18 + S14 imperative API).
  - All guardrails clean on cumulative diff: zero new `window.confirm`, zero new `as any` (one comment-only mention explaining how it was avoided), zero raw color-scale Tailwind classes in shipping code, zero `task.board_id` writes (only reads + intentional `@ts-expect-error` annotations explaining the trigger contract per guardrail #20). Raw hex strings exist only in `lib/group-palette.ts` — a registry of palette identifiers that map to CSS tokens at render time, which is correct.
- **Definition-of-done items NOT met:**
  - **Rename via overflow menu is non-functional** for both groups and tasks. The "Rename" items in `TaskOverflowMenu` and `GroupOverflowMenu` are explicit no-ops with comments stating "S14 will add a focusTitle() ref and wire this menu item to call it." S14 has shipped the imperative API on `EditableTitle` (`EditableTitleHandle = { focus: () => void }`), but the overflow-menu consumers were never updated to use it. This is a guardrail #25 violation (callsite stubs for in-scope features) and an in-scope DoD gap — `rename` is explicitly listed as a Group operation and a Task operation in the epic doc's "In scope" section.
  - **GroupHeaderRow's `<EditableTitle>` does not take a ref**, so the API surface needed to imperatively trigger group rename does not even exist at the call site. Has to be plumbed.

## Other issues found

- None beyond the items already documented in the orchestrator's "deferred to other epics" list. All deferred items remain correctly out-of-scope for this epic.

## Followup slices

A single surgical slice is sufficient. Both menus follow the same pattern; the work is small and tightly coupled, so parallelizing it would only create merge conflicts.

### Slice F4.1: wire overflow-menu Rename to S14's imperative `EditableTitle.focus()`

- **Owner:** epic-executor (sonnet)
- **Scope (files this slice may touch):**
  - `components/board/table/TaskOverflowMenu.tsx`
  - `components/board/table/GroupOverflowMenu.tsx`
  - `components/board/table/BoardTable.tsx` (only the inline `GroupHeaderRow` helper — to add a ref + group-title-ref registration mechanism mirroring the existing task-title-ref map)
  - `components/board/table/table-keyboard-context.tsx` (to extend the context value with a `registerGroupTitleRef` + a method the overflow menu can call to focus a group title by id, mirroring how tasks already work — see "Approach" below for the alternative)
- **Forbidden scope:**
  - `components/shared/EditableTitle.tsx` — its imperative API is already correct; do not modify.
  - `components/board/table/TaskTitleCell.tsx` — already wires its ref and registers with the controller; do not modify.
  - `hooks/use-table-keyboard-nav.ts` — keyboard nav internals are not in scope here.
  - Any server actions, Zustand store, or migrations.
- **Dependencies on other slices:** None. S14 has already landed the API.

- **Approach:**

  The task-side and group-side wiring are slightly different shapes; pick the simplest path for each.

  **Task overflow menu (TaskOverflowMenu.tsx):**
  - Remove the no-op comment block and the no-op `onClick` handler.
  - Import `useTableKeyboard` from `./table-keyboard-context`.
  - In the component body, read the existing context value. Add a small method on the context (see below) called `focusTaskTitle(taskId: string): void`. The context already has `registerTitleCellRef` and an internal `titleCellRefs` map (declared in `BoardTable.tsx` at lines 262–271). Surface a `focusTaskTitle` callback alongside it that does:
    ```ts
    const focusTaskTitle = useCallback((taskId: string) => {
      const handle = titleCellRefs.current.get(taskId);
      handle?.focus();
    }, []);
    ```
  - Add `focusTaskTitle` to the `TableKeyboardContextValue` type in `table-keyboard-context.tsx`.
  - In `TaskOverflowMenu`, the Rename item's `onClick` becomes:
    ```ts
    onClick={() => {
      setMenuOpen(false);
      // Defer focus until after Popover.Close finishes its animation /
      // unmount; otherwise the popover's focus-restore steals focus back.
      setTimeout(() => focusTaskTitle(task.id), 0);
    }}
    ```
  - The `_group` prefix on the `group` prop can stay or be cleaned up (it's still part of the props contract per the existing comment).

  **Group overflow menu (GroupOverflowMenu.tsx):**
  - The group title's `<EditableTitle>` in `BoardTable.tsx`'s `GroupHeaderRow` (lines 192–198) does not currently take a ref. Add a local `useRef<EditableTitleHandle | null>(null)` in `GroupHeaderRow`, pass it as `ref={...}`, and register it with the controller via a new `registerGroupTitleRef(groupId, ref)` mirroring `registerTitleCellRef`.
  - In `BoardTable.tsx`, add a sibling map and registrar:
    ```ts
    const groupTitleRefs = useRef(new Map<string, EditableTitleHandle>());
    const registerGroupTitleRef = useCallback((groupId: string, ref: EditableTitleHandle | null) => {
      if (ref) groupTitleRefs.current.set(groupId, ref);
      else groupTitleRefs.current.delete(groupId);
    }, []);
    const focusGroupTitle = useCallback((groupId: string) => {
      groupTitleRefs.current.get(groupId)?.focus();
    }, []);
    ```
  - Extend the context value (and the type in `table-keyboard-context.tsx`) with `registerGroupTitleRef` and `focusGroupTitle`.
  - In `GroupHeaderRow`, on mount/unmount, wire `useEffect` to call `registerGroupTitleRef(group.id, editableRef.current)` (mirror the pattern in `TaskTitleCell.tsx` lines 28–33).
  - In `GroupOverflowMenu`, the Rename item's `onClick` becomes:
    ```ts
    onClick={() => {
      setMenuOpen(false);
      setTimeout(() => focusGroupTitle(group.id), 0);
    }}
    ```

  **Why `setTimeout(..., 0)`:** Base UI's `Popover.Root` restores focus to the trigger when it closes. If Rename calls `focus()` synchronously inside the same tick that closes the popover, the popover's focus-restore wins and the EditableTitle never enters edit mode. Deferring with a 0ms timeout sequences the focus *after* the popover's restore. (S14's `EditableTitle.focus()` already uses an internal `setTimeout` to defer past its own re-render — that handles the inner ordering, but does not protect against the popover stealing focus before the title's deferred focus runs.) An alternative is `requestAnimationFrame` — pick whichever the executor verifies works in a manual smoke. Document the choice in a code comment.

- **Type signatures (deltas):**

  In `components/board/table/table-keyboard-context.tsx`:
  ```ts
  type TableKeyboardContextValue = UseTableKeyboardNavReturn & {
    registerTitleCellRef: (taskId: string, ref: EditableTitleHandle | null) => void;
    registerGroupTitleRef: (groupId: string, ref: EditableTitleHandle | null) => void;
    focusTaskTitle: (taskId: string) => void;
    focusGroupTitle: (groupId: string) => void;
  };
  ```

- **Tests required:**
  - No new unit tests (the imperative `focus()` behavior is already covered by S14's tests; the wiring change is integration-only and would be exercised by a Playwright spec, which lands when the runner is wired in epic 15).
  - Update `tests/e2e/06-board-table.spec.ts` Rename-via-overflow-menu test stub (if not already present) to call the menu's Rename item and assert the title becomes editable. Keep the test `test.skip`'d per the epic 06 deferred-to-epic-15 convention. If the spec already has a stub for this scenario, leave a comment confirming it's covered. If not, add a `test.skip("group rename via overflow menu enters edit mode", ...)` and `test.skip("task rename via overflow menu enters edit mode", ...)` skeleton with the call sequence sketched out.

- **Definition of done:**
  - `TaskOverflowMenu` Rename calls the task title's `focus()` and the title cell enters edit mode (verified via manual smoke).
  - `GroupOverflowMenu` Rename calls the group title's `focus()` and the group header title enters edit mode (verified via manual smoke).
  - The two no-op comments and `// TODO(S14): wire imperative focus via EditableTitle ref` markers are removed from both menu files.
  - The S14 wiring path is symmetric for tasks and groups (same context-method pattern, same `setTimeout` deferral, same registration pattern).
  - `pnpm lint` and `pnpm typecheck` pass clean.
  - No new files. No new dependencies. No store changes. No migrations. No server-action changes.

- **Escalation triggers (needs-direction):**
  - If `setTimeout(..., 0)` and `requestAnimationFrame` both fail to defer past Base UI's focus-restore, escalate before adopting any larger structural change (e.g. controlled `defaultEditing` prop on `EditableTitle`). Do not modify `EditableTitle` to add new props as a workaround without architect sign-off — S14's API was deliberately minimal.
  - If the `GroupHeaderRow` registration causes any virtualizer thrash (the row may unmount/remount on scroll, which is the documented S11/S10 behavior), escalate. The expected behavior is that on remount the new ref re-registers, same as `TaskTitleCell` does today; if that turns out to be unreliable, the architect needs to weigh in.

## Open questions for the user

None. The fix is mechanical: the API exists, the consumers need to call it.
