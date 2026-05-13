"use client";

/**
 * SortBuilder — popover content for the Sort button in the view toolbar.
 *
 * Features:
 *   - Multi-key sort list (sort priority = array order).
 *   - dnd-kit reorderable (own DndContext so it does not collide with the
 *     board-page-level DndContext).
 *   - + / - / clear controls.
 *
 * Prop-driven: does NOT call useBoardView(). The ViewToolbar (Slice D) owns
 * the popover state and hands sort + onChange down.
 */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useCallback } from "react";
import { getCellDef } from "@/lib/cells/registry";
import type { Database } from "@/lib/supabase/types";
import type { SortKey } from "@/lib/views/config-schema";

import { SortRow } from "./SortRow";

type Column = Database["public"]["Tables"]["column"]["Row"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SortBuilderProps {
  /** Current sort keys from view config. */
  sort: SortKey[];
  /** All columns available on this board. */
  columns: Column[];
  /** Called when the sort list changes. */
  onChange: (next: SortKey[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortBuilder({ sort, columns, onChange }: SortBuilderProps) {
  // Sortable columns — those with a compare function (all real columns should have one)
  const sortableColumns = columns.filter((col) => {
    try {
      const def = getCellDef(col.type as import("@/lib/cells/types").CellTypeId);
      return typeof def.compare === "function";
    } catch {
      return false;
    }
  });

  // Scoped DndContext so it doesn't collide with the board's DndContext
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sort.findIndex((k) => k.columnId === String(active.id));
      const newIndex = sort.findIndex((k) => k.columnId === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      onChange(arrayMove(sort, oldIndex, newIndex));
    },
    [sort, onChange],
  );

  const handleAddSort = useCallback(() => {
    // Pick the first column not already in sort
    const usedIds = new Set(sort.map((k) => k.columnId));
    const nextCol = sortableColumns.find((c) => !usedIds.has(c.id));
    if (!nextCol) return;
    onChange([...sort, { columnId: nextCol.id, direction: "asc" }]);
  }, [sort, sortableColumns, onChange]);

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleChangeColumn = useCallback(
    (index: number, columnId: string) => {
      const next = sort.map((k, i) => (i === index ? { ...k, columnId } : k));
      onChange(next);
    },
    [sort, onChange],
  );

  const handleToggleDirection = useCallback(
    (index: number) => {
      const next = sort.map((k, i) =>
        i === index ? { ...k, direction: k.direction === "asc" ? "desc" : "asc" } : k,
      ) as SortKey[];
      onChange(next);
    },
    [sort, onChange],
  );

  const handleDelete = useCallback(
    (index: number) => {
      onChange(sort.filter((_, i) => i !== index));
    },
    [sort, onChange],
  );

  // IDs for SortableContext — use columnId as the unique id per sort key
  const sortIds = sort.map((k) => k.columnId);

  return (
    <div className="flex flex-col" style={{ minWidth: 320, maxWidth: 480 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[color:var(--color-border-strong)]">
        <span className="text-sm font-semibold text-[color:var(--color-fg)]">
          Sort
          {sort.length > 0 && (
            <span className="ml-1 text-xs text-[color:var(--color-fg-muted)]">({sort.length})</span>
          )}
        </span>
        {sort.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Empty state */}
      {sort.length === 0 && (
        <p className="px-3 py-3 text-sm text-[color:var(--color-fg-muted)]">
          No sort applied. Add one below.
        </p>
      )}

      {/* Sort rows with scoped DndContext */}
      {sort.length > 0 && (
        <div className="px-3 py-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {sort.map((sortKey, index) => (
                  <SortRow
                    key={sortKey.columnId}
                    id={sortKey.columnId}
                    sortKey={sortKey}
                    columns={sortableColumns}
                    onChangeColumn={(columnId) => handleChangeColumn(index, columnId)}
                    onToggleDirection={() => handleToggleDirection(index)}
                    onDelete={() => handleDelete(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add sort footer */}
      <div className="px-3 py-2 border-t border-[color:var(--color-border-strong)]">
        <button
          type="button"
          onClick={handleAddSort}
          disabled={sortableColumns.length === 0 || sort.length >= sortableColumns.length}
          className="flex items-center gap-1.5 text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} aria-hidden="true" />
          Add sort
        </button>
      </div>
    </div>
  );
}
