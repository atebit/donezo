"use client";

import { colorToToken } from "./group-color";
import { TaskTitleCell } from "./TaskTitleCell";
import type { Group, Task } from "./types";

interface TaskRowProps {
  task: Task;
  group: Group;
}

export function TaskRow({ task, group }: TaskRowProps) {
  const colorToken = colorToToken(group.color);

  return (
    <div
      className="group flex items-center h-[var(--size-cell-h)] border-b border-[color:var(--color-border-strong)]"
      data-task-id={task.id}
    >
      {/* 6px group accent stripe */}
      <div
        className="h-full flex-shrink-0 border-l-[6px]"
        style={{ borderLeftColor: `var(${colorToken})` }}
        aria-hidden="true"
      />

      {/* Drag handle placeholder — wired in S11 */}
      <button
        type="button"
        aria-label="Drag (wired in S11)"
        tabIndex={-1}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] flex-shrink-0 px-1 cursor-grab text-[color:var(--color-fg-muted)]"
      >
        ⋮⋮
      </button>

      {/* Bulk-select checkbox placeholder — wired in S12 */}
      <input
        type="checkbox"
        disabled
        aria-label="Select task (wired in S12)"
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] flex-shrink-0 mx-1"
      />

      {/* Task title cell */}
      <div className="w-[var(--size-cell-w-task)] flex-shrink-0 overflow-hidden">
        <TaskTitleCell task={task} />
      </div>
    </div>
  );
}
