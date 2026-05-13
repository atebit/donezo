"use client";

/**
 * SortRow — one sort key in the SortBuilder.
 *
 * Column dropdown + asc/desc toggle + delete button.
 * Rendered inside a @dnd-kit/sortable SortableContext for drag reordering.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import type { Database } from "@/lib/supabase/types";
import type { SortKey } from "@/lib/views/config-schema";

type Column = Database["public"]["Tables"]["column"]["Row"];

interface SortRowProps {
  sortKey: SortKey;
  /** Unique id for dnd-kit (typically the columnId). */
  id: string;
  columns: Column[];
  onChangeColumn: (columnId: string) => void;
  onToggleDirection: () => void;
  onDelete: () => void;
}

export function SortRow({
  sortKey,
  id,
  columns,
  onChangeColumn,
  onToggleDirection,
  onDelete,
}: SortRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { kind: "sort-key" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder sort key"
        className="flex items-center justify-center w-6 h-6 text-[color:var(--color-fg-muted)] cursor-grab active:cursor-grabbing hover:text-[color:var(--color-fg)] transition-colors shrink-0"
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>

      {/* Column selector */}
      <select
        value={sortKey.columnId}
        onChange={(e) => onChangeColumn(e.target.value)}
        aria-label="Sort column"
        className="flex-1 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors cursor-pointer"
      >
        {columns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
      </select>

      {/* Direction toggle */}
      <button
        type="button"
        onClick={onToggleDirection}
        aria-label={
          sortKey.direction === "asc"
            ? "Ascending — click to switch to descending"
            : "Descending — click to switch to ascending"
        }
        aria-pressed={sortKey.direction === "desc"}
        className="flex items-center gap-1 px-2 py-1 rounded border border-[color:var(--color-border-strong)] text-sm text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer shrink-0"
      >
        {sortKey.direction === "asc" ? (
          <>
            <ArrowUp size={12} aria-hidden="true" />
            <span>Asc</span>
          </>
        ) : (
          <>
            <ArrowDown size={12} aria-hidden="true" />
            <span>Desc</span>
          </>
        )}
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove sort key"
        className="flex items-center justify-center w-6 h-6 rounded text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer shrink-0"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
