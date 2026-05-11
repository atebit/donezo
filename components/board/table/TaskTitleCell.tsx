"use client";

import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import { renameTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { EditableTitle, type EditableTitleHandle } from "@/components/shared/EditableTitle";
import { useBoardStore } from "@/stores/board-store";

import { useTableKeyboard } from "./table-keyboard-context";
import type { Task } from "./types";

interface TaskTitleCellProps {
  task: Task;
}

export function TaskTitleCell({ task }: TaskTitleCellProps) {
  const [, startTransition] = useTransition();
  const { registerTitleCellRef, endEdit } = useTableKeyboard();

  // Ref to the EditableTitle's imperative handle — the keyboard controller
  // calls handle.focus() to enter edit mode programmatically.
  const editableRef = useRef<EditableTitleHandle | null>(null);

  // Register / unregister with the keyboard controller on mount/unmount so
  // the controller can always find the current handle regardless of whether
  // the virtualizer has the row mounted.
  useEffect(() => {
    registerTitleCellRef(task.id, editableRef.current);
    return () => {
      registerTitleCellRef(task.id, null);
    };
  }, [task.id, registerTitleCellRef]);

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

  const handleEditingChange = (editing: boolean) => {
    if (!editing) {
      // The user exited edit mode (blur, Enter, or Esc) — inform the keyboard
      // controller so it can clear editingRowId and re-focus the row.
      endEdit();
    }
  };

  return (
    <EditableTitle
      ref={editableRef}
      initialValue={task.title}
      variant="body"
      onCommit={handleCommit}
      onEditingChange={handleEditingChange}
      ariaLabel="Task title"
    />
  );
}
