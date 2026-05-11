"use client";

/**
 * ColumnReorder — wraps column headers in a dnd-kit horizontal SortableContext.
 *
 * This is a SEPARATE SortableContext from the group/task vertical lists managed
 * by DndProviders.tsx. Column drag lives inside the same outer DndContext
 * (provided by DndProviders), but gets its own horizontal strategy so the
 * displacement math is correct for the axis.
 *
 * Usage (S19/S20 compose this):
 *   <ColumnReorder columns={columns}>
 *     {columns.map((col) => <ColumnHeader key={col.id} column={col} />)}
 *   </ColumnReorder>
 *
 * Each ColumnHeader calls `useColumnSortable(col.id)` to get drag handle props.
 *
 * The drag-end handler for column reorder lives in BoardTable.tsx (S20), which
 * has full store access to call `reorderColumn({ columnId, position })` after
 * computing the new position via `positionBetween`.
 */

import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type { Column } from "@/components/board/table/types";

// ---------------------------------------------------------------------------
// ColumnReorder — SortableContext wrapper
// ---------------------------------------------------------------------------

export function ColumnReorder({ columns, children }: { columns: Column[]; children: ReactNode }) {
  return (
    <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

// ---------------------------------------------------------------------------
// useColumnSortable — per-header hook (composed into ColumnHeader by S19)
// ---------------------------------------------------------------------------

/**
 * Returns dnd-kit sortable props to spread on a column header element.
 *
 * `data.kind = "column"` is read by the DndProviders.tsx onDragEnd dispatcher
 * (S20 will add a `kind === "column"` branch there).
 */
export function useColumnSortable(columnId: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnId,
    data: { kind: "column" },
  });

  const style =
    transform !== null ? { transform: CSS.Transform.toString(transform), transition } : undefined;

  return { setNodeRef, attributes, listeners, style, isDragging };
}
