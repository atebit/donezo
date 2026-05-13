/**
 * apply-sort — multi-key stable sort over tasks.
 *
 * Sort + DnD interaction contract (Epic 11, cross-slice):
 *   When `sortKeys.length > 0`, DnD reorder of tasks is DISABLED in BoardTable
 *   (drag handle hidden, draggable=false). This function owns the sorted output;
 *   Slice D's drag-handle render must also gate on `sortKeys.length > 0`.
 *
 * TODO(slice-D): gate DragHandle render on `sortKeys.length === 0` before
 * exposing the drag affordance to users.
 *
 * Falls back to original order when `sortKeys` is empty or undefined — the
 * caller is responsible for passing tasks in their intended natural order
 * (group.position then task.position).
 */

import type { Cell, Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { SortKey } from "@/lib/views/config-schema";

/**
 * Returns a stably-sorted copy of `tasks` according to `sortKeys`.
 *
 * - Multi-key: keys are applied in order; ties fall through to the next key.
 * - Unknown column ids (deleted columns) are silently skipped.
 * - Empty / undefined `sortKeys` returns `[...tasks]` unchanged.
 */
export function applySort(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  sortKeys: SortKey[] | undefined,
): Task[] {
  if (!sortKeys || sortKeys.length === 0) return [...tasks];

  // Build a resolved key list (skip unknown column ids).
  type ResolvedKey = {
    column: Column;
    def: ReturnType<typeof getCellDef>;
    direction: "asc" | "desc";
  };

  const resolved: ResolvedKey[] = [];
  for (const sk of sortKeys) {
    const column = columns.find((c) => c.id === sk.columnId);
    if (!column) continue; // unknown column — skip
    let def: ReturnType<typeof getCellDef>;
    try {
      def = getCellDef(column.type as CellTypeId);
    } catch {
      continue; // unregistered type — skip
    }
    resolved.push({ column, def, direction: sk.direction });
  }

  if (resolved.length === 0) return [...tasks];

  // Stable sort via index-based tie-breaking at the end.
  const indexed = tasks.map((task, i) => ({ task, i }));

  indexed.sort(({ task: a, i: ai }, { task: b, i: bi }) => {
    for (const { column, def, direction } of resolved) {
      const cellA = cellsByKey.get(`${a.id}:${column.id}`);
      const cellB = cellsByKey.get(`${b.id}:${column.id}`);
      const valA = def.fromRow(cellA);
      const valB = def.fromRow(cellB);
      const cmp = def.compare(valA, valB);
      if (cmp !== 0) {
        return direction === "asc" ? cmp : -cmp;
      }
    }
    // All keys tied — fall back to original index for stability.
    return ai - bi;
  });

  return indexed.map(({ task }) => task);
}
