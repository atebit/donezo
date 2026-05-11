"use client";

import { Checkbox } from "@base-ui/react/checkbox";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  renameGroup,
  reorderGroup,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { moveTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { positionBetween } from "@/lib/positions";
import { useBoardStore } from "@/stores/board-store";

import { AddGroupFooter } from "./AddGroupFooter";
import { AddTaskFooter } from "./AddTaskFooter";
import { BulkActionBar } from "./BulkActionBar";
import { DndProviders, type DndProvidersProps } from "./DndProviders";
import { NoGroupsEmptyState } from "./EmptyStates";
import { GroupDragHandle } from "./GroupDragHandle";
import { GroupOverflowMenu } from "./GroupOverflowMenu";
import { colorToToken } from "./group-color";
import { StickyHeader } from "./StickyHeader";
import { type RowEntry, TableVirtualizer, type TableVirtualizerHandle } from "./TableVirtualizer";
import { TaskRow } from "./TaskRow";
import { TableScrollContext } from "./table-scroll-context";
import type { Group, TableData } from "./types";

// ---------------------------------------------------------------------------
// GroupHeaderRow — inline helper that renders the group chrome for the
// flattened-rows virtualizer layout. Now wired to dnd-kit useSortable so the
// group header acts as both the drag handle host and a droppable target for
// cross-group task drops.
//
// NOTE: GroupSection is still "orphaned" from the virtualized layout — it is
// not consumed by BoardTable. Leave GroupSection.tsx untouched (tracked for
// a future cleanup pass).
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

// ---------------------------------------------------------------------------
// GroupTriStateCheckbox — tri-state checkbox for a single group.
// Reads selection + tasks from the store and computes checked/indeterminate.
// ---------------------------------------------------------------------------
function GroupTriStateCheckbox({ group }: { group: Group }) {
  const { selection, tasks } = useBoardStore((s) => ({
    selection: s.selection,
    tasks: s.tasks,
  }));

  const groupTasks = tasks.filter((t) => t.group_id === group.id);
  const totalInScope = groupTasks.length;
  const selectedInScope = groupTasks.filter((t) => selection.has(t.id)).length;

  const checked = selectedInScope === totalInScope && totalInScope > 0;
  const indeterminate = selectedInScope > 0 && selectedInScope < totalInScope;

  return (
    <Checkbox.Root
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={(next) => useBoardStore.getState().selectGroup(group.id, next)}
      aria-label={`Select all tasks in ${group.name}`}
      className="w-[var(--size-cell-w-checkbox)] flex-shrink-0 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
    >
      <span
        className="w-4 h-4 rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] flex items-center justify-center transition-colors duration-[var(--motion-fast)]"
        style={{
          backgroundColor: checked || indeterminate ? "var(--color-primary)" : "transparent",
          borderColor: checked || indeterminate ? "var(--color-primary)" : undefined,
        }}
      >
        <Checkbox.Indicator keepMounted>
          {indeterminate ? (
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none" aria-hidden="true">
              <path d="M1 1H9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </Checkbox.Indicator>
      </span>
    </Checkbox.Root>
  );
}

function GroupHeaderRow({ group, taskCount }: GroupHeaderRowProps) {
  const [, startTransition] = useTransition();

  const isCollapsed = useBoardStore((s) => s.collapsedGroupIds.has(group.id));
  const colorToken = colorToToken(group.color);

  // useSortable makes this group header draggable AND a drop target for other
  // group headers. The `data.kind = "group"` allows DndProviders to route
  // drag-end events correctly.  The `data.groupId` is set to group.id so that
  // task drops onto a group header can also resolve the destination group.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    data: { kind: "group", groupId: group.id },
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
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
      const result = await renameGroup({ groupId: group.id, name: nextValue });
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
      className="group sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] flex items-center h-10 gap-1"
      data-group-id={group.id}
    >
      {/* Drag handle — wired to dnd-kit useSortable */}
      <GroupDragHandle attributes={attributes} listeners={listeners} />

      {/* Tri-state group-level select checkbox */}
      <GroupTriStateCheckbox group={group} />

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

      {/* Group title — colored in the group accent */}
      <span style={{ color: `var(${colorToken})` }}>
        <EditableTitle
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
// ---------------------------------------------------------------------------

interface BoardTableProps {
  boardId: string;
  initial: TableData;
}

export function BoardTable({ boardId, initial }: BoardTableProps) {
  const hydratedRef = useRef(false);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Hydrate the store once on mount (StrictMode-safe ref guard prevents
  // double-hydration from the dev-mode double-invocation of effects).
  // initial.* are bootstrap data; rehydration is keyed on boardId only.
  // biome-ignore lint/correctness/useExhaustiveDependencies: boardId is the only re-hydration trigger; initial.* is bootstrap data
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
  }, [boardId]);

  const groups = useBoardStore((s) => s.groups);
  const tasks = useBoardStore((s) => s.tasks);
  const collapsedGroupIds = useBoardStore((s) => s.collapsedGroupIds);

  // Ref to the TableVirtualizer's imperative handle — used to implement
  // scrollToTaskId() in the context value below.
  const tableRef = useRef<TableVirtualizerHandle>(null);

  // ---------------------------------------------------------------------------
  // Flattened rows array — rebuilt whenever groups, tasks, or collapse state
  // changes. The virtualizer uses this single array for all row rendering.
  //
  // Row ordering per group:
  //   1. group-header
  //   2. (if not collapsed) task rows (sorted by position)
  //   3. (if not collapsed) add-task-footer
  // After all groups:
  //   4. add-group-footer
  // ---------------------------------------------------------------------------
  const rows = useMemo<RowEntry[]>(() => {
    const result: RowEntry[] = [];

    for (const group of groups) {
      result.push({ kind: "group-header", group });

      if (!collapsedGroupIds.has(group.id)) {
        const groupTasks = tasks
          .filter((t) => t.group_id === group.id)
          .sort((a, b) => a.position - b.position);

        for (const task of groupTasks) {
          result.push({ kind: "task", task, group });
        }

        result.push({ kind: "add-task-footer", group });
      }
    }

    result.push({ kind: "add-group-footer" });

    return result;
  }, [groups, tasks, collapsedGroupIds]);

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
  const renderRow = (entry: RowEntry): React.ReactNode => {
    switch (entry.kind) {
      case "group-header": {
        const taskCount = tasks.filter((t) => t.group_id === entry.group.id).length;
        const taskIds = taskIdsByGroup.get(entry.group.id) ?? [];
        return (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <GroupHeaderRow group={entry.group} taskCount={taskCount} />
          </SortableContext>
        );
      }
      case "task":
        return <TaskRow task={entry.task} group={entry.group} />;
      case "add-task-footer":
        return <AddTaskFooter group={entry.group} />;
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
    <div className="flex flex-col flex-1 min-h-0">
      <StickyHeader />
      <TableScrollContext.Provider value={scrollContextValue}>
        <DndProviders onGroupReorder={handleGroupReorder} onTaskReorder={handleTaskReorder}>
          <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
            <TableVirtualizer ref={tableRef} rows={rows} renderRow={renderRow} />
          </SortableContext>
        </DndProviders>
      </TableScrollContext.Provider>
      {/* BulkActionBar — floats above the bottom of the scroll container;
          renders nothing (opacity-0, pointer-events-none) when selection is empty */}
      <BulkActionBar />
    </div>
  );
}
