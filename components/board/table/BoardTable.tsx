"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { reorderColumn } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions";
import { reorderGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { moveTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import type { EditableTitleHandle } from "@/components/shared/EditableTitle";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { useBoardView } from "@/hooks/use-board-view";
import { useTableKeyboardNav } from "@/hooks/use-table-keyboard-nav";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import { applyGroupBy } from "@/lib/filtering/apply-group-by";
import { applySearch } from "@/lib/filtering/apply-search";
import { applySort } from "@/lib/filtering/apply-sort";
import { positionBetween } from "@/lib/positions";
import { wrappedRenameGroup } from "@/lib/realtime/wrapped-actions";
import { useBoardStore } from "@/stores/board-store";
import { AddGroupFooter } from "./AddGroupFooter";
import { AddTaskFooter } from "./AddTaskFooter";
import { BulkActionBar } from "./BulkActionBar";
import { DndProviders, type DndProvidersProps } from "./DndProviders";
import { NoGroupsEmptyState } from "./EmptyStates";
import { GroupColumnHeader } from "./GroupColumnHeader";
import { GroupDragHandle } from "./GroupDragHandle";
import { GroupFooter } from "./GroupFooter";
import { GroupOverflowMenu } from "./GroupOverflowMenu";
import { GroupSection } from "./GroupSection";
import { GridTemplateContext } from "./grid-template-context";
import { type RowEntry, TableVirtualizer, type TableVirtualizerHandle } from "./TableVirtualizer";
import { TaskRow } from "./TaskRow";
import { TableKeyboardContext, useTableKeyboard } from "./table-keyboard-context";
import { TableScrollContext } from "./table-scroll-context";
import type { Group } from "./types";
import { useVisibleColumns } from "./use-visible-columns";

// isQueuedResult — type-narrowing guard for withOutbox's queued branch.
// Kept local so it does not add a new export to lib/realtime/outbox.ts.
function isQueuedResult(r: unknown): r is { queued: true } {
  return (
    r !== null &&
    typeof r === "object" &&
    "queued" in r &&
    (r as { queued?: unknown }).queued === true
  );
}

// ---------------------------------------------------------------------------
// GroupHeaderRow — inline helper that renders the group chrome for the
// flattened-rows virtualizer layout. Now wired to dnd-kit useSortable so the
// group header acts as both the drag handle host and a droppable target for
// cross-group task drops.
//
// ARIA: role="row" is intentionally absent here. The full ARIA table tree
// requires the complete role chain (table → rowgroup → row → cell) plus
// focusability, which is deferred to epic 14. Data attributes are in place for
// testing. See S10 done report for deferred-ARIA rationale.
// ---------------------------------------------------------------------------

interface GroupHeaderRowProps {
  group: Group;
  taskCount: number;
}


function GroupHeaderRow({ group, taskCount }: GroupHeaderRowProps) {
  const [, startTransition] = useTransition();
  const { registerGroupTitleRef } = useTableKeyboard();

  const isCollapsed = useBoardStore((s) => s.collapsedGroupIds.has(group.id));

  // Ref to the group title's EditableTitleHandle — the overflow menu Rename item
  // calls registerGroupTitleRef to notify the controller, which then calls
  // groupTitleRefs.current.get(groupId)?.focus() to enter edit mode.
  const editableRef = useRef<EditableTitleHandle | null>(null);

  // Register / unregister with the keyboard controller on mount/unmount so
  // the controller can always find the current handle regardless of whether
  // the virtualizer has this group header row mounted.
  useEffect(() => {
    registerGroupTitleRef(group.id, editableRef.current);
    return () => {
      registerGroupTitleRef(group.id, null);
    };
  }, [group.id, registerGroupTitleRef]);

  // useSortable makes this group header draggable AND a drop target for other
  // group headers. The `data.kind = "group"` allows DndProviders to route
  // drag-end events correctly.  The `data.groupId` is set to group.id so that
  // task drops onto a group header can also resolve the destination group.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { kind: "group", groupId: group.id },
  });

  // translateX(var(--table-scroll-x)) counteracts horizontal scroll so the group
  // header stays anchored at the viewport's left edge. CSS sticky + left:0 does
  // not work here because transform:translateZ(0) on the virtualizer row div
  // creates a local coordinate context that breaks the sticky left threshold.
  const scrollCompensation = "translateX(var(--table-scroll-x, 0px))";
  const style: React.CSSProperties = {
    transform: transform
      ? `${CSS.Transform.toString(transform)} ${scrollCompensation}`
      : scrollCompensation,
    ...(transition ? { transition } : {}),
    ...(isDragging ? { zIndex: 3, opacity: 0.85 } : {}),
  };

  const handleRename = (nextValue: string) => {
    if (!nextValue) return;

    // Optimistic update — bump updated_at so the idempotency guard passes.
    useBoardStore.getState().applyGroupUpsert({
      ...group,
      name: nextValue,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await wrappedRenameGroup({ groupId: group.id, name: nextValue });
      // Soft success — optimistic update already applied; outbox will flush on reconnect.
      if (isQueuedResult(result)) return;
      if (!result.ok) {
        // Revert to the original group row.
        useBoardStore.getState().applyGroupUpsert({
          ...group,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Sync to the authoritative server row.
        useBoardStore.getState().applyGroupUpsert(result.data);
      }
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] flex items-center h-10 gap-1 pl-3"
      data-group-id={group.id}
    >
      {/* Drag handle — wired to dnd-kit useSortable */}
      <GroupDragHandle attributes={attributes} listeners={listeners} />

      {/* Collapse / expand arrow */}
      <button
        type="button"
        aria-label={isCollapsed ? "Expand group" : "Collapse group"}
        onClick={() => useBoardStore.getState().toggleGroupCollapse(group.id)}
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 transition-transform duration-[var(--motion-base)]"
        style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          className="fill-[color:var(--color-fg-muted)]"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Group title — colored via --group-accent set once on GroupSection */}
      <span style={{ color: "var(--group-accent)" }}>
        <EditableTitle
          ref={editableRef}
          initialValue={group.name}
          variant="h4"
          onCommit={handleRename}
          ariaLabel="Group title"
        />
      </span>

      {/* Task count chip — revealed on hover */}
      <span
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] text-sm text-[color:var(--color-fg-muted)] ml-1 flex-shrink-0"
        aria-hidden="true"
      >
        {taskCount}
      </span>

      {/* Group overflow menu — S13 */}
      <GroupOverflowMenu group={group} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BoardTable
//
// Data hydration, Realtime subscription, and outbox flush are handled by the
// parent <BoardDataProvider> (mounted in layout.tsx). This component reads
// from the already-hydrated store and renders the table.
// ---------------------------------------------------------------------------

// Width constants for the grid template.
const MIN_WIDTH = 80;
const TITLE_MIN_WIDTH = 200;
// Matches --size-cell-w-checkbox in globals.css. Used to compute tableMinWidth
// so the virtualizer's inner container is always wide enough to show a
// horizontal scrollbar without needing an in-flow header element.
const CHECKBOX_TRACK_W = 32;

export function BoardTable() {
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [, startTransition] = useTransition();

  // boardId is read from the store (set during hydration by BoardDataProvider).
  const boardId = useBoardStore((s) => s.boardId) ?? "";

  const groups = useBoardStore((s) => s.groups);
  const tasks = useBoardStore((s) => s.tasks);
  const collapsedGroupIds = useBoardStore((s) => s.collapsedGroupIds);
  const cells = useBoardStore((s) => s.cells);
  const columns = useBoardStore(useShallow((s) => s.columns));

  // ---------------------------------------------------------------------------
  // Grid template — shared column axis for header, task rows, and footers.
  // Computed once here and provided via GridTemplateContext.
  // ---------------------------------------------------------------------------
  const { titleColumn, otherColumns, getColumnWidth } = useVisibleColumns();
  const gridTemplateColumns = useMemo(() => {
    const checkboxTrack = "var(--size-cell-w-checkbox)";
    const titleTrack = titleColumn
      ? `minmax(${TITLE_MIN_WIDTH}px, ${getColumnWidth(titleColumn)}px)`
      : `minmax(${TITLE_MIN_WIDTH}px, var(--size-cell-w-task))`;
    const otherTracks = otherColumns.map((c) => `minmax(${MIN_WIDTH}px, ${getColumnWidth(c)}px)`);
    return [checkboxTrack, titleTrack, ...otherTracks, "auto"].join(" ");
  }, [titleColumn, otherColumns, getColumnWidth]);

  const gridTemplateContextValue = useMemo(() => ({ gridTemplateColumns }), [gridTemplateColumns]);

  // Minimum pixel width of the table content — passed to TableVirtualizer so the
  // inner container is always wide enough to enable horizontal scroll even when
  // there is no in-flow header element to drive max-content width measurement.
  const tableMinWidth = useMemo(
    () =>
      CHECKBOX_TRACK_W +
      (titleColumn ? getColumnWidth(titleColumn) : 336) +
      otherColumns.reduce((sum, col) => sum + getColumnWidth(col), 0),
    [titleColumn, otherColumns, getColumnWidth],
  );

  // Epic 11 — view state. The hook is client-only; it reads URL and syncs the store.
  const { effective } = useBoardView();
  // Wrap effective config in useDeferredValue so large-board filter derivations
  // don't block interactivity (typing in search stays responsive).
  // TODO(slice-G): audit first-paint row alignment if this causes visible mis-alignment.
  const deferredEffective = useDeferredValue(effective);

  // Ref to the TableVirtualizer's imperative handle — used to implement
  // scrollToTaskId() in the context value below.
  const tableRef = useRef<TableVirtualizerHandle>(null);

  // Ref for the outermost container div — the keyboard listener attaches here
  // so key events from focused rows bubble up naturally.
  const containerRef = useRef<HTMLDivElement>(null);

  // Map from taskId → EditableTitleHandle; populated by TaskTitleCell on mount.
  const titleCellRefs = useRef(new Map<string, EditableTitleHandle>());

  // Stable callback to register / unregister title cell refs.
  const registerTitleCellRef = useCallback((taskId: string, ref: EditableTitleHandle | null) => {
    if (ref) {
      titleCellRefs.current.set(taskId, ref);
    } else {
      titleCellRefs.current.delete(taskId);
    }
  }, []);

  // Map from groupId → EditableTitleHandle; populated by GroupHeaderRow on mount.
  const groupTitleRefs = useRef(new Map<string, EditableTitleHandle>());

  // Stable callback to register / unregister group title refs.
  const registerGroupTitleRef = useCallback((groupId: string, ref: EditableTitleHandle | null) => {
    if (ref) {
      groupTitleRefs.current.set(groupId, ref);
    } else {
      groupTitleRefs.current.delete(groupId);
    }
  }, []);

  // Imperatively focus (enter edit mode on) a task's EditableTitle by task id.
  // Called by TaskOverflowMenu's Rename item via setTimeout(0) to sequence after
  // Base UI Popover's focus-restore.
  const focusTaskTitle = useCallback((taskId: string) => {
    titleCellRefs.current.get(taskId)?.focus();
  }, []);

  // Imperatively focus (enter edit mode on) a group's EditableTitle by group id.
  // Called by GroupOverflowMenu's Rename item via setTimeout(0) to sequence after
  // Base UI Popover's focus-restore.
  const focusGroupTitle = useCallback((groupId: string) => {
    groupTitleRefs.current.get(groupId)?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Flattened rows array — rebuilt whenever groups, tasks, collapse state,
  // or the effective view config changes.
  //
  // Epic 11 derivation pipeline (B.5):
  //   1. applyFilterTree  — filter by active filter tree
  //   2. applySearch      — case-insensitive in-board search
  //   3. applySort        — multi-key stable sort
  //   4. applyGroupBy     — (re-)bucket by native groups or a column value
  //   5. Flatten buckets into RowEntry[]
  //
  // Row ordering per bucket:
  //   1. group-header
  //   2. (if not collapsed) task rows
  //   3. (if not collapsed) add-task-footer (suppressed for column-based group-by)
  //   4. (if not collapsed) group-footer (aggregations; only when tasks exist)
  // After all buckets:
  //   5. add-group-footer (suppressed for column-based group-by)
  //
  // Sort + DnD: when sortKeys.length > 0, DnD reorder is DISABLED.
  // TODO(slice-D): gate DragHandle render on sortKeys.length === 0.
  // Column group-by + DnD: when effective.groupBy?.kind === "column", DnD disabled.
  // TODO(slice-D): gate DragHandle render on effective.groupBy?.kind !== "column".
  // ---------------------------------------------------------------------------
  const rows = useMemo<RowEntry[]>(() => {
    // Step 1: Filter tasks by active filter tree.
    const filteredTasks = applyFilterTree(tasks, cells, columns, deferredEffective.filter);

    // Step 2: Apply in-board search.
    const searchedTasks = applySearch(
      filteredTasks,
      cells,
      columns,
      deferredEffective.search ?? "",
    );

    // Step 3: Sort — preserve natural position order first so sort is stable
    // relative to the original task order.
    const naturalOrder = [...searchedTasks].sort((a, b) => {
      const gA = groups.find((g) => g.id === a.group_id);
      const gB = groups.find((g) => g.id === b.group_id);
      const gDiff = (gA?.position ?? 0) - (gB?.position ?? 0);
      if (gDiff !== 0) return gDiff;
      return a.position - b.position;
    });
    const sortedTasks = applySort(naturalOrder, cells, columns, deferredEffective.sort);

    // Step 4: Group tasks into buckets.
    const buckets = applyGroupBy(sortedTasks, cells, columns, deferredEffective.groupBy, groups);

    const isColumnGroupBy = deferredEffective.groupBy?.kind === "column";

    // Step 5: Flatten buckets into RowEntry[].
    const result: RowEntry[] = [];

    for (const bucket of buckets) {
      // For native grouping, use the real group object; for column grouping, use
      // a synthetic group-like object that satisfies the GroupHeaderRow contract.
      const groupObj = groups.find((g) => g.id === bucket.key) ?? {
        id: bucket.key,
        name: bucket.label,
        color: bucket.color ?? "gray",
        board_id: boardId,
        position: 0,
        created_at: "",
        updated_at: "",
        deleted_at: null,
      };

      result.push({ kind: "group-header", group: groupObj });

      if (!collapsedGroupIds.has(bucket.key)) {
        // Per-group column header repeat (always shown when not collapsed).
        result.push({ kind: "group-column-header", group: groupObj });

        for (const task of bucket.tasks) {
          result.push({ kind: "task", task, group: groupObj });
        }

        // Suppress "+ Add task" for column-based group-by buckets.
        if (!isColumnGroupBy) {
          result.push({ kind: "add-task-footer", group: groupObj });
        }

        // Hide the aggregation footer when the group has no tasks.
        if (bucket.tasks.length > 0) {
          result.push({ kind: "group-footer", group: groupObj });
        }
      }
    }

    // Suppress "+ Add group" footer for column-based group-by.
    if (!isColumnGroupBy) {
      result.push({ kind: "add-group-footer" });
    }

    return result;
  }, [groups, tasks, cells, columns, collapsedGroupIds, deferredEffective, boardId]);

  // ---------------------------------------------------------------------------
  // visibleTaskIds — tasks that are not in a collapsed group, in render order.
  // Used by the keyboard navigation controller to determine prev/next row.
  // ---------------------------------------------------------------------------
  const visibleTaskIds = useMemo(
    () =>
      tasks
        .filter((t) => !collapsedGroupIds.has(t.group_id))
        .sort((a, b) => {
          // Sort by group position first, then task position within group.
          const groupA = groups.find((g) => g.id === a.group_id);
          const groupB = groups.find((g) => g.id === b.group_id);
          const groupPosDiff = (groupA?.position ?? 0) - (groupB?.position ?? 0);
          if (groupPosDiff !== 0) return groupPosDiff;
          return a.position - b.position;
        })
        .map((t) => t.id),
    [tasks, collapsedGroupIds, groups],
  );

  // ---------------------------------------------------------------------------
  // Keyboard navigation controller — arrow key focus, Enter to edit, Esc to
  // cancel. scrollToTaskId is captured from the closure below (same value that
  // populates TableScrollContext) to avoid calling useTableScroll() from a
  // component that IS the provider.
  // ---------------------------------------------------------------------------
  const scrollToTaskIdForNav = useCallback(
    (taskId: string) => {
      const idx = rows.findIndex((r) => r.kind === "task" && r.task.id === taskId);
      if (idx >= 0) {
        tableRef.current?.scrollToIndex(idx, { align: "center" });
      }
    },
    [rows],
  );

  const keyboardNav = useTableKeyboardNav({
    containerRef,
    visibleTaskIds,
    titleCellRefs,
    scrollToTaskId: scrollToTaskIdForNav,
  });

  // ---------------------------------------------------------------------------
  // Per-group task id lists for SortableContext — derived from the store.
  // Used to give each group's SortableContext the full ordered item list even
  // when some tasks are off-screen (dnd-kit tracks items, not DOM nodes).
  // ---------------------------------------------------------------------------
  const taskIdsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of groups) {
      const ids = tasks
        .filter((t) => t.group_id === group.id)
        .sort((a, b) => a.position - b.position)
        .map((t) => t.id);
      map.set(group.id, ids);
    }
    return map;
  }, [groups, tasks]);

  // ---------------------------------------------------------------------------
  // TableScrollContext value — scrollToTaskId maps a task id to its row index
  // and delegates to the virtualizer's scrollToIndex. Stable per rows identity.
  // ---------------------------------------------------------------------------
  const scrollContextValue = useMemo(
    () => ({
      scrollToTaskId: (taskId: string) => {
        const idx = rows.findIndex((r) => r.kind === "task" && r.task.id === taskId);
        if (idx >= 0) {
          tableRef.current?.scrollToIndex(idx, { align: "center" });
        }
      },
    }),
    [rows],
  );

  // ---------------------------------------------------------------------------
  // onGroupReorder — called by DndProviders when a group drag ends.
  //
  // groupId:  the dragged group's id
  // overId:   the group that was under the cursor at drop time
  //
  // Algorithm:
  //   1. Find the dragged group's current index and the over group's index.
  //   2. Simulate the reorder (move dragged group to over's position).
  //   3. Compute new position via positionBetween(prev.position, next.position).
  //   4. Optimistic update → server action → revert on error.
  // ---------------------------------------------------------------------------
  const handleGroupReorder: DndProvidersProps["onGroupReorder"] = (groupId, overId) => {
    const currentGroups = useBoardStore.getState().groups;

    const activeIdx = currentGroups.findIndex((g) => g.id === groupId);
    const overIdx = currentGroups.findIndex((g) => g.id === overId);

    if (activeIdx === -1 || overIdx === -1) return;
    if (activeIdx === overIdx) return;

    const originalGroup = currentGroups[activeIdx];
    if (!originalGroup) return;

    // Build the reordered array (simulated move).
    const reordered = [...currentGroups];
    const [moved] = reordered.splice(activeIdx, 1);
    if (!moved) return;
    reordered.splice(overIdx, 0, moved);

    // Find the destination index in the reordered array.
    const destIdx = reordered.findIndex((g) => g.id === groupId);
    const prevGroup = reordered[destIdx - 1] ?? null;
    const nextGroup = reordered[destIdx + 1] ?? null;

    let newPos: number;
    try {
      newPos = positionBetween(prevGroup?.position ?? null, nextGroup?.position ?? null);
    } catch {
      toast.error("Unable to reorder: positions need compaction. Try again later.");
      return;
    }

    const optimistic = { ...originalGroup, position: newPos, updated_at: new Date().toISOString() };
    useBoardStore.getState().applyGroupUpsert(optimistic);

    startTransition(async () => {
      const result = await reorderGroup({ groupId, position: newPos });
      if (result.ok) {
        useBoardStore.getState().applyGroupUpsert(result.data);
      } else {
        // Revert optimistic update.
        useBoardStore.getState().applyGroupUpsert({
          ...originalGroup,
          updated_at: new Date().toISOString(),
        });
        toast.error("Failed to reorder group. Please try again.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // onColumnReorder — called by DndProviders when a column header drag ends.
  //
  // columnId: the dragged column's id
  // overId:   the column id it was dropped onto
  //
  // Algorithm:
  //   1. Find active column and over column in sorted visible columns.
  //   2. Determine direction (left vs right) to decide insert-before or insert-after.
  //   3. Compute new position via positionBetween.
  //   4. Optimistic update → server action → revert on error.
  //
  // Note: we read columns from the store directly (not a selector) because
  // this callback runs on drag-end (outside React render).
  // ---------------------------------------------------------------------------
  const handleColumnReorder: DndProvidersProps["onColumnReorder"] = (columnId, overId) => {
    const state = useBoardStore.getState();
    const currentColumns = state.columns;
    const currentBoardId = state.boardId;

    // Build visible columns list (same filter as StickyHeader / TaskRow).
    const boardPrefs = currentBoardId ? (state.columnPrefsByBoard[currentBoardId] ?? {}) : {};
    const visibleColumns = currentColumns.filter((c) => !boardPrefs[c.id]?.hidden);

    const activeCol = visibleColumns.find((c) => c.id === columnId);
    const overCol = visibleColumns.find((c) => c.id === overId);

    if (!activeCol || !overCol || activeCol.id === overCol.id) return;

    // visibleColumns from store are already sorted by position (applyColumnUpsert re-sorts).
    const sortedColumns = [...visibleColumns].sort((a, b) => a.position - b.position);
    const overIdx = sortedColumns.findIndex((c) => c.id === overCol.id);

    const prev = sortedColumns[overIdx - 1] ?? null;
    const next = sortedColumns[overIdx + 1] ?? null;

    let newPosition: number;
    try {
      if (activeCol.position < overCol.position) {
        // Moving right: place after the over column.
        newPosition = positionBetween(overCol.position, next?.position ?? null);
      } else {
        // Moving left: place before the over column.
        newPosition = positionBetween(prev?.position ?? null, overCol.position);
      }
    } catch {
      toast.error("Unable to reorder column: positions need compaction. Try again later.");
      return;
    }

    // Optimistic update.
    const optimistic = {
      ...activeCol,
      position: newPosition,
      updated_at: new Date().toISOString(),
    };
    useBoardStore.getState().applyColumnUpsert(optimistic);

    startTransition(async () => {
      const result = await reorderColumn({ columnId: activeCol.id, position: newPosition });
      if (result.ok) {
        useBoardStore.getState().applyColumnUpsert(result.data);
      } else {
        // Revert optimistic update.
        useBoardStore.getState().applyColumnUpsert({
          ...activeCol,
          updated_at: new Date().toISOString(),
        });
        toast.error("Failed to reorder column. Please try again.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // onTaskReorder — called by DndProviders when a task drag ends.
  //
  // taskId:       dragged task id
  // activeGroupId: origin group id
  // overId:        id of the item under cursor (task id OR group header id)
  // overKind:      "task" | "group"
  // overGroupId:   destination group id
  //
  // Algorithm (same group):
  //   Remove active from its sorted position, insert at over's position.
  //   positionBetween(prevTask.position, nextTask.position).
  //
  // Algorithm (cross-group):
  //   Destination group tasks (without active) → find insertion point by
  //   over task id (or end of group if overKind === "group").
  //   positionBetween(prevTask.position, nextTask.position).
  // ---------------------------------------------------------------------------
  const handleTaskReorder: DndProvidersProps["onTaskReorder"] = ({
    taskId,
    overId,
    overKind,
    overGroupId,
  }) => {
    const state = useBoardStore.getState();
    const allTasks = state.tasks;

    const originalTask = allTasks.find((t) => t.id === taskId);
    if (!originalTask) return;

    // Get destination group's tasks (sorted), with the dragged task excluded
    // so we can compute clean insertion positions.
    const destGroupTasks = allTasks
      .filter((t) => t.group_id === overGroupId && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    let newPos: number;

    if (overKind === "group") {
      // Dropped onto the group header — append at the end of the destination group.
      const lastTask = destGroupTasks[destGroupTasks.length - 1] ?? null;
      try {
        newPos = positionBetween(lastTask?.position ?? null, null);
      } catch {
        toast.error("Unable to move task: positions need compaction. Try again later.");
        return;
      }
    } else {
      // Dropped onto a task in the destination group.
      const overIdx = destGroupTasks.findIndex((t) => t.id === overId);

      if (overIdx === -1) {
        // over task not found in dest group (can happen on cross-group drops
        // to collapsed groups) — append at end.
        const lastTask = destGroupTasks[destGroupTasks.length - 1] ?? null;
        try {
          newPos = positionBetween(lastTask?.position ?? null, null);
        } catch {
          toast.error("Unable to move task: positions need compaction. Try again later.");
          return;
        }
      } else {
        // Determine whether to insert before or after the over task.
        // For same-group moves: if moving down, insert after over; if moving
        // up, insert before over. Since destGroupTasks already excludes the
        // active task, we simply use the overIdx as the insertion point.
        const prevTask = destGroupTasks[overIdx - 1] ?? null;
        const nextTask = destGroupTasks[overIdx] ?? null;

        // When moving within the same group, we want to insert at overIdx
        // position. prevTask is the item before that slot, nextTask is the
        // item at that slot (which shifts down).
        //
        // For cross-group: we insert before the over task (overIdx slot).
        try {
          newPos = positionBetween(prevTask?.position ?? null, nextTask?.position ?? null);
        } catch {
          toast.error("Unable to move task: positions need compaction. Try again later.");
          return;
        }
      }
    }

    // Optimistic update — update group_id and position.
    // NEVER write board_id (guardrail #20 — trigger handles it).
    const optimistic = {
      ...originalTask,
      group_id: overGroupId,
      position: newPos,
      updated_at: new Date().toISOString(),
    };
    useBoardStore.getState().applyTaskUpsert(optimistic);

    startTransition(async () => {
      const result = await moveTask({
        taskId,
        groupId: overGroupId,
        position: newPos,
      });
      if (result.ok) {
        useBoardStore.getState().applyTaskUpsert(result.data);
      } else {
        // Revert optimistic update.
        useBoardStore.getState().applyTaskUpsert({
          ...originalTask,
          updated_at: new Date().toISOString(),
        });
        toast.error("Failed to move task. Please try again.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // renderRow — switch on row kind, render the appropriate component.
  // task count for group-header is derived inline to avoid a separate memoized
  // map — this is O(n tasks) per render but only runs during JS reconciliation,
  // not during scroll (rows is stable between scrolls).
  //
  // Each group's tasks are wrapped in a SortableContext so dnd-kit can resolve
  // within-group AND cross-group drop positions. The full task id list (not
  // just visible/virtualized ones) is passed so dnd-kit can track off-screen
  // items even when their DOM nodes are unmounted.
  // ---------------------------------------------------------------------------
  // Floating card wrapper — shared by the group-column-header, task, group-footer,
  // and add-task-footer rows. Provides:
  //   • Horizontal margin so groups "float" away from the page edge
  //   • Slightly elevated surface background (lighter than page bg, especially in dark mode)
  //   • CSS-var override so sticky cells inherit the same elevated background
  //   • Colored left border using the group accent token
  //   • overflow: clip respects border-radius without breaking sticky positioning
  //   • height: 100% fills the virtualizer row so there are no dark-background gaps
  //     between adjacent card rows (the inter-group gap lives in group-header paddingTop)
  const cardRow = (
    content: React.ReactNode,
    position: "top" | "middle" | "bottom" | "single",
  ): React.ReactNode => {
    const radius =
      position === "top"
        ? "6px 6px 0 0"
        : position === "bottom"
          ? "0 0 6px 6px"
          : position === "single"
            ? "6px"
            : "0";
    return (
      <div
        style={
          {
            "--color-surface": "var(--color-surface-info)",
            backgroundColor: "var(--color-surface-info)",
            // inset box-shadow instead of borderLeft — visually identical but
            // does not consume width under box-sizing:border-box, so grid
            // columns inside the card align exactly with the sticky header.
            boxShadow: "inset 3px 0 0 0 var(--group-accent)",
            borderRadius: radius,
            overflow: "clip",
            marginLeft: 12,
            marginRight: 12,
            height: "100%",
          } as React.CSSProperties
        }
      >
        {content}
      </div>
    );
  };

  // Determine card position for a row by peeking at neighbours in the rows array.
  // Group-header rows are NOT card rows, so they terminate a card on both sides.
  const isCardRowKind = (kind: RowEntry["kind"]): boolean =>
    kind === "group-column-header" ||
    kind === "task" ||
    kind === "add-task-footer" ||
    kind === "group-footer";

  const cardPos = (entry: RowEntry, index: number): "top" | "middle" | "bottom" | "single" => {
    const prev = rows[index - 1];
    const next = rows[index + 1];
    const eg = "group" in entry ? entry.group.id : null;
    const pg = prev && "group" in prev ? prev.group.id : null;
    const ng = next && "group" in next ? next.group.id : null;
    const isFirst = !prev || !isCardRowKind(prev.kind) || pg !== eg;
    const isLast = !next || !isCardRowKind(next.kind) || ng !== eg;
    if (isFirst && isLast) return "single";
    if (isFirst) return "top";
    if (isLast) return "bottom";
    return "middle";
  };

  const renderRow = (entry: RowEntry, index: number): React.ReactNode => {
    switch (entry.kind) {
      case "group-header": {
        const taskCount = tasks.filter((t) => t.group_id === entry.group.id).length;
        const taskIds = taskIdsByGroup.get(entry.group.id) ?? [];
        // paddingTop creates the inter-group gap above each group's header label.
        // The virtualizer row height (DEFAULT_HEIGHTS["group-header"]) is sized to
        // include this padding so the absolute layout stays consistent.
        return (
          <div style={{ paddingTop: 14, height: "100%", boxSizing: "border-box" }}>
            <GroupSection group={entry.group}>
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                <GroupHeaderRow group={entry.group} taskCount={taskCount} />
              </SortableContext>
            </GroupSection>
          </div>
        );
      }
      case "group-column-header":
        return (
          <GroupSection group={entry.group}>
            {cardRow(<GroupColumnHeader />, cardPos(entry, index))}
          </GroupSection>
        );
      case "task":
        return (
          <GroupSection group={entry.group}>
            {cardRow(<TaskRow task={entry.task} group={entry.group} />, cardPos(entry, index))}
          </GroupSection>
        );
      case "add-task-footer":
        return (
          <GroupSection group={entry.group}>
            {cardRow(
              // translateX keeps "+ Add task" anchored during horizontal scroll.
              // cardRow has marginLeft:12, so we subtract that offset: once
              // scrollLeft exceeds 12px the footer slides right to stay at x=0.
              // max(0px,...) prevents leftward shift before the threshold.
              <div
                style={{
                  transform:
                    "translateX(max(0px, calc(var(--table-scroll-x, 0px) - 12px)))",
                  height: "100%",
                }}
              >
                <AddTaskFooter group={entry.group} />
              </div>,
              cardPos(entry, index),
            )}
          </GroupSection>
        );
      case "group-footer":
        return (
          <GroupSection group={entry.group}>
            {cardRow(<GroupFooter group={entry.group} />, cardPos(entry, index))}
          </GroupSection>
        );
      case "add-group-footer":
        return (
          <AddGroupFooter
            boardId={boardId}
            editingOpen={isAddGroupOpen}
            onEditingOpenChange={setIsAddGroupOpen}
          />
        );
    }
  };

  // ---------------------------------------------------------------------------
  // Empty state — no groups yet.
  // ---------------------------------------------------------------------------
  if (groups.length === 0) {
    return (
      <>
        <NoGroupsEmptyState onAddGroup={() => setIsAddGroupOpen(true)} />
        <AddGroupFooter
          boardId={boardId}
          editingOpen={isAddGroupOpen}
          onEditingOpenChange={setIsAddGroupOpen}
        />
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Group id list for the outer SortableContext — keeps the full sorted group
  // order so dnd-kit can animate all group headers even when some are off-screen.
  // ---------------------------------------------------------------------------
  const groupIds = groups.map((g) => g.id);

  // ---------------------------------------------------------------------------
  // Virtualized table layout.
  //
  // Height strategy: `flex flex-col flex-1 min-h-0` propagates the available
  // viewport height (constrained by the 100dvh root + SidebarShell's overflow:
  // hidden ancestor chain) down through the flex column. The TableVirtualizer's
  // scroll container is `flex-1 min-h-0 overflow-auto`, which clips to the
  // remaining height below StickyHeader and drives the virtualizer.
  //
  // DnD strategy:
  //   - Outer SortableContext over all group ids enables group-level dragging.
  //   - Per-group SortableContext (rendered inside each group-header row slot)
  //     covers that group's tasks for within-group AND cross-group drops.
  //   - DndProviders wraps everything with DndContext + sensors.
  // ---------------------------------------------------------------------------
  return (
    <TableKeyboardContext.Provider
      value={{
        ...keyboardNav,
        registerTitleCellRef,
        registerGroupTitleRef,
        focusTaskTitle,
        focusGroupTitle,
      }}
    >
      {/* containerRef is on the outermost div so keydown events from any focused
          row (inside the tree) bubble up to the single listener attached by the
          keyboard nav hook. */}
      {/* biome-ignore lint/a11y/useSemanticElements: CSS-grid table; <table> doesn't fit the virtualized + sticky layout */}
      <div
        ref={containerRef}
        className="flex flex-col flex-1 min-h-0"
        data-testid="board-table"
        role="grid"
      >
        <GridTemplateContext.Provider value={gridTemplateContextValue}>
          <TableScrollContext.Provider value={scrollContextValue}>
            <DndProviders
              onGroupReorder={handleGroupReorder}
              onTaskReorder={handleTaskReorder}
              onColumnReorder={handleColumnReorder}
            >
              <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
                <TableVirtualizer
                  ref={tableRef}
                  rows={rows}
                  renderRow={renderRow}
                  tableMinWidth={tableMinWidth}
                />
              </SortableContext>
            </DndProviders>
          </TableScrollContext.Provider>
        </GridTemplateContext.Provider>
        {/* BulkActionBar — floats above the bottom of the scroll container;
            renders nothing (opacity-0, pointer-events-none) when selection is empty */}
        <BulkActionBar />
      </div>
    </TableKeyboardContext.Provider>
  );
}
