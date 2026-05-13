"use client";

/**
 * TableWidget — a simple embedded table of tasks.
 *
 * Renders up to `config.limit` tasks (max 100) from the board's task list,
 * optionally filtered + sorted per the widget config.
 * No virtualization — limit is bounded by the schema.
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import { applySort } from "@/lib/filtering/apply-sort";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { FilterTree, SortKey, ViewConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

interface TableWidgetProps {
  filter?: FilterTree;
  sort?: SortKey[];
  limit: number;
  /** Active view filter from the dashboard view (applied on top of widget filter). */
  viewFilter?: ViewConfig["filter"];
}

export function TableWidget({ filter, sort, limit, viewFilter }: TableWidgetProps) {
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  const displayTasks = useMemo(() => {
    // Apply view filter first, then widget filter, then sort, then limit.
    let result = applyFilterTree(tasks, cells, columns, viewFilter);
    result = applyFilterTree(result, cells, columns, filter);
    result = applySort(result, cells, columns, sort);
    return result.slice(0, Math.min(limit, 100));
  }, [tasks, cells, columns, filter, sort, limit, viewFilter]);

  // Select up to 3 visible (non-title-equivalent) columns to show.
  const visibleColumns = useMemo(
    () =>
      columns
        .filter((c) => !["created_at_col", "updated_by", "created_by"].includes(c.type))
        .slice(0, 3),
    [columns],
  );

  if (displayTasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[color:var(--color-fg-muted)]">
        No tasks match the filter.
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1 px-2 font-medium text-[color:var(--color-fg-muted)] border-b border-[color:var(--color-border-strong)] sticky top-0 bg-[color:var(--color-surface)]">
              Title
            </th>
            {visibleColumns.map((col) => (
              <th
                key={col.id}
                className="text-left py-1 px-2 font-medium text-[color:var(--color-fg-muted)] border-b border-[color:var(--color-border-strong)] sticky top-0 bg-[color:var(--color-surface)]"
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayTasks.map((task) => (
            <tr
              key={task.id}
              className="hover:bg-[color:var(--color-surface-hover)] transition-colors"
            >
              <td className="py-1 px-2 text-[color:var(--color-fg)] max-w-[200px] truncate">
                {task.title || <span className="text-[color:var(--color-fg-muted)]">Untitled</span>}
              </td>
              {visibleColumns.map((col) => {
                const cell = cells.get(`${task.id}:${col.id}`);
                let cellText = "";
                try {
                  const def = getCellDef(col.type as CellTypeId);
                  const value = def.fromRow(cell ?? null);
                  cellText = def.toSearchString(value, col.settings);
                } catch {
                  cellText = "";
                }
                return (
                  <td
                    key={col.id}
                    className="py-1 px-2 text-[color:var(--color-fg-muted)] max-w-[140px] truncate"
                  >
                    {cellText || <span className="opacity-30">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
