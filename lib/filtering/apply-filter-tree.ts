/**
 * apply-filter-tree — pure recursive filter evaluation.
 *
 * Client-side only for v1; the pure-function shape means a future server-side
 * SQL translator could reuse the same predicates.
 */

import type { Cell, Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { FilterTree } from "@/lib/views/config-schema";

/**
 * Returns the subset of tasks that satisfy the FilterTree.
 *
 * - `and` nodes require ALL clauses to be true.
 * - `or` nodes require ANY clause to be true.
 * - `comparison` nodes resolve the cell for (task.id, columnId) and delegate
 *   to `def.matchesFilter`.
 * - If the columnId in a comparison is unknown (column deleted), the clause
 *   evaluates to `true` (silently ignore — conservative: don't hide rows).
 * - When `tree` is `undefined`, returns the input array untouched (passthrough).
 */
export function applyFilterTree(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  tree: FilterTree | undefined,
): Task[] {
  if (!tree) return tasks;
  return tasks.filter((task) => evalNode(task, cellsByKey, columns, tree));
}

function evalNode(
  task: Task,
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  node: FilterTree,
): boolean {
  switch (node.kind) {
    case "and":
      return node.clauses.every((clause) => evalNode(task, cellsByKey, columns, clause));
    case "or":
      return node.clauses.some((clause) => evalNode(task, cellsByKey, columns, clause));
    case "comparison": {
      const { columnId, operator, operand } = node.comparison;
      const column = columns.find((c) => c.id === columnId);
      // Unknown column (e.g. deleted) — treat as true (conservative pass-through).
      if (!column) return true;
      let def: ReturnType<typeof getCellDef>;
      try {
        def = getCellDef(column.type as CellTypeId);
      } catch {
        // Unregistered type — conservative pass-through.
        return true;
      }
      const cell = cellsByKey.get(`${task.id}:${columnId}`);
      const value = def.fromRow(cell);
      return def.matchesFilter(value, operator, operand);
    }
  }
}
