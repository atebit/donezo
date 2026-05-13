"use client";

/**
 * EmptyLaneAddTask — "+ Add task" affordance rendered inside an empty kanban lane.
 *
 * On click:
 *   1. Calls `createTask({ groupId, title: "", position })` to create the task.
 *   2. Calls `setCellValue({ taskId, columnId: groupByColumnId, value: dropValue })` to
 *      immediately pre-set the lane's cell value.
 *
 * Both server actions are fired sequentially. On success a toast is shown.
 * Errors are surfaced via sonner toast.
 */

import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { setCellValue } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import { createTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { useBoardStore } from "@/stores/board-store";

interface EmptyLaneAddTaskProps {
  groupId: string;
  groupByColumnId: string;
  /** The value that setCellValue should write when the task is placed in this lane. */
  dropValue: unknown;
}

export function EmptyLaneAddTask({ groupId, groupByColumnId, dropValue }: EmptyLaneAddTaskProps) {
  const [isPending, setIsPending] = useState(false);

  // Get the current max task position to append at the end.
  const tasks = useBoardStore(useShallow((s) => s.tasks));

  async function handleAddTask() {
    if (isPending) return;
    setIsPending(true);
    try {
      // Compute the next position (after all tasks in the group).
      const groupTasks = tasks.filter((t) => t.group_id === groupId);
      const lastPosition =
        groupTasks.length > 0 ? Math.max(...groupTasks.map((t) => t.position)) : 0;
      const nextPosition = lastPosition + 1;

      const result = await createTask({ groupId, title: "New task", position: nextPosition });

      // If createTask returns the task (ok case), it comes back directly via withUser.
      // withUser returns the result value directly on success.
      // biome-ignore lint/suspicious/noExplicitAny: withUser return type is opaque
      const task = result as any;
      if (!task?.id) {
        toast.error("Failed to create task");
        return;
      }

      // Pre-set the lane's cell value.
      await setCellValue({ taskId: task.id, columnId: groupByColumnId, value: dropValue });
      toast.success("Task added");
    } catch {
      toast.error("Failed to add task");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAddTask}
      disabled={isPending}
      aria-label="Add task to this lane"
      className="w-full text-left px-3 py-2 text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] rounded transition-colors"
    >
      {isPending ? "Adding…" : "+ Add task"}
    </button>
  );
}
