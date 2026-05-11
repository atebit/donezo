"use client";

/**
 * TaskOverflowMenu — overflow action menu for a task row.
 *
 * Appended to the hover-revealed slot at the right of <TaskRow />.
 *
 * Items:
 *   1. Rename    — calls focusTaskTitle(task.id) via setTimeout(0) so the focus
 *                  runs after Base UI Popover's focus-restore (F4.1).
 *   2. Duplicate — pessimistic; applyTaskUpsert on success.
 *   3. Delete    — Base UI Dialog confirm; optimistic; revert on error.
 *   4. Open task — Next <Link> to /w/[slug]/b/[id]/t/[taskId].
 *                  Route is a .gitkeep placeholder (epic 09); 404 is expected.
 *
 * Menu open state is controlled so action items can close the popover before
 * opening a dialog (avoids nesting interactive elements from Popover.Close).
 */

import { Dialog, Popover } from "@base-ui/react";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTask, duplicateTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { MenuList, MenuListItem } from "@/components/ui/menu-list";
import { useBoardStore } from "@/stores/board-store";

import { useTableKeyboard } from "./table-keyboard-context";
import type { Group, Task } from "./types";

interface TaskOverflowMenuProps {
  task: Task;
  group: Group;
}

export function TaskOverflowMenu({ task, group: _group }: TaskOverflowMenuProps) {
  const params = useParams<{ workspaceSlug: string; boardId: string }>();
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { focusTaskTitle } = useTableKeyboard();

  const taskTitle = task.title || "Untitled";

  // ---------------------------------------------------------------------------
  // Duplicate handler — pessimistic; applyTaskUpsert on success
  // ---------------------------------------------------------------------------
  const handleDuplicate = () => {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await duplicateTask({ taskId: task.id });
      if (result.ok) {
        useBoardStore.getState().applyTaskUpsert(result.data);
      } else {
        toast.error(result.error.message ?? "Failed to duplicate task.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Delete handler — optimistic, revert on error
  // ---------------------------------------------------------------------------
  const handleDeleteConfirm = () => {
    const snapshot = task;
    setDeleteDialogOpen(false);

    useBoardStore.getState().applyTaskDelete(task.id);

    startTransition(async () => {
      const result = await deleteTask({ taskId: task.id });
      if (!result.ok) {
        useBoardStore.getState().applyTaskUpsert({
          ...snapshot,
          updated_at: new Date().toISOString(),
        });
        toast.error(result.error.message ?? "Failed to delete task.");
      }
    });
  };

  return (
    <>
      {/* Delete confirm dialog — rendered outside the popover so it can open
          after the popover closes */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--color-overlay)]"
            style={{ backdropFilter: "blur(2px)" }}
          />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-modal)] focus:outline-none"
            aria-labelledby="task-delete-title"
          >
            <Dialog.Title
              id="task-delete-title"
              className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
            >
              Delete task &ldquo;{taskTitle}&rdquo;?
            </Dialog.Title>
            <p className="mb-5 text-sm text-[color:var(--color-fg-muted)]">
              This soft-deletes the task. It can be restored from Trash.
            </p>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-none"
              >
                Delete
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Overflow menu trigger + controlled popover */}
      <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Popover.Trigger
          render={<button type="button" />}
          aria-label={`Task menu: ${taskTitle}`}
          className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-xs)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={4} align="start">
            <Popover.Popup className="z-[var(--z-popover)]">
              <MenuList>
                {/* Rename — closes the popover then defers focus via setTimeout(0).
                    The deferral is required because Base UI Popover restores focus
                    to its trigger when it closes; a synchronous focus() call would
                    be overridden by that restore. setTimeout(0) sequences our call
                    after the popover's focus-restore in the microtask queue. */}
                <MenuListItem
                  onClick={() => {
                    setMenuOpen(false);
                    setTimeout(() => focusTaskTitle(task.id), 0);
                  }}
                >
                  Rename
                </MenuListItem>

                {/* Duplicate */}
                <MenuListItem onClick={handleDuplicate}>Duplicate</MenuListItem>

                {/* Delete — close menu then open confirm dialog */}
                <MenuListItem
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Delete
                </MenuListItem>

                {/* Open task — links to the task detail route.
                    Route is an epic 09 .gitkeep placeholder; 404 is acceptable per spec.
                    No disabled state, no tooltip (per spec). */}
                <Link
                  href={`/w/${params.workspaceSlug}/b/${params.boardId}/t/${task.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
                >
                  Open task
                </Link>
              </MenuList>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
