# Epic 06 — Groups & Tasks (Table View)

## Goal

The core table experience: virtualized rows grouped into collapsible sections, drag-and-drop ordering, inline editing of task titles, bulk select and actions, and the basic add/rename/duplicate/delete flow. Columns and cells beyond the title field are stubbed and filled in by [07](07-column-system.md). After this epic, a board feels like a working table even if every column other than "Name" is missing.

## Why this is its own epic

The table is the highest-stakes UI in the app. Virtualization, drag-and-drop, inline editing, sticky columns, and bulk selection are nontrivial individually and combinatorially. Pulling them into one epic isolates the engineering risk and produces a clear, testable surface. Cells/columns are split into [07](07-column-system.md) so this epic can land on a single column type (text/title) without column infrastructure churn.

## In scope

- Table layout with sticky header, sticky first column (task title), virtualized rows (TanStack Virtual).
- Group sections: header (color, title inline edit, count, collapse), task rows, "Add task" footer.
- Group operations: add, rename, recolor, duplicate, delete, reorder (DnD).
- Task operations: add (inline), rename (inline), duplicate, delete, reorder within group, move across groups (DnD).
- Bulk select: row checkbox, header "select all in group" / "select all on board," bulk actions toolbar (delete, duplicate, move-to-group).
- Optimistic updates for cell edits, with rollback on server error.
- Fractional-position reorder algorithm.
- "Add column" affordance in the header (UI hook for [07](07-column-system.md)).
- Empty states (no groups, no tasks in group).
- Responsive table behavior — graceful degradation on narrow viewports (full responsive treatment in [14](14-mobile-a11y-polish.md)).

## Out of scope

- Cell editors beyond title ([07](07-column-system.md)).
- Column reorder ([07](07-column-system.md)).
- Filtering, sorting, search ([11](11-filtering-views.md)).
- Realtime broadcast of changes ([08](08-realtime-presence.md); local-only in this epic, but scaffolded so subscriptions plug in cleanly).
- Comments and activity ([09](09-comments-activity.md)).
- Attachments ([10](10-attachments.md)).

## Dependencies

[01](01-foundation.md), [02](02-supabase-schema.md), [03](03-auth.md), [04](04-authorization-rls.md), [05](05-workspaces-boards.md).

## Architecture & design choices

### TanStack Table + Virtual

`@tanstack/react-table` for headless table state (columns, rows, grouping, selection). `@tanstack/react-virtual` for row virtualization. Virtualizing **only the rows** keeps the implementation simple; column virtualization isn't needed until users have 30+ columns (rare).

Why headless: every visual choice (cell styling, group header, sticky columns, density) is custom. shadcn's table is a starting point; the actual board table diverges.

### Why dnd-kit, not react-beautiful-dnd

react-beautiful-dnd is abandoned and has known touch issues. `@hello-pangea/dnd` is a maintained fork but inherits the same architectural quirks (no nested droppables, awkward virtualization integration). dnd-kit:

- Active maintenance.
- Touch-capable.
- First-class virtualization integration via `useDraggable` + `Sortable` adapters.
- Nested drop zones (essential for task-into-other-group) work cleanly.
- Better keyboard accessibility.

### Data fetching

`/w/[slug]/b/[boardId]/page.tsx` (RSC):

```ts
const supabase = await createClient();
const [{ data: board }, { data: columns }, { data: groups }, { data: tasks }, { data: cells }] =
  await Promise.all([
    supabase.from("board").select("id, title, description, is_private").eq("id", boardId).single(),
    supabase.from("column").select("*").eq("board_id", boardId).order("position"),
    supabase.from("group").select("*").eq("board_id", boardId).is("deleted_at", null).order("position"),
    supabase.from("task").select("*").eq("board_id", boardId).is("deleted_at", null).order("position"),
    supabase.from("cell").select("*").in("task_id", taskIds),
  ]);
```

Five queries; all served by one Supabase HTTP round-trip via `Promise.all`. The cell query depends on task ids, so it's a second round-trip — acceptable. For very large boards we can add a `board_snapshot(p_board_id)` Postgres function that returns JSON in one call (deferred until perf demands).

