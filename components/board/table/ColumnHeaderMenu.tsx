"use client";

/**
 * ColumnHeaderMenu — Base UI Menu popup for column header actions.
 *
 * Triggered by the chevron button inside <ColumnHeader />. The trigger
 * element is passed as `children` so ColumnHeader owns the button's visual
 * styling.
 *
 * Menu items:
 *   1. Rename — focuses EditableTitle via imperative ref.focus().
 *   2. Sort ascending / Sort descending / Clear sort — updates board store.
 *   3. Filter — disabled with tooltip "Coming in epic 11".
 *   4. Hide column / Show column — toggles columnPrefsByBoard hidden flag.
 *   5. Move left / Move right — optimistic reorder via reorderColumn action.
 *   6. Duplicate — forks column + labels via duplicateColumn action.
 *   7. Change type — sub-dialog to pick target type; handles lossy confirm.
 *   8. Settings — LabelEditorModal for status/priority; disabled for others.
 *   9. Delete column — typed-name confirm dialog; admin-only.
 *
 * Authorization: Delete column item is only enabled for admins (ROLE_RANK >= admin).
 * "Edit Labels" / LabelEditorModal gating is also admin-only per Q26.
 */

import { Menu, Tooltip } from "@base-ui/react";
import { Dialog } from "@base-ui/react/dialog";
import { Check, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { type ReactElement, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import {
  changeColumnType,
  deleteColumn,
  duplicateColumn,
  reorderColumn,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions";
import type { EditableTitleHandle } from "@/components/shared/EditableTitle";
import { useBoard } from "@/hooks/use-board";
import { ROLE_RANK } from "@/lib/authorization/roles";
import { CELL_TYPE_ICONS } from "@/lib/cells/icons";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { positionBetween } from "@/lib/positions";
import type { Database } from "@/lib/supabase/types";
import { useBoardStore } from "@/stores/board-store";
import { LabelEditorModal } from "./LabelEditorModal";
import type { Column } from "./types";

type Label = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// Helper – shared Menu.Item class string
// ---------------------------------------------------------------------------

const MENU_ITEM_CLS =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:bg-[color:var(--color-surface-hover)] focus-visible:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const MENU_ITEM_DESTRUCTIVE_CLS =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

// ---------------------------------------------------------------------------
// ChangeTypeDialog — sub-dialog for picking a conversion target type
// ---------------------------------------------------------------------------

interface ChangeTypeDialogProps {
  column: Column;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ChangeTypeDialog({ column, open, onOpenChange }: ChangeTypeDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingType, setPendingType] = useState<CellTypeId | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const confirmInputId = useId();
  const applyColumnUpsert = useBoardStore((s) => s.applyColumnUpsert);

  const currentType = column.type as CellTypeId;
  let convertibleTypes: CellTypeId[] = [];
  try {
    const def = getCellDef(currentType);
    convertibleTypes = Object.keys(def.convertTo ?? {}) as CellTypeId[];
  } catch {
    // Registry not yet initialized for this type — show empty list
  }

  function doChangeType(targetType: CellTypeId, confirmDataLoss: boolean) {
    startTransition(async () => {
      const result = await changeColumnType({
        columnId: column.id,
        newType: targetType,
        confirmDataLoss,
      });
      if (result.ok) {
        // Cast to Column: the action may return a partial shape in the early-exit
        // path (no-op when oldType === newType). applyColumnUpsert is idempotent so
        // a partial row with updated_at will not overwrite a fuller cached row.
        applyColumnUpsert(result.data.column as Column);
        onOpenChange(false);
        setConfirmOpen(false);
        setPendingType(null);
        setConfirmInput("");
        // Refresh cell data — type conversion affects cell rows non-trivially.
        router.refresh();
      } else if (result.error.code === "CONFIRMATION_REQUIRED") {
        // Prompt user to type CONFIRM
        setPendingType(targetType);
        setConfirmOpen(true);
      } else {
        toast.error(result.error.message ?? "Failed to change column type.");
      }
    });
  }

  function handleConfirmSubmit() {
    if (confirmInput !== "CONFIRM" || !pendingType) return;
    doChangeType(pendingType, true);
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]" />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs rounded-xl bg-surface p-4 shadow-[var(--shadow-modal)] focus:outline-none"
            aria-labelledby="change-type-title"
          >
            <Dialog.Title
              id="change-type-title"
              className="mb-3 text-sm font-semibold text-[color:var(--color-fg-strong)]"
            >
              Change column type
            </Dialog.Title>
            <p className="mb-3 text-xs text-[color:var(--color-fg-muted)]">
              Current type: <strong className="text-[color:var(--color-fg)]">{currentType}</strong>
            </p>
            {convertibleTypes.length === 0 ? (
              <p className="text-xs text-[color:var(--color-fg-muted)]">
                No compatible target types available.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {convertibleTypes.map((targetType) => {
                  const TargetIcon = CELL_TYPE_ICONS[targetType];
                  return (
                    <button
                      key={targetType}
                      type="button"
                      className={MENU_ITEM_CLS}
                      onClick={() => doChangeType(targetType, false)}
                    >
                      {TargetIcon && (
                        <TargetIcon
                          className="h-3.5 w-3.5 text-[color:var(--color-fg-muted)]"
                          aria-hidden="true"
                        />
                      )}
                      {targetType}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Dialog.Close className="rounded-md px-3 py-1.5 text-sm text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
                Cancel
              </Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Lossy-change confirmation dialog */}
      <Dialog.Root
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmOpen(false);
            setConfirmInput("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]" />
          <Dialog.Popup
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-modal)] focus:outline-none"
            aria-labelledby="lossy-confirm-title"
          >
            <Dialog.Title
              id="lossy-confirm-title"
              className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
            >
              This change may clear values
            </Dialog.Title>
            <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
              Changing the column type from{" "}
              <strong className="text-[color:var(--color-fg)]">{currentType}</strong> to{" "}
              <strong className="text-[color:var(--color-fg)]">{pendingType}</strong> may
              permanently remove existing cell values that cannot be converted.
            </p>
            <div className="mb-5 flex flex-col gap-1">
              <label
                htmlFor={confirmInputId}
                className="text-sm font-medium text-[color:var(--color-fg)]"
              >
                Type <strong>CONFIRM</strong> to proceed
              </label>
              <input
                id={confirmInputId}
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="CONFIRM"
                className="rounded-md border border-[color:var(--color-border-strong)] bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
                onClick={() => setConfirmInput("")}
              >
                Cancel
              </Dialog.Close>
              <button
                type="button"
                disabled={confirmInput !== "CONFIRM"}
                onClick={handleConfirmSubmit}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm change
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ---------------------------------------------------------------------------
// DeleteColumnDialog — typed-name confirm, admin-only
// ---------------------------------------------------------------------------

interface DeleteColumnDialogProps {
  column: Column;
  cellCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DeleteColumnDialog({ column, cellCount, open, onOpenChange }: DeleteColumnDialogProps) {
  const [, startTransition] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const inputId = useId();
  const applyColumnUpsert = useBoardStore((s) => s.applyColumnUpsert);
  const applyColumnDelete = useBoardStore((s) => s.applyColumnDelete);

  const matches = confirmText === "DELETE";

  function handleDelete() {
    if (!matches) return;
    // Optimistic delete
    applyColumnDelete(column.id);
    onOpenChange(false);
    setConfirmText("");
    startTransition(async () => {
      const result = await deleteColumn({ columnId: column.id });
      if (!result.ok) {
        // Revert — re-insert the column
        applyColumnUpsert(column);
        toast.error(result.error.message ?? "Failed to delete column.");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmText("");
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="delete-column-title"
        >
          <Dialog.Title
            id="delete-column-title"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Delete column permanently?
          </Dialog.Title>
          <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
            This action <strong className="text-[color:var(--color-fg)]">cannot be undone</strong>.
            The column <strong className="text-[color:var(--color-fg)]">{column.name}</strong> and{" "}
            <strong className="text-[color:var(--color-fg)]">{cellCount}</strong> cell{" "}
            {cellCount === 1 ? "value" : "values"} will be permanently deleted.
          </p>
          <div className="mb-5 flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-[color:var(--color-fg)]">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id={inputId}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="rounded-md border border-[color:var(--color-border-strong)] bg-surface px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
              autoComplete="off"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              disabled={!matches}
              onClick={handleDelete}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete permanently
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// ColumnHeaderMenu — main export
// ---------------------------------------------------------------------------

interface ColumnHeaderMenuProps {
  column: Column;
  editableRef: React.RefObject<EditableTitleHandle | null>;
  /** The trigger element (chevron button from ColumnHeader) — must be ReactElement */
  children: ReactElement;
}

export function ColumnHeaderMenu({ column, editableRef, children }: ColumnHeaderMenuProps) {
  const [, startTransition] = useTransition();
  const { role } = useBoard();
  const isAdmin = ROLE_RANK[role] >= ROLE_RANK.admin;

  const { columns, sortKeys, labelsByColumn, applyColumnUpsert, applyLabelUpsert } = useBoardStore(
    useShallow((s) => ({
      columns: s.columns,
      sortKeys: s.sortKeys,
      labelsByColumn: s.labelsByColumn,
      applyColumnUpsert: s.applyColumnUpsert,
      applyLabelUpsert: s.applyLabelUpsert,
    })),
  );

  const [labelEditorOpen, setLabelEditorOpen] = useState(false);
  const [changeTypeOpen, setChangeTypeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Cell count for delete dialog — derive from store cells
  const cells = useBoardStore((s) => s.cells);
  const cellCount = Array.from(cells.keys()).filter((k) => k.endsWith(`:${column.id}`)).length;

  // Current sort state for this column — reads the first sort key (quick-sort from header).
  const activeSortKey = sortKeys[0]?.columnId === column.id ? sortKeys[0] : null;
  const isActiveSortColumn = activeSortKey !== null;
  const currentSortDir = activeSortKey?.direction ?? null;

  // Hidden state from prefs
  const columnPrefsByBoard = useBoardStore((s) => s.columnPrefsByBoard);
  const boardId = useBoardStore((s) => s.boardId);
  const colPrefs = boardId ? (columnPrefsByBoard[boardId]?.[column.id] ?? {}) : {};
  const isHidden = colPrefs.hidden ?? false;

  // Position of this column in the sorted list
  const colIndex = columns.findIndex((c) => c.id === column.id);
  const prevCol = colIndex > 0 ? columns[colIndex - 1] : null;
  const prevPrevCol = colIndex > 1 ? columns[colIndex - 2] : null;
  const nextCol = colIndex < columns.length - 1 ? columns[colIndex + 1] : null;
  const nextNextCol = colIndex < columns.length - 2 ? columns[colIndex + 2] : null;

  const canMoveLeft = colIndex > 0;
  const canMoveRight = colIndex < columns.length - 1;

  // Determine if this column type has a settings editor
  const colType = column.type as CellTypeId;
  const isLabelType = colType === "status" || colType === "priority";
  let hasConfigEditor = false;
  try {
    const def = getCellDef(colType);
    hasConfigEditor = !!def.ConfigEditor;
  } catch {
    // Registry not yet initialized for this type
  }
  const hasSettings = isLabelType || hasConfigEditor;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleRename() {
    // Focus the editable title after the menu closes
    setTimeout(() => editableRef.current?.focus(), 0);
  }

  function handleSortAsc() {
    useBoardStore.getState().setSortKeys([{ columnId: column.id, direction: "asc" }]);
  }

  function handleSortDesc() {
    useBoardStore.getState().setSortKeys([{ columnId: column.id, direction: "desc" }]);
  }

  function handleSortNone() {
    useBoardStore.getState().setSortKeys([]);
  }

  function handleToggleHidden() {
    useBoardStore.getState().toggleColumnHidden(column.id);
  }

  function handleMoveLeft() {
    if (!canMoveLeft || !prevCol) return;
    try {
      const newPosition = positionBetween(prevPrevCol?.position ?? null, prevCol.position);
      // Optimistic update
      applyColumnUpsert({
        ...column,
        position: newPosition,
        updated_at: new Date().toISOString(),
      });
      startTransition(async () => {
        const result = await reorderColumn({ columnId: column.id, position: newPosition });
        if (result.ok) {
          applyColumnUpsert(result.data);
        } else {
          applyColumnUpsert(column);
          toast.error("Failed to move column.");
        }
      });
    } catch {
      toast.error("Cannot move column: positions need compaction.");
    }
  }

  function handleMoveRight() {
    if (!canMoveRight || !nextCol) return;
    try {
      const newPosition = positionBetween(nextCol.position, nextNextCol?.position ?? null);
      // Optimistic update
      applyColumnUpsert({
        ...column,
        position: newPosition,
        updated_at: new Date().toISOString(),
      });
      startTransition(async () => {
        const result = await reorderColumn({ columnId: column.id, position: newPosition });
        if (result.ok) {
          applyColumnUpsert(result.data);
        } else {
          applyColumnUpsert(column);
          toast.error("Failed to move column.");
        }
      });
    } catch {
      toast.error("Cannot move column: positions need compaction.");
    }
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateColumn({ columnId: column.id });
      if (result.ok) {
        applyColumnUpsert(result.data.column);
        for (const label of result.data.labels) {
          // Cast to Label: duplicateColumn selects a subset of label columns
          // (id, name, color, position); column_id is the new column's id.
          applyLabelUpsert(label as Label);
        }
      } else {
        toast.error(result.error.message ?? "Failed to duplicate column.");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Labels accessor for label editor (status/priority)
  // -------------------------------------------------------------------------
  const labels = labelsByColumn.get(column.id) ?? [];
  void labels; // referenced in LabelEditorModal via store, not passed directly

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <Menu.Root>
        <Menu.Trigger render={children as ReactElement} />

        <Menu.Portal>
          <Menu.Positioner
            side="bottom"
            align="start"
            sideOffset={4}
            style={{ zIndex: "var(--z-popover)" }}
          >
            <Menu.Popup
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-modal)",
                padding: "8px",
                minWidth: 200,
              }}
            >
              {/* 1. Rename */}
              <Menu.Item className={MENU_ITEM_CLS} onClick={handleRename}>
                Rename
              </Menu.Item>

              <div
                className="my-1 border-t border-[color:var(--color-border-strong)]"
                aria-hidden="true"
              />

              {/* 2. Sort ascending */}
              <Menu.Item className={MENU_ITEM_CLS} onClick={handleSortAsc}>
                <Check
                  size={12}
                  className={
                    currentSortDir === "asc" ? "text-[color:var(--color-primary)]" : "opacity-0"
                  }
                  aria-hidden="true"
                />
                Sort ascending
              </Menu.Item>

              {/* 2. Sort descending */}
              <Menu.Item className={MENU_ITEM_CLS} onClick={handleSortDesc}>
                <Check
                  size={12}
                  className={
                    currentSortDir === "desc" ? "text-[color:var(--color-primary)]" : "opacity-0"
                  }
                  aria-hidden="true"
                />
                Sort descending
              </Menu.Item>

              {/* 2. Clear sort — only shown when this column is the active sort */}
              {isActiveSortColumn && (
                <Menu.Item className={MENU_ITEM_CLS} onClick={handleSortNone}>
                  <Check size={12} className="opacity-0" aria-hidden="true" />
                  Clear sort
                </Menu.Item>
              )}

              {/* 3. Filter — disabled, coming in epic 11 */}
              <Tooltip.Provider delay={200}>
                <Tooltip.Root>
                  <Tooltip.Trigger render={<span className="w-full" />}>
                    <Menu.Item className={MENU_ITEM_CLS} disabled>
                      <Check size={12} className="opacity-0" aria-hidden="true" />
                      Filter
                    </Menu.Item>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner sideOffset={4}>
                      <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
                        Coming in epic 11
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              <div
                className="my-1 border-t border-[color:var(--color-border-strong)]"
                aria-hidden="true"
              />

              {/* 4. Hide / Show column */}
              <Menu.Item className={MENU_ITEM_CLS} onClick={handleToggleHidden}>
                {isHidden ? "Show column" : "Hide column"}
              </Menu.Item>

              {/* 5. Move left */}
              <Menu.Item className={MENU_ITEM_CLS} disabled={!canMoveLeft} onClick={handleMoveLeft}>
                Move left
              </Menu.Item>

              {/* 5. Move right */}
              <Menu.Item
                className={MENU_ITEM_CLS}
                disabled={!canMoveRight}
                onClick={handleMoveRight}
              >
                Move right
              </Menu.Item>

              <div
                className="my-1 border-t border-[color:var(--color-border-strong)]"
                aria-hidden="true"
              />

              {/* 6. Duplicate */}
              <Menu.Item className={MENU_ITEM_CLS} onClick={handleDuplicate}>
                Duplicate
              </Menu.Item>

              {/* 7. Change type */}
              <Menu.Item
                className={`${MENU_ITEM_CLS} justify-between`}
                onClick={() => setChangeTypeOpen(true)}
              >
                <span>Change type</span>
                <ChevronRight size={12} className="text-[color:var(--color-fg-muted)]" />
              </Menu.Item>

              <div
                className="my-1 border-t border-[color:var(--color-border-strong)]"
                aria-hidden="true"
              />

              {/* 8. Settings */}
              {isLabelType ? (
                <Menu.Item
                  className={MENU_ITEM_CLS}
                  disabled={!isAdmin}
                  onClick={() => {
                    if (isAdmin) setLabelEditorOpen(true);
                  }}
                >
                  Settings
                </Menu.Item>
              ) : hasSettings ? (
                <Menu.Item
                  className={MENU_ITEM_CLS}
                  onClick={() => {
                    // ConfigEditor support: open per-type settings dialog
                    // For v1 non-status/priority types, hasSettings=false
                    // This branch only reached when hasConfigEditor=true (future)
                    toast.info("Settings not yet available for this type.");
                  }}
                >
                  Settings
                </Menu.Item>
              ) : (
                <Tooltip.Provider delay={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger render={<span className="w-full" />}>
                      <Menu.Item className={MENU_ITEM_CLS} disabled>
                        Settings
                      </Menu.Item>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner sideOffset={4}>
                        <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
                          No settings for this column type
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}

              {/* 9. Delete column — admin-only */}
              {isAdmin ? (
                <Menu.Item
                  className={MENU_ITEM_DESTRUCTIVE_CLS}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete column
                </Menu.Item>
              ) : (
                <Tooltip.Provider delay={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger render={<span className="w-full" />}>
                      <Menu.Item className={MENU_ITEM_DESTRUCTIVE_CLS} disabled>
                        Delete column
                      </Menu.Item>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Positioner sideOffset={4}>
                        <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
                          Admin access required
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      {/* Dialogs rendered outside the menu so they survive menu close */}
      <LabelEditorModal column={column} open={labelEditorOpen} onOpenChange={setLabelEditorOpen} />

      <ChangeTypeDialog column={column} open={changeTypeOpen} onOpenChange={setChangeTypeOpen} />

      <DeleteColumnDialog
        column={column}
        cellCount={cellCount}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
