"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useBoardStore } from "@/stores/board-store";

import { BulkSelectCheckbox } from "./BulkSelectCheckbox";
import { colorToToken } from "./group-color";
import { TaskDragHandle } from "./TaskDragHandle";
import { TaskOverflowMenu } from "./TaskOverflowMenu";
import { TaskTitleCell } from "./TaskTitleCell";
import { useTableKeyboard } from "./table-keyboard-context";
import type { Group, Task } from "./types";

interface TaskRowProps {
  task: Task;
  group: Group;
}

export function TaskRow({ task, group }: TaskRowProps) {
  const colorToken = colorToToken(group.color);
  const { focusedRowId, setFocusedRow } = useTableKeyboard();

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

      {/* Overflow menu — hover-revealed, aligned to the right */}
      <div className="ml-auto pr-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)]">
        <TaskOverflowMenu task={task} group={group} />
      </div>
    </div>
  );
}
