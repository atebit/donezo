"use client";

/**
 * BulkActionBar — floating action bar that appears when tasks are selected.
 *
 * Slides in from the bottom when selection.size > 0; slides out when empty.
 * Contains: count tile, Duplicate, Delete (with confirm dialog), Move to group
 * (popover), Apply column value (disabled + tooltip), and Clear selection.
 *
 * Optimistic pattern for Delete + Move:
 *   1. Snapshot the affected task rows.
 *   2. Apply optimistic store mutations immediately.
 *   3. Call the server action inside startTransition.
 *   4. On success: clearSelection().
 *   5. On error: revert via applyTaskUpsert(snapshot), toast.error().
 */

import { Popover, Tooltip } from "@base-ui/react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRightLeft, Columns3, Copy, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  bulkDeleteTasks,
  bulkDuplicateTasks,
  bulkMoveTasksToGroup,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
// ---------------------------------------------------------------------------

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
  isPending: boolean;
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isPending,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="bulk-delete-title"
        >
          <Dialog.Title
            id="bulk-delete-title"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Delete {count} task{count === 1 ? "" : "s"}?
          </Dialog.Title>
          <p className="mb-5 text-sm text-[color:var(--color-fg-muted)]">
            This action soft-deletes; task{count === 1 ? "" : "s"} can be restored from Trash.
          </p>
          <div className="flex justify-end gap-2">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={isPending}
              onClick={onConfirm}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// ActionButton — icon-on-top layout with 18px glyph + 12px label
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, onClick, disabled = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors duration-[var(--motion-fast)] text-[color:var(--color-fg)] hover:text-[color:var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
    >
      <span className="w-[18px] h-[18px] flex items-center justify-center">{icon}</span>
      <span className="text-[11px] font-medium leading-none whitespace-nowrap">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// BulkActionBar
// ---------------------------------------------------------------------------

export function BulkActionBar() {
  const { selection, tasks, groups } = useBoardStore((s) => ({
    selection: s.selection,
    tasks: s.tasks,
    groups: s.groups,
  }));

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movePopoverOpen, setMovePopoverOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [isDeletePending, setIsDeletePending] = useState(false);

  const count = selection.size;
  const isVisible = count > 0;

  // ---------------------------------------------------------------------------
  // Duplicate handler
  // ---------------------------------------------------------------------------
  const handleDuplicate = () => {
    const taskIds = Array.from(selection);

    startTransition(async () => {
      const result = await bulkDuplicateTasks({ taskIds });
      if (result.ok) {
        useBoardStore.getState().clearSelection();
        toast.success(`Duplicated ${taskIds.length} task${taskIds.length === 1 ? "" : "s"}.`);
      } else {
        toast.error(result.error.message ?? "Failed to duplicate tasks.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------
  const handleDeleteConfirm = () => {
    const taskIds = Array.from(selection);
    const snapshot = tasks.filter((t) => selection.has(t.id));

    // Optimistic: remove tasks from store
    for (const t of snapshot) {
      useBoardStore.getState().applyTaskDelete(t.id);
    }

    setDeleteDialogOpen(false);
    setIsDeletePending(true);

    startTransition(async () => {
      const result = await bulkDeleteTasks({ taskIds });
      setIsDeletePending(false);
      if (result.ok) {
        useBoardStore.getState().clearSelection();
      } else {
        // Revert
        for (const t of snapshot) {
          useBoardStore.getState().applyTaskUpsert(t);
        }
        toast.error(result.error.message ?? "Failed to delete tasks. Changes reverted.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Move to group handler
  // ---------------------------------------------------------------------------
  const handleMoveToGroup = (groupId: string) => {
    const taskIds = Array.from(selection);
    const snapshot = tasks.filter((t) => selection.has(t.id));

    // Optimistic: update group_id for each task
    const now = new Date().toISOString();
    for (const t of snapshot) {
      useBoardStore.getState().applyTaskUpsert({
        ...t,
        group_id: groupId,
        updated_at: now,
      });
    }

    setMovePopoverOpen(false);

    startTransition(async () => {
      const result = await bulkMoveTasksToGroup({ taskIds, groupId });
      if (result.ok) {
        useBoardStore.getState().clearSelection();
      } else {
        // Revert
        for (const t of snapshot) {
          useBoardStore.getState().applyTaskUpsert(t);
        }
        toast.error(result.error.message ?? "Failed to move tasks. Changes reverted.");
      }
    });
  };

  // Groups available for move: exclude groups where ALL selected tasks already live
  // (i.e. show all other groups for simplicity, always useful to have full list)
  const moveTargetGroups = groups.filter((g) => {
    const selectedInGroup = tasks.filter((t) => selection.has(t.id) && t.group_id === g.id);
    return selectedInGroup.length < count; // at least one selected task is NOT in this group
  });

  return (
    <>
      {/* Delete confirm dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        count={count}
        onConfirm={handleDeleteConfirm}
        isPending={isDeletePending}
      />

      {/* Floating bar — aria-live region announces selection changes to screen readers */}
      <div
        className="sticky bottom-4 z-[var(--z-sticky)] flex justify-center pointer-events-none"
        aria-live="polite"
      >
        <div
          className="pointer-events-auto flex items-stretch rounded-[5px] bg-[color:var(--color-surface)] shadow-[var(--shadow-bulk-bar)] overflow-hidden transition-all duration-[var(--motion-fast)]"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(100%)",
            pointerEvents: isVisible ? "auto" : "none",
          }}
        >
          {/* Count tile */}
          <div className="w-[63px] bg-[color:var(--color-primary)] text-white flex items-center justify-center px-2 text-sm font-medium flex-shrink-0">
            {count} task{count === 1 ? "" : "s"} selected
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 px-5 py-2">
            {/* Duplicate */}
            <ActionButton
              icon={<Copy size={18} aria-hidden="true" />}
              label="Duplicate"
              onClick={handleDuplicate}
            />

            {/* Delete */}
            <ActionButton
              icon={<Trash2 size={18} aria-hidden="true" />}
              label="Delete"
              onClick={() => setDeleteDialogOpen(true)}
            />

            {/* Move to group */}
            <Popover.Root open={movePopoverOpen} onOpenChange={setMovePopoverOpen}>
              <Popover.Trigger
                render={<button type="button" />}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors duration-[var(--motion-fast)] text-[color:var(--color-fg)] hover:text-[color:var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
              >
                <span className="w-[18px] h-[18px] flex items-center justify-center">
                  <ArrowRightLeft size={18} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                  Move to group ▾
                </span>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8}>
                  <Popover.Popup className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)] p-1 min-w-[180px] z-[var(--z-popover)]">
                    {moveTargetGroups.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-[color:var(--color-fg-muted)]">
                        No other groups available
                      </p>
                    ) : (
                      moveTargetGroups.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => handleMoveToGroup(g.id)}
                          className="w-full text-left px-3 py-2 text-sm text-[color:var(--color-fg)] rounded-[var(--radius-xs)] hover:bg-[color:var(--color-surface-hover)] transition-colors duration-[var(--motion-fast)] focus-visible:outline-none"
                        >
                          {g.name}
                        </button>
                      ))
                    )}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

            {/* Apply column value — disabled with tooltip */}
            <Tooltip.Provider delay={200}>
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={<span />}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-[var(--radius-xs)] opacity-40 cursor-not-allowed text-[color:var(--color-fg)]"
                  aria-disabled="true"
                >
                  <span className="w-[18px] h-[18px] flex items-center justify-center">
                    <Columns3 size={18} aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                    Apply column value ▾
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={4}>
                    <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm">
                      Coming in epic 07
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>

            {/* Clear selection */}
            <ActionButton
              icon={<X size={18} aria-hidden="true" />}
              label="Clear"
              onClick={() => useBoardStore.getState().clearSelection()}
            />
          </div>
        </div>
      </div>
    </>
  );
}
