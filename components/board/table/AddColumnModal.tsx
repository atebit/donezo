"use client";

/**
 * AddColumnModal — multi-step Base UI <Dialog> for creating a new board column.
 *
 * Step 1: Type picker grid — shows all addable CellTypeIds (excludes derived
 *         types: updated_by, created_by, created_at_col). Includes `formula`
 *         as a disabled "Coming soon" tile.
 * Step 2: Configure — name input (defaults to def.label) + optional ConfigEditor
 *         (per CellTypeDef). Footer: Cancel / Add.
 *
 * Optimistic flow:
 *   1. applyColumnUpsert(optimistic row with tempId)
 *   2. startTransition → createColumn(...)
 *   3. on ok: applyColumnUpsertReplaceTemp(tempId, real) + applyLabelUpsert per label
 *   4. on error: applyColumnDelete(tempId) + toast.error
 */

import { Tooltip } from "@base-ui/react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, X } from "lucide-react";
import { startTransition, useState } from "react";
import { toast } from "sonner";

import { createColumn } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions";
import { useBoard } from "@/hooks/use-board";
import { CELL_TYPE_ICONS } from "@/lib/cells/icons";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Types that can be added by admins via the Add Column modal in v1. */
const EXCLUDED_TYPES: CellTypeId[] = ["updated_by", "created_by", "created_at_col"];

/** Shown in the grid but not interactive (coming soon). */
const COMING_SOON_TYPES: CellTypeId[] = ["formula"];

/** All types shown in the picker grid (addable + coming-soon disabled). */
const PICKER_TYPES: CellTypeId[] = (
  [
    "text",
    "long_text",
    "status",
    "priority",
    "person",
    "date",
    "timeline",
    "number",
    "currency",
    "checkbox",
    "file",
    "link",
    "tags",
    "rating",
    "email",
    "phone",
    "country",
    "vote",
    "week",
    "location",
    "formula",
  ] satisfies CellTypeId[]
).filter((t) => !EXCLUDED_TYPES.includes(t));

// ---------------------------------------------------------------------------
// TypeTile
// ---------------------------------------------------------------------------

interface TypeTileProps {
  typeId: CellTypeId;
  onClick: () => void;
}