The result is passed to a `<BoardTable />` client component as one prop bag. Subsequent updates use Supabase Realtime ([08](08-realtime-presence.md)) to mutate this client state in place — no full refetch.

### Client state: Zustand

The board table needs client state for:

- Selection (which rows are checked).
- Drag-in-progress (visual indicators).
- Inline-edit (which cell is being edited).
- Column visibility (per-user, persisted via [11](11-filtering-views.md)).
- Optimistic mutations queue.

A Zustand store per board: `useBoardStore(boardId)`. Resets on board navigation. Realtime updates apply to this store.

```ts
// stores/board-store.ts
import { create } from "zustand";

type BoardState = {
  groups: Group[];
  tasks: Task[];
  cells: Map<string, Cell>;          // key: `${taskId}:${columnId}`
  selection: Set<string>;            // task ids
  draggingTaskId: string | null;
  // mutations
  applyTaskUpdate: (task: Task) => void;
  applyTaskDelete: (taskId: string) => void;
  applyCellUpdate: (cell: Cell) => void;
  // ...
};
```

The store is pure state + reducers. Side effects (server-action calls) happen in components or hooks. This separation makes optimistic updates trivial: `apply...` runs immediately; the action runs in the background; on failure, an inverse `apply...` rolls back.

### Fractional position algorithm

Insert between `a` and `b`: `(a + b) / 2`. End-insert: `a + 1`. Front-insert: `a - 1` if `a > 0` else `a / 2`. Implemented in `lib/positions.ts`:

```ts
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return 1;
  if (prev === null) return next! - 1;
  if (next === null) return prev + 1;
  return (prev + next) / 2;
}
```

After many drags, positions converge toward zero precision. A nightly Edge Function compacts positions for active boards (resets to integers). Schedule in [15](15-observability-testing-cicd.md).

### Drag-and-drop choreography

Two draggable kinds: `group` and `task`. dnd-kit's `DndContext` wraps the table; `SortableContext` per group's task list and one for the board's groups.

On drop:

1. Compute new position via `positionBetween`.
2. Apply optimistic update to Zustand.
3. Server action: `reorderGroup({ groupId, newPosition })` or `moveTask({ taskId, newGroupId, newPosition })`.
4. On success, no further action (Realtime will echo, but server-action result also returns the new row for reconciliation).
5. On failure, revert Zustand.

Cross-group drops: if `newGroupId !== task.group_id`, the server action updates `task.group_id` and `task.board_id` (denormalization stays consistent because `group.board_id` is the source).

### Inline title edit

Click on task title cell → contenteditable. `Enter` saves; `Esc` cancels. Blur saves. While editing, the cell expands to a single-line input with auto-focus.

For accessibility, use a real `<input>` swapped in on edit, not contenteditable. Contenteditable has poor screen-reader support and no native form semantics.

```tsx
function TaskTitleCell({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  // ...
  return editing ? (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
      autoFocus
    />
  ) : (
    <button onClick={() => setEditing(true)} className="text-left w-full">
      {task.title || <span className="text-fg-muted">Untitled</span>}
    </button>
  );
}
```

### Bulk selection

A row checkbox toggles selection in Zustand. Group header has a "select all in group" tri-state checkbox. Top-of-table has a "select all" tri-state.

When >0 rows selected, the topbar replaces breadcrumbs with a bulk-action toolbar:

- "X tasks selected"
- Buttons: Duplicate, Delete, Move to group ▾, Apply column value ▾ (a [07](07-column-system.md) hook — disabled in this epic), Clear selection.

Server actions accept arrays: `bulkDeleteTasks({ taskIds })`, `bulkMoveTasksToGroup({ taskIds, groupId })`, `bulkDuplicateTasks({ taskIds })`. Each runs in a single SQL statement where possible.

### "Add task" affordance

Footer row in each group: "+ Add task" button → inline input → Enter creates task. Pressing Enter again creates another (chain-adding). Esc dismisses.

Group footer also shows an aggregate row (counts/sums per column). Aggregates beyond "count of tasks" land in [07](07-column-system.md) where columns know how to aggregate.

### "Add group" affordance

