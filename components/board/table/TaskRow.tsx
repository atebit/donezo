"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { TableCell } from "@/components/cells/TableCell";
import { selectEffectiveConfig, selectUsersViewingTask, useBoardStore } from "@/stores/board-store";

import { BulkSelectCheckbox } from "./BulkSelectCheckbox";
import { colorToToken } from "./group-color";
import { TaskDragHandle } from "./TaskDragHandle";
import { TaskOverflowMenu } from "./TaskOverflowMenu";
import { TaskTitleCell } from "./TaskTitleCell";
import { useTableKeyboard } from "./table-keyboard-context";
import type { Column, Group, Task } from "./types";

interface TaskRowProps {
  task: Task;
  group: Group;
}

export function TaskRow({ task, group }: TaskRowProps) {
  const colorToken = colorToToken(group.color);
  const { focusedRowId, setFocusedRow } = useTableKeyboard();

  // ---------------------------------------------------------------------------
  // Visible non-title columns — mirrors the identification logic in StickyHeader
  // (S19) so rows and headers stay in sync.
  //
  // Epic 11: prefer `effective.columnVisibility` from the active view config when
  // present; fall back to the legacy `columnPrefsByBoard` path until Slice F
  // completes the one-shot migration.
  // ---------------------------------------------------------------------------
  const columns = useBoardStore((s) => s.columns);
  const columnPrefsByBoard = useBoardStore((s) => s.columnPrefsByBoard);
  const boardId = useBoardStore((s) => s.boardId);
  const effectiveConfig = useBoardStore(selectEffectiveConfig);
  const boardPrefs = boardId ? (columnPrefsByBoard[boardId] ?? {}) : {};

  const visibleColumns = columns.filter((c) => {
    // Prefer view config visibility when present; fallback to legacy prefs.
    if (effectiveConfig.columnVisibility && c.id in effectiveConfig.columnVisibility) {
      return effectiveConfig.columnVisibility[c.id] !== false;
    }
    return !boardPrefs[c.id]?.hidden;
  });

  // Title column = first text-type column by position; same fallback as S19.
  const textColumns = visibleColumns.filter((c) => c.type === "text");
  const titleColumn: Column | undefined =
    textColumns.length > 0
      ? textColumns.reduce<Column | undefined>(
          (min, c) => (min === undefined || c.position < min.position ? c : min),
          undefined,
        )
      : visibleColumns[0];

  const otherColumns = titleColumn
    ? visibleColumns.filter((c) => c.id !== titleColumn.id)
    : visibleColumns;

  // Derive aria-rowindex from visible tasks in store. O(n visible tasks) but
  // the virtualizer keeps visible count small. 1-based per ARIA spec.
  const ariaRowIndex = useBoardStore((s) => {
    const collapsedGroupIds = s.collapsedGroupIds;
    const groups = s.groups;
    const visibleTasks = s.tasks
      .filter((t) => !collapsedGroupIds.has(t.group_id))
      .sort((a, b) => {
        const groupA = groups.find((g) => g.id === a.group_id);
        const groupB = groups.find((g) => g.id === b.group_id);
        const groupPosDiff = (groupA?.position ?? 0) - (groupB?.position ?? 0);
        if (groupPosDiff !== 0) return groupPosDiff;
        return a.position - b.position;
      });
    return visibleTasks.findIndex((t) => t.id === task.id) + 1;
  });

  const isFocused = focusedRowId === task.id;

  // Presence dot — shows when any other user is viewing this task in the drawer (Epic 09)
  const viewingUserIds = useBoardStore((s) => selectUsersViewingTask(s, task.id));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { kind: "task", groupId: group.id },
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
    // Lift dragged row above siblings so it doesn't clip under sticky headers.
    ...(isDragging ? { zIndex: 1, opacity: 0.85 } : {}),
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: virtualised list uses div layout; <tr> cannot be used outside a <table> context; role="row" provides the correct ARIA semantics
    <div
      ref={setNodeRef}
      role="row"
      style={style}
      className="group flex items-center h-[var(--size-cell-h)] border-b border-[color:var(--color-border-strong)]"
      data-task-id={task.id}
      data-row-index={ariaRowIndex - 1}
      aria-rowindex={ariaRowIndex}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => setFocusedRow(task.id)}
    >
      {/* 6px group accent stripe */}
      <div
        className="h-full flex-shrink-0 border-l-[6px]"
        style={{ borderLeftColor: `var(${colorToken})` }}
        aria-hidden="true"
      />

      {/* Drag handle — wired to dnd-kit useSortable */}
      <TaskDragHandle attributes={attributes} listeners={listeners} />

      {/* Bulk-select checkbox */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)]">
        <BulkSelectCheckbox taskId={task.id} />
      </div>

      {/* Task title cell */}
      <div className="w-[var(--size-cell-w-task)] flex-shrink-0 overflow-hidden">
        <TaskTitleCell task={task} />
      </div>

      {/* Per-column data cells — one per visible non-title column, in position order */}
      {otherColumns.map((col) => {
        // Prefer view config width; fall back to legacy prefs; default 140px.
        const colWidth = effectiveConfig.columnWidths?.[col.id] ?? boardPrefs[col.id]?.width ?? 140;
        return (
          <div
            key={col.id}
            className="flex-shrink-0 overflow-hidden border-l border-[color:var(--color-border-strong)]"
            style={{ width: colWidth }}
          >
            <TableCell task={task} column={col} />
          </div>
        );
      })}

      {/* Presence dot — visible when at least one other user is viewing this task (Epic 09 F.3) */}
      {viewingUserIds.length > 0 && (
        <div
          role="status"
          className="flex-shrink-0 w-2 h-2 rounded-full bg-[color:var(--color-primary)] mx-1"
          title={`${viewingUserIds.length} viewer${viewingUserIds.length === 1 ? "" : "s"} in task`}
          aria-label={`${viewingUserIds.length} user${viewingUserIds.length === 1 ? "" : "s"} currently viewing this task`}
          data-testid="task-presence-dot"
        />
      )}

      {/* Overflow menu — hover-revealed, aligned to the right */}
      <div className="ml-auto pr-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)]">
        <TaskOverflowMenu task={task} group={group} />
      </div>
    </div>
  );
}