function TypeTile({ typeId, onClick }: TypeTileProps) {
  const def = getCellDef(typeId);
  const Icon = CELL_TYPE_ICONS[typeId];
  const isComingSoon = COMING_SOON_TYPES.includes(typeId);

  const tile = (
    <button
      type="button"
      disabled={isComingSoon}
      onClick={isComingSoon ? undefined : onClick}
      aria-disabled={isComingSoon}
      className={[
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border",
        "w-[120px] h-[80px] text-center transition-colors",
        isComingSoon
          ? "border-[color:var(--color-border)] text-[color:var(--color-fg-subtle)] opacity-50 cursor-not-allowed"
          : [
              "border-[color:var(--color-border)] text-[color:var(--color-fg)]",
              "hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-surface-hover)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]",
            ].join(" "),
      ].join(" ")}
    >
      <Icon className="size-5 shrink-0 text-[color:var(--color-fg-muted)]" />
      <span className="text-xs font-medium leading-tight">
        {def.label}
        {isComingSoon && (
          <span className="block text-[10px] font-normal text-[color:var(--color-fg-subtle)]">
            Coming soon
          </span>
        )}
      </span>
    </button>
  );

  if (isComingSoon) {
    return tile;
  }

  return (
    <Tooltip.Provider delay={400}>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span className="inline-flex" />}>{tile}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
              {def.label}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — TypePicker
// ---------------------------------------------------------------------------

interface TypePickerProps {
  onSelect: (typeId: CellTypeId) => void;
}

function TypePicker({ onSelect }: TypePickerProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Dialog.Title className="text-base font-semibold text-[color:var(--color-fg-strong)]">
          Add column
        </Dialog.Title>
        <p className="mt-0.5 text-sm text-[color:var(--color-fg-muted)]">Pick a type</p>
      </div>

      {/* 6-column grid of 120px tiles; wraps to a new row after 6 */}
      <div className="grid grid-cols-6 gap-2">
        {PICKER_TYPES.map((typeId) => (
          <TypeTile key={typeId} typeId={typeId} onClick={() => onSelect(typeId)} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Configure
// ---------------------------------------------------------------------------

interface ConfigureStepProps {
  selectedType: CellTypeId;
  onBack: () => void;
  onCancel: () => void;
  onAdd: (name: string) => void;
  isPending: boolean;
}

function ConfigureStep({ selectedType, onBack, onCancel, onAdd, isPending }: ConfigureStepProps) {
  const def = getCellDef(selectedType);
  const [name, setName] = useState(def.label);
  const [config, setConfig] = useState(() => def.defaultConfig);
  const ConfigEditor = def.ConfigEditor;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to type picker"
          className="rounded-md p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <Dialog.Title className="text-base font-semibold text-[color:var(--color-fg-strong)]">
          {def.label}
        </Dialog.Title>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="add-column-name"
          className="text-sm font-medium text-[color:var(--color-fg)]"
        >
          Column name
        </label>
        <input
          id="add-column-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className={[
            "w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
            "px-3 py-1.5 text-sm text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]",
          ].join(" ")}
          placeholder={def.label}
        />
      </div>

      {/* Per-type config UI — omitted in v1 for status/priority (seed labels are sufficient) */}
      {ConfigEditor && selectedType !== "status" && selectedType !== "priority" && (
        <ConfigEditor config={config} onChange={setConfig} />
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className={[
            "rounded-md bg-[color:var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white",
            "hover:bg-[color:var(--color-accent-hover)] focus-visible:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {isPending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// AddColumnModal
// ---------------------------------------------------------------------------

export interface AddColumnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddColumnModal({ open, onOpenChange }: AddColumnModalProps) {
  const { board } = useBoard();
  const columns = useBoardStore((s) => s.columns);

  const [step, setStep] = useState<"pick" | "configure">("pick");
  const [selectedType, setSelectedType] = useState<CellTypeId | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleTypeSelect = (typeId: CellTypeId) => {
    setSelectedType(typeId);
    setStep("configure");
  };

  const handleBack = () => {
    setStep("pick");
    setSelectedType(null);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    // Reset to step 1 when closing
    if (!nextOpen) {
      setStep("pick");
      setSelectedType(null);
    }
  };

  const handleAdd = (name: string) => {
    if (!selectedType) return;

    const position = columns.length > 0 ? Math.max(...columns.map((c) => c.position)) + 1 : 1;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const now = new Date().toISOString();

    const optimisticColumn = {
      id: tempId,
      board_id: board.id,
      name,
      type: selectedType,
      position,
      settings: {},
      icon: null,
      created_at: now,
      updated_at: now,
    };

    useBoardStore.getState().applyColumnUpsert(optimisticColumn);

    // Close the modal immediately on optimistic add
    handleClose();

    setIsPending(true);

    startTransition(async () => {
      const result = await createColumn({
        boardId: board.id,
        name,
        type: selectedType,
        position,
        settings: {},
      });

      if (result.ok) {
        useBoardStore.getState().applyColumnUpsertReplaceTemp(tempId, result.data.column);
        for (const label of result.data.labels) {
          useBoardStore.getState().applyLabelUpsert(label);
        }
      } else {
        useBoardStore.getState().applyColumnDelete(tempId);
        toast.error(result.error.message);
      }

      setIsPending(false);
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleDialogOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className={[
            "fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2",
            "w-full rounded-xl bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-modal)] focus:outline-none",
            // Width accommodates the 6-column 120px tile grid plus gaps + padding
            step === "pick" ? "max-w-[820px]" : "max-w-sm",
          ].join(" ")}
          aria-labelledby="add-column-dialog-title"
        >
          {/* Close button — always visible */}
          <Dialog.Close
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
          >
            <X size={16} aria-hidden="true" />
          </Dialog.Close>

          {step === "pick" && <TypePicker onSelect={handleTypeSelect} />}

          {step === "configure" && selectedType && (
            <ConfigureStep
              selectedType={selectedType}
              onBack={handleBack}
              onCancel={handleClose}
              onAdd={handleAdd}
              isPending={isPending}
            />
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
