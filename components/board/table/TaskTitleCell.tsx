"use client";

import { useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

// isQueuedResult — type-narrowing guard for withOutbox's queued branch.
// Kept local so it does not add a new export to lib/realtime/outbox.ts.
function isQueuedResult(r: unknown): r is { queued: true } {
  return (
    r !== null &&
    typeof r === "object" &&
    "queued" in r &&
    (r as { queued?: unknown }).queued === true
  );
}

import { EditableTitle, type EditableTitleHandle } from "@/components/shared/EditableTitle";
import { wrappedRenameTask } from "@/lib/realtime/wrapped-actions";
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
      const result = await wrappedRenameTask({ taskId: task.id, title: next });
      // Soft success — optimistic update already applied; outbox will flush on reconnect.
      if (isQueuedResult(result)) return;
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
