"use client";

/**
 * ColumnVisibilityPanel — popover content for the "Hide" button.
 *
 * Features:
 *   - Checklist of all columns with their current visibility.
 *   - The title column (type === "text" and first position, or explicitly marked)
 *     is locked visible and immovable (rendered first, checkbox disabled).
 *   - dnd-kit reorderable: dragging a column row emits an updated `columnOrder`.
 *   - Emits `columnVisibility` changes immediately on checkbox toggle.
 *   - Own scoped DndContext so it doesn't collide with the board-level DndContext.
 *
 * Prop-driven: does NOT call useBoardStore / useBoardView. The ViewToolbar
 * (Slice D) reads the store and passes columns + current visibility down.
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { Database } from "@/lib/supabase/types";

type Column = Database["public"]["Tables"]["column"]["Row"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColumnVisibilityPanelProps {
  /** All columns for this board, in their current display order. */
  columns: Column[];
  /** columnId → visible flag. Missing key = visible (default). */
  columnVisibility: Record<string, boolean>;
  /** Optional column order override (list of columnIds). Defaults to column.position order. */
  columnOrder?: string[];
  /** Called when a column's visibility is toggled. */
  onVisibilityChange: (next: Record<string, boolean>) => void;
  /** Called when columns are reordered via drag. Emits full ordered columnId array. */
  onOrderChange: (next: string[]) => void;
}

// ---------------------------------------------------------------------------
// SortableColumnRow — individual row (checkable + draggable)
// ---------------------------------------------------------------------------

interface SortableColumnRowProps {
  column: Column;
  isVisible: boolean;
  isLocked: boolean;
  onToggle: () => void;
}

function SortableColumnRow({ column, isVisible, isLocked, onToggle }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: isLocked,
    data: { kind: "column-visibility" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-1.5 hover:bg-[color:var(--color-surface-hover)] rounded-[var(--radius-xs)] group"
    >
      {/* Drag handle (hidden for locked columns) */}
      {isLocked ? (
        <span className="w-5 h-5 shrink-0" aria-hidden="true" />
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${column.name}`}
          className="flex items-center justify-center w-5 h-5 text-[color:var(--color-fg-muted)] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity shrink-0"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        id={`col-vis-${column.id}`}
        data-testid={`col-visibility-${column.id}`}
        checked={isVisible}
        disabled={isLocked}
        onChange={onToggle}
        className="w-4 h-4 rounded border-[color:var(--color-border-strong)] accent-[color:var(--color-primary)] cursor-pointer disabled:cursor-not-allowed shrink-0"
        aria-label={`${isVisible ? "Hide" : "Show"} ${column.name} column`}
      />

      {/* Column name */}
      <label
        htmlFor={`col-vis-${column.id}`}
        className="flex-1 text-sm text-[color:var(--color-fg)] cursor-pointer truncate select-none"
        style={isLocked ? { fontWeight: 500 } : undefined}
      >
        {column.name}
        {isLocked && (
          <span className="ml-1 text-xs text-[color:var(--color-fg-muted)]">(locked)</span>
        )}
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ColumnVisibilityPanel({
  columns,
  columnVisibility,
  columnOrder,
  onVisibilityChange,
  onOrderChange,
}: ColumnVisibilityPanelProps) {
  // Derive the display order of columns
  const orderedColumns = useMemo(() => {
    if (columnOrder && columnOrder.length > 0) {
      const colMap = new Map(columns.map((c) => [c.id, c]));
      const ordered = columnOrder
        .map((id) => colMap.get(id))
        .filter((c): c is Column => c !== undefined);
      // Append any columns not in columnOrder (e.g. newly added)
      const orderedSet = new Set(columnOrder);
      const rest = columns.filter((c) => !orderedSet.has(c.id));
      return [...ordered, ...rest];
    }
    return [...columns].sort((a, b) => a.position - b.position);
  }, [columns, columnOrder]);

  // The title column is the first column sorted by position (locked visible)
  const titleColumnId = useMemo(() => {
    const sorted = [...columns].sort((a, b) => a.position - b.position);
    return sorted[0]?.id ?? null;
  }, [columns]);

  // Scoped sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const ids = orderedColumns.map((c) => c.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      // Don't allow reordering the title column
      if (ids[oldIndex] === titleColumnId || ids[newIndex] === titleColumnId) return;
      onOrderChange(arrayMove(ids, oldIndex, newIndex));
    },
    [orderedColumns, titleColumnId, onOrderChange],
  );

  const handleToggle = useCallback(
    (columnId: string) => {
      const current = columnVisibility[columnId] !== false; // default: visible
      onVisibilityChange({ ...columnVisibility, [columnId]: !current });
    },
    [columnVisibility, onVisibilityChange],
  );

  const sortableIds = orderedColumns.map((c) => c.id);

  return (
    <div
      data-testid="column-visibility-panel"
      className="flex flex-col"
      style={{ minWidth: 240, maxWidth: 320 }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-[color:var(--color-border-strong)]">
        <span className="text-sm font-semibold text-[color:var(--color-fg)]">Columns</span>
      </div>

      {/* Column list with scoped DndContext */}
      <div className="py-1 max-h-80 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {orderedColumns.map((col) => {
              const isLocked = col.id === titleColumnId;
              const isVisible = columnVisibility[col.id] !== false;
              return (
                <SortableColumnRow
                  key={col.id}
                  column={col}
                  isVisible={isVisible}
                  isLocked={isLocked}
                  onToggle={() => handleToggle(col.id)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
