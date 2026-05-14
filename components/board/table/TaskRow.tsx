"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquareIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { TableCell } from "@/components/cells/TableCell";
import { selectEffectiveConfig, selectUsersViewingTask, useBoardStore } from "@/stores/board-store";
import { useItemDrawerStore } from "@/stores/item-drawer-store";

import { BulkSelectCheckbox } from "./BulkSelectCheckbox";
import { useGridTemplate } from "./grid-template-context";
import { TaskDragHandle } from "./TaskDragHandle";
import { TaskOverflowMenu } from "./TaskOverflowMenu";
import { TaskTitleCell } from "./TaskTitleCell";
import { useTableKeyboard } from "./table-keyboard-context";
import type { Group, Task } from "./types";
import { useVisibleColumns } from "./use-visible-columns";

interface TaskRowProps {
  task: Task;
  group: Group;
}

export function TaskRow({ task, group }: TaskRowProps) {
  const { gridTemplateColumns } = useGridTemplate();
  const { titleColumn, otherColumns, getColumnWidth } = useVisibleColumns();
  const { focusedRowId, setFocusedRow } = useTableKeyboard();

  const openDrawer = useItemDrawerStore((s) => s.open);

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

  const viewingUserIds = useBoardStore(useShallow((s) => selectUsersViewingTask(s, task.id)));

  const isDraggable = useBoardStore((s) => {
    const config = selectEffectiveConfig(s);
    return (s.sortKeys ?? []).length === 0 && config.groupBy?.kind !== "column";
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { kind: "task", groupId: group.id },
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
    ...(isDragging ? { zIndex: 1, opacity: 0.85 } : {}),
    // Group accent stripe as inset box-shadow — does not consume a grid track,
    // preserving alignment with the header.
    boxShadow: "inset 6px 0 0 0 var(--group-accent)",
    gridTemplateColumns,
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: virtualised list uses div layout; <tr> cannot be used outside a <table> context; role="row" provides the correct ARIA semantics
    <div
      ref={setNodeRef}
      role="row"
      style={style}
      className="group relative grid items-center h-[var(--size-cell-h)] border-b border-[color:var(--color-border-strong)]"
      data-task-id={task.id}
      data-row-index={ariaRowIndex - 1}
      aria-rowindex={ariaRowIndex}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => setFocusedRow(task.id)}
    >
      {/* Drag handle — off-canvas, absolute positioned, not a grid track */}
      {isDraggable && (
        <div className="absolute left-0 top-0 h-full flex items-center -translate-x-full">
          <TaskDragHandle attributes={attributes} listeners={listeners} />
        </div>
      )}

      {/* Open-updates speech-bubble — hover-revealed, off-canvas left of the title cell.
          Positioned after the drag handle space so both affordances stay in the off-canvas
          zone without consuming a grid track. */}
      <button
        type="button"
        onClick={() => openDrawer(task.id)}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full ml-[-40px] flex items-center justify-center w-7 h-7 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] hover:bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
        aria-label={`Open ${task.title || "item"} details`}
        data-testid="open-item-drawer"
      >
        <MessageSquareIcon size={14} aria-hidden="true" />
      </button>

      {/* Checkbox grid cell */}
      <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)]">
        <BulkSelectCheckbox taskId={task.id} />
      </div>

      {/* Title cell — sticky left */}
      <div
        className="sticky left-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] h-full overflow-hidden"
        style={{ width: titleColumn ? getColumnWidth(titleColumn) : undefined }}
      >
        <TaskTitleCell task={task} />
      </div>

      {/* Per-column data cells */}
      {otherColumns.map((col) => (
        <div
          key={col.id}
          className="h-full overflow-hidden border-l border-[color:var(--color-border-strong)]"
          style={{ width: getColumnWidth(col) }}
        >
          <TableCell task={task} column={col} />
        </div>
      ))}

      {/* Add-column slot — empty */}
      <div className="h-full" />

      {/* Presence dot — visible when at least one other user is viewing this task */}
      {viewingUserIds.length > 0 && (
        <div
          role="status"
          className="absolute right-8 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[color:var(--color-primary)]"
          title={`${viewingUserIds.length} viewer${viewingUserIds.length === 1 ? "" : "s"} in task`}
          aria-label={`${viewingUserIds.length} user${viewingUserIds.length === 1 ? "" : "s"} currently viewing this task`}
          data-testid="task-presence-dot"
        />
      )}

      {/* Overflow menu — hover-revealed, absolute on right edge */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)]">
        <TaskOverflowMenu task={task} group={group} />
      </div>
    </div>
  );
}