Footer of the board: "+ Add new group" button → opens an inline group-header input. Enter creates with default color and a "New Group" title (pre-selected for easy rename).

### Sticky columns

The first column (task title + checkbox + drag handle) is sticky-left via CSS `position: sticky; left: 0; z-index: 1`. Header row is sticky-top. Both stay visible during scroll.

For 30+ columns, horizontal scroll with sticky first column is the desktop-friendly pattern. Mobile responsive treatment in [14](14-mobile-a11y-polish.md).

### Density / row height

Three densities: compact (28px), default (40px), spacious (56px). Persisted per-user per-board in `view.config` (saved views, [11](11-filtering-views.md)). For epic 06, hard-code default density; expose the toggle in [11](11-filtering-views.md).

### Performance budgets

- Render 5,000 tasks at 60fps scroll. (TanStack Virtual handles this.)
- Drag start to commit: <100ms perceived.
- Initial board load TTI: <500ms after RSC data arrives.

Profile with React DevTools + Chrome perf panel during development. Memoize cell components by `(task, column, cell)` identity. Use `useDeferredValue` for filter input ([11](11-filtering-views.md)).

### Activity logging hooks

Every mutation server action writes an `activity` row via the service-role client. Action names: `task.created`, `task.renamed`, `task.deleted`, `task.duplicated`, `task.moved`, `group.created`, `group.renamed`, `group.recolored`, `group.deleted`, `group.reordered`, `task.cell_changed` (the latter is fired by [07](07-column-system.md) cell editors, not here).

The activity writer is a small helper:

```ts
// lib/activity.ts
import { admin } from "@/lib/supabase/admin";

export async function logActivity(args: {
  boardId: string;
  actorId: string;
  action: string;
  taskId?: string;
  groupId?: string;
  columnId?: string;
  payload?: Record<string, unknown>;
}) {
  await admin.from("activity").insert({
    board_id: args.boardId,
    actor_id: args.actorId,
    action: args.action,
    task_id: args.taskId,
    group_id: args.groupId,
    column_id: args.columnId,
    payload: args.payload ?? {},
  });
}
```

### Server actions

In `app/(app)/w/[slug]/b/[boardId]/actions.ts`. Each wrapped in `withUser` + an inline `requireBoardRole(boardId, "member")` check.

- `createGroup({ boardId, title, color, position })`
- `renameGroup({ groupId, title })`
- `recolorGroup({ groupId, color })`
- `reorderGroup({ groupId, position })`
- `duplicateGroup({ groupId })` — copies tasks + cells with new ids
- `deleteGroup({ groupId })` — soft delete
- `toggleGroupCollapse({ groupId, collapsed })` — UI state, persists per-user via [11](11-filtering-views.md); for v1 hardcoded to be board-level
- `createTask({ groupId, title, position })`
- `renameTask({ taskId, title })`
- `duplicateTask({ taskId })`
- `deleteTask({ taskId })` — soft delete
- `moveTask({ taskId, groupId, position })`
- `bulkDeleteTasks({ taskIds })`
- `bulkDuplicateTasks({ taskIds })`
- `bulkMoveTasksToGroup({ taskIds, groupId })`

Every action returns the updated rows (or a minimal diff) so the client can reconcile after Realtime echoes.

### Optimistic mutation pattern

```ts
// hooks/use-optimistic-action.ts
async function applyOptimistic<T>(
  optimistic: () => void,
  rollback: () => void,
  serverCall: () => Promise<{ ok: boolean; error?: { message: string } }>,
) {
  optimistic();
  const result = await serverCall();
  if (!result.ok) {
    rollback();
    toast.error(result.error?.message ?? "Action failed");
  }
}
```

Each cell editor and structural action uses this. The reconciliation rule: trust the server's row over the optimistic value, but apply the server's row idempotently (same id → replace; new row → insert; missing row → no-op).

### Handling Realtime echoes ([08](08-realtime-presence.md))

[08](08-realtime-presence.md) wires Realtime subscriptions. This epic's Zustand store has `applyTaskUpdate` etc. methods written so Realtime payloads can call them directly. The store is the single point of truth; both server-action results and Realtime events feed it.

