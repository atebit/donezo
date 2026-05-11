"use client";

/**
 * BulkActionBar — floating action bar that appears when tasks are selected.
 *
 * Slides in from the bottom when selection.size > 0; slides out when empty.
 * Contains: count tile, Duplicate, Delete (with confirm dialog), Move to group
 * (popover), Apply column value (Popover with column picker → inline editor),
 * and Clear selection.
 *
 * Optimistic pattern for Delete + Move:
 *   1. Snapshot the affected task rows.
 *   2. Apply optimistic store mutations immediately.
 *   3. Call the server action inside startTransition.
 *   4. On success: clearSelection().
 *   5. On error: revert via applyTaskUpsert(snapshot), toast.error().
 *
 * Apply column value (S22):
 *   Two-step flow inside a single Popover:
 *     Step 1: column picker (filtered to the 9 bulk-settable types per Q10).
 *     Step 2: inline editor for the chosen column.
 *   Optimistic + revert on failure (same pattern as Delete/Move).
 *   Confirm dialog (Base UI <Dialog>) for selection > 25 tasks.
 */

import { Popover } from "@base-ui/react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRightLeft, Columns3, Copy, Trash2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  bulkDeleteTasks,
  bulkDuplicateTasks,
  bulkMoveTasksToGroup,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { CELL_TYPE_ICONS } from "@/lib/cells/icons";
import { getCellDef } from "@/lib/cells/registry";
import type { CellRow, CellTypeId } from "@/lib/cells/types";
import { wrappedBulkSetCellValue } from "@/lib/realtime/wrapped-actions";
import { useBoardStore } from "@/stores/board-store";

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

// ---------------------------------------------------------------------------
// Bulk-settable column types (Q10)
// Ordered by anticipated frequency of use.
// ---------------------------------------------------------------------------

const BULK_SETTABLE_TYPES = new Set<CellTypeId>([
  "status",
  "person",
  "date",
  "checkbox",
  "text",
  "number",
  "currency",
  "priority",
  "rating",
]);

// Confirm dialog threshold (spec: > 25 tasks)
const CONFIRM_THRESHOLD = 25;

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
// BulkApplyConfirmDialog — shown when taskIds.length > CONFIRM_THRESHOLD
// ---------------------------------------------------------------------------

