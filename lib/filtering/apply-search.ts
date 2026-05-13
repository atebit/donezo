/**
 * apply-search — case-insensitive in-board search.
 *
 * Matches tasks by:
 *   1. task.title (case-insensitive substring).
 *   2. Any column's cell text representation via `def.toSearchString(value, config)`.
 *      Hidden columns ARE included (hidden is presentational only, not a privacy gate).
 *
 * No fuzzy matching in v1.
 * Returns the input array untouched when `query` is empty or undefined.
 */

import type { Cell, Column, Task } from "@/components/board/table/types";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";

/**
 * Returns the subset of `tasks` whose title or any cell text contains `query`
 * (case-insensitive substring match).
 *
 * Returns `tasks` unchanged when `query` is falsy.
 */
export function applySearch(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  query: string,
): Task[] {
  if (!query) return tasks;
  const q = query.toLowerCase();

  return tasks.filter((task) => {
    // 1. Title match.
    if (task.title.toLowerCase().includes(q)) return true;

    // 2. Cell match across all columns (including hidden ones).
    return columns.some((col) => {
      let def: ReturnType<typeof getCellDef>;
      try {
        def = getCellDef(col.type as CellTypeId);
      } catch {
        return false; // Unregistered type — skip.
      }
      const cell = cellsByKey.get(`${task.id}:${col.id}`);
      const value = def.fromRow(cell);
      const text = def.toSearchString(value, col.settings as never);
      return text.toLowerCase().includes(q);
    });
  });
}
