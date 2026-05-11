"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { renameGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { useBoardStore } from "@/stores/board-store";

import { AddGroupFooter } from "./AddGroupFooter";
import { AddTaskFooter } from "./AddTaskFooter";
import { NoGroupsEmptyState } from "./EmptyStates";
import { colorToToken } from "./group-color";
import { StickyHeader } from "./StickyHeader";
import { type RowEntry, TableVirtualizer, type TableVirtualizerHandle } from "./TableVirtualizer";
import { TaskRow } from "./TaskRow";
import { TableScrollContext } from "./table-scroll-context";
import type { Group, TableData } from "./types";

// ---------------------------------------------------------------------------
// GroupHeaderRow — inline helper that renders the group chrome for the
// flattened-rows virtualizer layout. Mirrors GroupSection's header JSX but
// standalone (no task-loop wrapper), so GroupSection.tsx stays unmodified
// (S11 will reintroduce GroupSection in its DnD wiring pass).
//
// NOTE: GroupSection is now "orphaned" from the virtualized layout — it is no
// longer consumed by BoardTable. S11 will either reintroduce it as a DnD
// wrapper or a cleanup pass will remove it. Leave GroupSection.tsx untouched.
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

  const isCollapsed = useBoardStore((s) => s.collapsedGroupIds.has(group.id));
  const colorToken = colorToToken(group.color);

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
      className="group sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] flex items-center h-10 gap-1"
      data-group-id={group.id}
    >
      {/* Collapse / expand arrow */}
      <button
        type="button"
        aria-label={isCollapsed ? "Expand group" : "Collapse group"}
        onClick={() => useBoardStore.getState().toggleGroupCollapse(group.id)}
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 ml-[13px] transition-transform duration-[var(--motion-base)]"
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

      {/* Overflow menu placeholder — wired in S13 */}
      <button
        type="button"
        aria-label="Group menu (wired in S13)"
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] ml-1 flex-shrink-0 text-[color:var(--color-fg-muted)]"
      >
        ⋯
      </button>
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

  // Hydrate the store once on mount (StrictMode-safe ref guard prevents
  // double-hydration from the dev-mode double-invocation of effects).
  // initial.* are bootstrap data; rehydration is keyed on boardId only — see followup-2.
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
  // renderRow — switch on row kind, render the appropriate component.
  // task count for group-header is derived inline to avoid a separate memoized
  // map — this is O(n tasks) per render but only runs during JS reconciliation,
  // not during scroll (rows is stable between scrolls).
  // ---------------------------------------------------------------------------
  const renderRow = (entry: RowEntry): React.ReactNode => {
    switch (entry.kind) {
      case "group-header": {
        const taskCount = tasks.filter((t) => t.group_id === entry.group.id).length;
        return <GroupHeaderRow group={entry.group} taskCount={taskCount} />;
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
  // Virtualized table layout.
  //
  // Height strategy: `flex flex-col flex-1 min-h-0` propagates the available
  // viewport height (constrained by the 100dvh root + SidebarShell's overflow:
  // hidden ancestor chain) down through the flex column. The TableVirtualizer's
  // scroll container is `flex-1 min-h-0 overflow-auto`, which clips to the
  // remaining height below StickyHeader and drives the virtualizer.
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <StickyHeader />
      <TableScrollContext.Provider value={scrollContextValue}>
        <TableVirtualizer ref={tableRef} rows={rows} renderRow={renderRow} />
      </TableScrollContext.Provider>
    </div>
  );
}
