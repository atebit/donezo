"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { positionBetween } from "@/lib/positions";
import { useBoardStore } from "@/stores/board-store";

import type { Group } from "./types";

interface AddTaskFooterProps {
  group: Group;
}

export function AddTaskFooter({ group }: AddTaskFooterProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input whenever editing mode activates.
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleOpen = () => {
    setIsEditing(true);
  };

  const submitTask = (title: string) => {
    if (!title.trim()) return;

    const tasks = useBoardStore.getState().tasks.filter((t) => t.group_id === group.id);
    const maxPosition = tasks.length > 0 ? Math.max(...tasks.map((t) => t.position)) : null;
    const position = positionBetween(maxPosition, null);

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();

    const capturedTitle = title;
    const capturedPosition = position;
    const capturedTempId = tempId;

    // Optimistic insert
    useBoardStore.getState().applyTaskUpsert({
      id: tempId,
      board_id: group.board_id,
      group_id: group.id,
      title: capturedTitle,
      position: capturedPosition,
      created_by: null,
      updated_by: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    startTransition(async () => {
      const result = await createTask({
        groupId: group.id,
        title: capturedTitle,
        position: capturedPosition,
      });
      if (result.ok) {
        useBoardStore.getState().applyTaskUpsertReplaceTemp(capturedTempId, result.data);
      } else {
        useBoardStore.getState().applyTaskDelete(capturedTempId);
        toast.error(result.error.message ?? "Couldn't create task");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!value.trim()) return;
      submitTask(value);
      // Chain-add: clear value, keep editing, refocus
      setValue("");
      // Input stays focused naturally
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setValue("");
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      // Blur with content: create + dismiss
      submitTask(value);
    }
    setIsEditing(false);
    setValue("");
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 h-[var(--size-cell-h)] w-full px-4 text-sm text-[color:var(--color-fg-muted)] hover:text-foreground hover:bg-[color:var(--color-surface-row-hover)] transition-colors duration-[var(--motion-base)] cursor-pointer border-b border-[color:var(--color-border-strong)]"
      >
        <span aria-hidden="true" className="text-base leading-none">
          +
        </span>
        Add task
      </button>
    );
  }

  return (
    <div className="flex items-center h-[var(--size-cell-h)] w-full border-b border-[color:var(--color-border-strong)] pl-4">
      {/* Indent to align with task titles */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Task name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 h-full bg-transparent text-sm outline-none placeholder:text-[color:var(--color-fg-muted)] text-foreground"
        aria-label="New task name"
      />
    </div>
  );
}
