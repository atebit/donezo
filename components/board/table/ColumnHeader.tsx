"use client";

/**
 * ColumnHeader — rendered once per visible column inside <StickyHeader />.
 *
 * Responsibilities:
 *   - Displays the cell-type icon (lucide) mapped from CELL_TYPE_ICONS.
 *   - Inline-editable column name via <EditableTitle /> (body variant).
 *   - Chevron button → opens <ColumnHeaderMenu /> in a Base UI Menu popup.
 *   - Sort indicator (↑ / ↓) when this column is the active sort column.
 *   - Resize drag handle slot (data-resize-handle data-column-id) — S18 wires
 *     the actual pointer logic; this slice just exposes the slot.
 *
 * Rename flow (optimistic):
 *   1. applyColumnUpsert({ ...column, name: nextName }) immediately.
 *   2. startTransition → renameColumn server action.
 *   3. On success: applyColumnUpsert(result.data) (server-confirmed row).
 *   4. On failure: applyColumnUpsert(column) revert + toast.
 *
 * Height: `--size-cell-h` (36px) + 5px extra chrome = 41px ≈ 40px. We use
 * h-10 (40px) which aligns with Monday-style header chrome per component-system.
 */

import { ChevronDown } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import { renameColumn } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions";
import { EditableTitle, type EditableTitleHandle } from "@/components/shared/EditableTitle";
import { CELL_TYPE_ICONS } from "@/lib/cells/icons";
import type { CellTypeId } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";

import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import type { Column } from "./types";

interface ColumnHeaderProps {
  column: Column;
}

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const [, startTransition] = useTransition();
  const editableRef = useRef<EditableTitleHandle>(null);

  const sortColumnId = useBoardStore((s) => s.sortColumnId);
  const sortDirection = useBoardStore((s) => s.sortDirection);
  const applyColumnUpsert = useBoardStore((s) => s.applyColumnUpsert);

  const isActiveSortColumn = sortColumnId === column.id;
  const TypeIcon = CELL_TYPE_ICONS[column.type as CellTypeId];

  const handleRename = async (nextName: string) => {
    // Optimistic update
    applyColumnUpsert({
      ...column,
      name: nextName,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await renameColumn({ columnId: column.id, name: nextName });
      if (result.ok) {
        applyColumnUpsert(result.data);
      } else {
        // Revert on failure
        applyColumnUpsert(column);
        toast.error("Failed to rename column.");
      }
    });
  };

  return (
    <div
      className="relative flex h-10 items-center gap-1 border-r border-[color:var(--color-border-strong)] px-2 select-none group"
      style={{ width: "var(--size-cell-w)" }}
      data-column-id={column.id}
    >
      {/* Type icon */}
      {TypeIcon && (
        <TypeIcon
          className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-fg-muted)]"
          aria-hidden="true"
        />
      )}

      {/* Editable column name — fills remaining width */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <EditableTitle
          ref={editableRef}
          initialValue={column.name}
          variant="body"
          onCommit={handleRename}
          ariaLabel={`Column: ${column.name}`}
          className="truncate"
        />
      </div>

      {/* Sort indicator — shown only when this column is sorted */}
      {isActiveSortColumn && sortDirection && (
        <span
          className="shrink-0 text-xs text-[color:var(--color-fg-muted)]"
          title={sortDirection === "asc" ? "Sorted ascending" : "Sorted descending"}
        >
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      )}

      {/* Chevron — opens column menu. Visible on hover (group-hover) or focus. */}
      <ColumnHeaderMenu column={column} editableRef={editableRef}>
        <button
          type="button"
          aria-label={`Open column menu for ${column.name}`}
          className="shrink-0 flex items-center justify-center rounded p-0.5 text-[color:var(--color-fg-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)]"
        >
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </ColumnHeaderMenu>

      {/* Resize drag handle — S18 wires pointer events to this slot */}
      <div
        data-resize-handle
        data-column-id={column.id}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize"
        aria-hidden="true"
      />
    </div>
  );
}
