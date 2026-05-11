"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { BulkSelectCheckbox } from "./BulkSelectCheckbox";
import { colorToToken } from "./group-color";
import { TaskDragHandle } from "./TaskDragHandle";
import { TaskTitleCell } from "./TaskTitleCell";
import type { Group, Task } from "./types";

interface TaskRowProps {
  task: Task;
  group: Group;
}

export function TaskRow({ task, group }: TaskRowProps) {
  const colorToken = colorToToken(group.color);

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
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center h-[var(--size-cell-h)] border-b border-[color:var(--color-border-strong)]"
      data-task-id={task.id}
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
    </div>
  );
}
