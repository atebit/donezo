"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { createGroup } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions";
import { GROUP_PALETTE } from "@/lib/group-palette";
import { positionBetween } from "@/lib/positions";
import { useBoardStore } from "@/stores/board-store";

interface AddGroupFooterProps {
  boardId: string;
  /** Controlled: whether the inline input is open. */
  editingOpen?: boolean;
  /** Called when the footer wants to open or close itself. */
  onEditingOpenChange?: (open: boolean) => void;
}

export function AddGroupFooter({ boardId, editingOpen, onEditingOpenChange }: AddGroupFooterProps) {
  // Support both controlled and uncontrolled usage.
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = editingOpen !== undefined;
  const isEditing = isControlled ? editingOpen : internalOpen;

  const setIsEditing = (next: boolean) => {
    if (isControlled) {
      onEditingOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  const [value, setValue] = useState("New Group");
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // When switching to editing mode, select-all the default text.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleOpen = () => {
    setValue("New Group");
    setIsEditing(true);
  };

  const submitGroup = (name: string) => {
    if (!name.trim()) return;

    const groups = useBoardStore.getState().groups;
    const maxPosition = groups.length > 0 ? Math.max(...groups.map((g) => g.position)) : null;
    const position = positionBetween(maxPosition, null);

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();
    const color = GROUP_PALETTE[0];

    const capturedName = name;
    const capturedPosition = position;
    const capturedTempId = tempId;

    // Optimistic insert
    useBoardStore.getState().applyGroupUpsert({
      id: tempId,
      board_id: boardId,
      name: capturedName,
      color,
      position: capturedPosition,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    startTransition(async () => {
      const result = await createGroup({
        boardId,
        name: capturedName,
        color,
        position: capturedPosition,
      });
      if (result.ok) {
        // Two-call pattern: swap temp out, insert real row.
        useBoardStore.getState().applyGroupDelete(capturedTempId);
        useBoardStore.getState().applyGroupUpsert(result.data);
      } else {
        useBoardStore.getState().applyGroupDelete(capturedTempId);
        toast.error(result.error.message ?? "Couldn't create group");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!value.trim()) {
        setIsEditing(false);
        setValue("New Group");
        return;
      }
      submitGroup(value);
      setIsEditing(false);
      setValue("New Group");
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setValue("New Group");
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      submitGroup(value);
    }
    setIsEditing(false);
    setValue("New Group");
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 h-10 w-full px-[13px] text-sm text-[color:var(--color-fg-muted)] hover:text-foreground hover:bg-[color:var(--color-surface-row-hover)] transition-colors duration-[var(--motion-base)] cursor-pointer"
      >
        <span aria-hidden="true" className="text-base leading-none">
          +
        </span>
        Add new group
      </button>
    );
  }

  return (
    <div className="flex items-center h-10 w-full border-b border-[color:var(--color-border-strong)] px-[13px]">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex-1 h-full bg-transparent text-sm font-medium outline-none text-foreground"
        aria-label="New group name"
      />
    </div>
  );
}