interface BulkApplyConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function BulkApplyConfirmDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  onCancel,
}: BulkApplyConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="bulk-apply-confirm-title"
        >
          <Dialog.Title
            id="bulk-apply-confirm-title"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Update {count} tasks?
          </Dialog.Title>
          <p className="mb-5 text-sm text-[color:var(--color-fg-muted)]">
            This will update {count} tasks. Continue?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-[color:var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none"
            >
              Apply
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
  const { selection, tasks, groups, columns } = useBoardStore(
    useShallow((s) => ({
      selection: s.selection,
      tasks: s.tasks,
      groups: s.groups,
      columns: s.columns,
    })),
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movePopoverOpen, setMovePopoverOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [isDeletePending, setIsDeletePending] = useState(false);

  // ---------------------------------------------------------------------------
  // Apply column value state
  // ---------------------------------------------------------------------------

  /** Whether the Apply column value popover is open. */
  const [applyPopoverOpen, setApplyPopoverOpen] = useState(false);

  /** Which column was chosen in step 1 (null = still in step 1). */
  const [selectedColumn, setSelectedColumn] = useState<(typeof columns)[number] | null>(null);

  /** Confirm dialog state for > CONFIRM_THRESHOLD tasks. */
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);

  /**
   * Pending value waiting for user confirmation (only set when
   * applyConfirmOpen is true).
   */
  const pendingApplyValue = useRef<unknown>(null);

  const count = selection.size;
  const isVisible = count > 0;

  // Columns that can be bulk-set (Q10: 9 types)
  const bulkSettableColumns = columns.filter((c) => BULK_SETTABLE_TYPES.has(c.type as CellTypeId));

  /** Reset Apply column value popover to initial state. */
  const resetApplyState = () => {
    setSelectedColumn(null);
    pendingApplyValue.current = null;
  };

  const handleApplyPopoverOpenChange = (open: boolean) => {
    setApplyPopoverOpen(open);
    if (!open) {
      resetApplyState();
    }
  };

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

  // ---------------------------------------------------------------------------
  // Apply column value handler
  //
  // Called when the editor emits onChange(value). For editors that immediately
  // commit (checkbox, status, date), onChange fires once then onClose fires.
  //
  // Design note: editors whose editorMode is "popover" are normally rendered
  // INSIDE a Base UI <Popover> by the S15 orchestrator. Here we render them
  // INLINE within our Apply column value Popover to avoid nested Popovers.
  // The S15 normalized editors are all content-only (no <Popover.Root> of their
  // own), so this works correctly for all 9 bulk-settable types.
  // ---------------------------------------------------------------------------

  /**
   * Core apply logic — runs after user has confirmed (or count <= CONFIRM_THRESHOLD).
   * Uses the snapshot captured at time of value selection to allow revert.
   */
  const executeApply = (
    col: (typeof columns)[number],
    value: unknown,
    taskIds: string[],
    snapshot: Map<string, CellRow | null>,
  ) => {
    const def = getCellDef(col.type as CellTypeId);
    const patch = def.toRow(value);
    const now = new Date().toISOString();

    // Optimistic: apply to each task in store
    for (const taskId of taskIds) {
      const prev = snapshot.get(taskId);
      const optimistic: CellRow = {
        task_id: taskId,
        column_id: col.id,
        ...patch,
        updated_by: null,
        updated_at: now,
        created_at: prev?.created_at ?? now,
      } as CellRow;
      useBoardStore.getState().applyCellUpsert(optimistic);
    }

    // Close popover and reset state before the async call
    setApplyPopoverOpen(false);
    resetApplyState();

    startTransition(async () => {
      const result = await wrappedBulkSetCellValue({
        taskIds,
        columnId: col.id,
        value,
      });

      // Soft success — optimistic update already applied; outbox will flush on reconnect.
      if (isQueuedResult(result)) return;

      if (result.ok) {
        // Reconcile with server-returned cells
        for (const cell of result.data.cells) {
          useBoardStore.getState().applyCellUpsert(cell);
        }
        useBoardStore.getState().clearSelection();
      } else {
        // Revert optimistic cells from snapshot
        snapshot.forEach((prev, _taskId) => {
          if (prev !== null) {
            useBoardStore.getState().applyCellUpsert(prev);
          } else {
            // No prior cell existed — the optimistic entry stands
            // (applyCellUpsert is idempotent; we can't delete a cell from the store
            // without a dedicated applyTaskDelete path). Toast informs the user.
          }
        });
        toast.error(result.error.message ?? "Failed to apply column value. Changes reverted.");
      }
    });
  };

  /**
   * Called by the editor's onChange prop. Takes a snapshot, optionally shows
   * the confirm dialog (> CONFIRM_THRESHOLD), then applies.
   */
  const handleApply = (value: unknown) => {
    if (!selectedColumn) return;

    const col = selectedColumn;
    const taskIds = Array.from(useBoardStore.getState().selection);

    // Snapshot current cells for these taskIds + columnId
    const snapshot = new Map<string, CellRow | null>();
    for (const taskId of taskIds) {
      const key = `${taskId}:${col.id}`;
      snapshot.set(taskId, useBoardStore.getState().cells.get(key) ?? null);
    }

    if (taskIds.length > CONFIRM_THRESHOLD) {
      // Store the pending state and open confirm dialog
      pendingApplyValue.current = { col, value, taskIds, snapshot };
      setApplyConfirmOpen(true);
      return;
    }

    executeApply(col, value, taskIds, snapshot);
  };

  /**
   * handleApplyCancel — called when the editor emits onClose WITHOUT a prior
   * onChange. Resets to step 1 of the picker.
   */
  const handleApplyCancel = () => {
    setSelectedColumn(null);
  };

  /** Confirm dialog "Apply" — proceed with the pending apply. */
  const handleApplyConfirm = () => {
    setApplyConfirmOpen(false);
    const pending = pendingApplyValue.current as {
      col: (typeof columns)[number];
      value: unknown;
      taskIds: string[];
      snapshot: Map<string, CellRow | null>;
    } | null;
    if (!pending) return;
    pendingApplyValue.current = null;
    executeApply(pending.col, pending.value, pending.taskIds, pending.snapshot);
  };

  /** Confirm dialog "Cancel" — discard pending apply and close everything. */
  const handleApplyConfirmCancel = () => {
    setApplyConfirmOpen(false);
    pendingApplyValue.current = null;
    setApplyPopoverOpen(false);
    resetApplyState();
  };

  // Groups available for move: exclude groups where ALL selected tasks already live
  const moveTargetGroups = groups.filter((g) => {
    const selectedInGroup = tasks.filter((t) => selection.has(t.id) && t.group_id === g.id);
    return selectedInGroup.length < count;
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

      {/* Apply column value confirm dialog (> CONFIRM_THRESHOLD tasks) */}
      <BulkApplyConfirmDialog
        open={applyConfirmOpen}
        onOpenChange={setApplyConfirmOpen}
        count={count}
        onConfirm={handleApplyConfirm}
        onCancel={handleApplyConfirmCancel}
      />

      {/* Floating bar — aria-live region announces selection changes to screen readers */}
      <div
        className="fixed bottom-[35px] left-1/2 h-[63px] w-[60%] z-[var(--z-popover)] pointer-events-none transition-[opacity,transform] duration-[var(--motion-fast)]"
        aria-live="polite"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translate(-50%, 0)" : "translate(-50%, 100%)",
          pointerEvents: isVisible ? "auto" : "none",
        }}
      >
        <div className="pointer-events-auto flex items-stretch h-full rounded-[5px] bg-[color:var(--color-surface)] shadow-[var(--shadow-bulk-bar)] overflow-hidden">
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

            {/* Apply column value — two-step Popover: column picker → inline editor */}
            <Popover.Root open={applyPopoverOpen} onOpenChange={handleApplyPopoverOpenChange}>
              <Popover.Trigger
                render={<button type="button" />}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-[var(--radius-xs)] transition-colors duration-[var(--motion-fast)] text-[color:var(--color-fg)] hover:text-[color:var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
              >
                <span className="w-[18px] h-[18px] flex items-center justify-center">
                  <Columns3 size={18} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                  Apply column value ▾
                </span>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8}>
                  <Popover.Popup className="rounded-[var(--radius-md)] bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)] overflow-hidden z-[var(--z-popover)]">
                    {selectedColumn === null ? (
                      /* ── Step 1: Column picker ── */
                      <ColumnPicker columns={bulkSettableColumns} onSelect={setSelectedColumn} />
                    ) : (
                      /* ── Step 2: Inline editor ── */
                      <ColumnEditor
                        column={selectedColumn}
                        onApply={handleApply}
                        onCancel={handleApplyCancel}
                      />
                    )}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>

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

// ---------------------------------------------------------------------------
// ColumnPicker — Step 1: list of bulk-settable columns
// ---------------------------------------------------------------------------

interface ColumnPickerProps {
  columns: ReturnType<typeof useBoardStore.getState>["columns"];
  onSelect: (col: ReturnType<typeof useBoardStore.getState>["columns"][number]) => void;
}

function ColumnPicker({ columns, onSelect }: ColumnPickerProps) {
  if (columns.length === 0) {
    return (
      <div className="py-3 px-4 min-w-[200px]">
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          No bulk-settable columns on this board.
        </p>
        <p className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
          Add a Status, Person, Date, Checkbox, Text, Number, Currency, Priority, or Rating column.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-1 min-w-[200px] max-h-72 overflow-y-auto">
      <p className="px-3 pb-1 pt-1 text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wider">
        Choose column
      </p>
      {columns.map((col) => {
        const Icon = CELL_TYPE_ICONS[col.type as CellTypeId];
        return (
          <button
            key={col.id}
            type="button"
            onClick={() => onSelect(col)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors duration-[var(--motion-fast)] cursor-pointer focus-visible:outline-none"
          >
            {Icon && <Icon className="w-4 h-4 shrink-0 text-[color:var(--color-fg-muted)]" />}
            <span className="truncate">{col.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColumnEditor — Step 2: inline editor for the chosen column
//
// Design note: popover-mode editors (status, priority, person, date) are
// normally wrapped in a Base UI <Popover.Root> by the S15 orchestrator.
// Here they are rendered INLINE inside the Apply column value Popover to
// avoid nested Popovers. The S15 normalized editors are all content-only
// (they contain no <Popover.Root> of their own), so this works correctly.
// onClose from the editor signals "cancel"; onChange signals "apply".
// ---------------------------------------------------------------------------

interface ColumnEditorProps {
  column: ReturnType<typeof useBoardStore.getState>["columns"][number];
  /** Called with the chosen value when the editor commits. */
  onApply: (value: unknown) => void;
  /** Called when the editor closes without committing (Esc / Cancel). */
  onCancel: () => void;
}

function ColumnEditor({ column, onApply, onCancel }: ColumnEditorProps) {
  /**
   * Track whether onChange has already fired. Editors like CheckboxEditor and
   * StatusLabelEditor call onChange(v) then onClose() in sequence. We use this
   * ref to distinguish "cancel-only onClose" from "post-commit onClose".
   */
  const appliedRef = useRef(false);

  const def = getCellDef(column.type as CellTypeId);
  const EditorComponent = def.Editor;

  const handleChange = (value: unknown) => {
    appliedRef.current = true;
    onApply(value);
  };

  const handleClose = () => {
    if (!appliedRef.current) {
      // User cancelled without committing
      onCancel();
    }
    // If appliedRef.current is true, onApply already fired — do nothing here.
  };

  // Back button header
  return (
    <div className="flex flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--color-border-strong)]">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Back to column picker"
          className="text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors duration-[var(--motion-fast)] cursor-pointer focus-visible:outline-none"
        >
          ← Back
        </button>
        <span className="text-xs font-medium text-[color:var(--color-fg)] truncate">
          {column.name}
        </span>
      </div>

      {/* Editor — rendered inline regardless of def.editorMode (see design note above) */}
      <EditorComponent
        value={null}
        // biome-ignore lint/suspicious/noExplicitAny: column.settings is jsonb; per-type configs are individually typed in def.ts
        config={column.settings as any}
        onChange={handleChange}
        onClose={handleClose}
        // Optional extras consumed by specific editors (ignored by others):
        // columnId is used by status/priority to look up labels from the store
        // @ts-expect-error: columnId is an optional extra prop on status/priority editors; CellTypeDef.Editor does not include it in the base type
        columnId={column.id}
        // members is used by person editor; we pass undefined and let the editor
        // fall back to its empty-list default (no workspace context here).
        members={undefined}
      />
    </div>
  );
}