A subtle issue: when *we* mutate, we'll receive our own Realtime echo. Idempotency in the apply functions is the answer — applying the same task row twice is a no-op.

### Empty states

- No groups: centered card "Add your first group to start organizing tasks." with a primary button.
- No tasks in group: lighter-weight inline message under the group header: "No tasks yet — add one below."
- Filtered to nothing ([11](11-filtering-views.md)): "No tasks match the current filter. Clear filter."

## Tasks

1. **Set up TanStack Table + Virtual + dnd-kit deps.** `pnpm add @tanstack/react-table @tanstack/react-virtual @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
2. **Build position helpers** in `lib/positions.ts` with unit tests.
3. **Build the activity logger** in `lib/activity.ts`. (Used by every server action.)
4. **Server actions** for groups: create/rename/recolor/reorder/duplicate/delete.
5. **Server actions** for tasks: create/rename/duplicate/delete/move + bulk variants.
6. **Build the Zustand board store** with `applyGroupUpdate`, `applyTaskUpdate`, `applyCellUpdate`, etc. Cover idempotency in unit tests.
7. **Build `<BoardTable />` skeleton** — no virtualization yet, just rendering. Render groups + tasks + a single "Title" column.
8. **Wire inline title edit** — `<TaskTitleCell />` with edit-on-click and Enter/Esc handling.
9. **Add row + group + table virtualization** with TanStack Virtual.
10. **Sticky header & first column** via CSS.
11. **Wire dnd-kit** for groups (top-level reorder).
12. **Wire dnd-kit** for tasks within and across groups.
13. **Bulk selection state** in Zustand. Render checkboxes; tri-state group/board headers.
14. **Bulk action toolbar** appears when selection > 0. Wire bulk server actions.
15. **"Add task" footer per group** with inline input + chain-add.
16. **"Add group" board footer** with inline input.
17. **Group collapse/expand** via per-user UI state (initially client-only; persisted in [11](11-filtering-views.md)).
18. **Empty states** for no groups, no tasks in group.
19. **Hook `<AddColumnButton />`** — placeholder in the header for [07](07-column-system.md).
20. **Hook activity writes** into every server action.
21. **Tests**: Vitest unit tests for store and position math; Playwright E2E for "create board → add group → add task → drag-reorder → bulk-delete."
22. **Performance audit**: 1,000 tasks × 5 groups loaded; verify scroll FPS and DnD latency.

## Definition of done

- Loading a board renders groups + tasks within 500ms after RSC data arrives.
- Adding/renaming/duplicating/deleting groups and tasks updates the UI immediately and persists.
- Drag-reordering groups and tasks works with the mouse and keyboard. Touch tested ([14](14-mobile-a11y-polish.md) for full mobile pass).
- 5,000 tasks across 20 groups scrolls at 60fps on a mid-tier laptop.
- Bulk-selecting 50 tasks and bulk-deleting completes in one server roundtrip.
- Every mutation logs an `activity` row.
- Two browser tabs on the same board are not yet synced ([08](08-realtime-presence.md)).
- Playwright E2E covers: create group → add 5 tasks → reorder them → cross-group drag → bulk select → bulk delete → undo (toast) → reload → state persists.

## Open questions

- **Undo system**: monday has a 5-second undo toast for destructive actions. Worth doing in v1. Implementation: actions return the inverse action info; toast button calls it. Add as a stretch task here or its own mini-epic.
- **Indent / sub-tasks**: monday has "subitems." Out of scope for v1; revisit after [07](07-column-system.md). The schema supports it via a `parent_task_id` column; not added here.
- **Group archive vs delete**: currently soft-delete via `deleted_at`. Add a per-group archive flag separately? Probably overkill.
- **Group sum/aggregate row**: count/sum per column, shown in group footer. Implementing the framework here, populating numeric/currency aggregates in [07](07-column-system.md). Status/priority "fraction Done" aggregates in [07](07-column-system.md) too.
- **Undo for cross-group drag**: harder than within-group. Stretch.
- **Keyboard navigation**: arrow keys to move between rows/cells, Enter to edit. Add in [14](14-mobile-a11y-polish.md) a11y pass or here. Recommend here, since it's basic table UX, not just an a11y concern.
