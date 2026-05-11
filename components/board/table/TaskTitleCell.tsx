"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { renameTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { useBoardStore } from "@/stores/board-store";

import type { Task } from "./types";

interface TaskTitleCellProps {
  task: Task;
}

export function TaskTitleCell({ task }: TaskTitleCellProps) {
  const [, startTransition] = useTransition();

  if (!task.title) {
    return (
      <span className="text-[color:var(--color-fg-muted)] px-1 text-sm" aria-hidden="true">
        Untitled
      </span>
    );
  }

  const handleCommit = (next: string) => {
    if (!next) return;

    // Optimistic update — bump updated_at so the idempotency guard passes.
    useBoardStore
      .getState()
      .applyTaskUpsert({ ...task, title: next, updated_at: new Date().toISOString() });

    startTransition(async () => {
      const result = await renameTask({ taskId: task.id, title: next });
      if (!result.ok) {
        // Revert to the original task row.
        useBoardStore.getState().applyTaskUpsert({ ...task, updated_at: new Date().toISOString() });
        toast.error(result.error.message ?? "Couldn't save title");
      } else {
        // Sync to the authoritative server row.
        useBoardStore.getState().applyTaskUpsert(result.data);
      }
    });
  };

  return (
    <EditableTitle
      initialValue={task.title}
      variant="body"
      onCommit={handleCommit}
      ariaLabel="Task title"
    />
  );
}
