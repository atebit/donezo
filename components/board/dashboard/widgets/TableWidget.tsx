"use client";

/**
 * TableWidget — a compact table of N tasks (bounded ≤ 100).
 *
 * Shows task title + 2-3 column values. Applies the widget's own filter +
 * sort (distinct from the view's active filter) via Epic-11 helpers.
 *
 * No virtualization — the row limit is bounded by config.limit (max 100).
 *
 * Epic 12, Slice E — E.4.
 */

import { useDeferredValue, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import { applySort } from "@/lib/filtering/apply-sort";
import type { FilterTree, WidgetConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

type TableConfig = Extract<WidgetConfig, { kind: "table" }>;

interface TableWidgetProps {
  config: TableConfig;
  /** The view's active filter. The widget also applies its own config.filter. */
  activeFilter?: FilterTree | undefined;
}

export function TableWidget({ config, activeFilter }: TableWidgetProps) {
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  const deferredTasks = useDeferredValue(tasks);

  // The first 3 non-system columns used for preview cells.
  const previewColumns = useMemo(() => {
    return columns
      .filter((c) => !["created_at_col", "created_by", "updated_by"].includes(c.type))
      .slice(0, 3);
  }, [columns]);

  const visibleTasks = useMemo(() => {
    // Apply view's active filter first, then widget's own filter.
    const afterViewFilter = applyFilterTree(deferredTasks, cells, columns, activeFilter);
    const afterWidgetFilter = applyFilterTree(afterViewFilter, cells, columns, config.filter);
    const sorted = applySort(afterWidgetFilter, cells, columns, config.sort);
    return sorted.slice(0, Math.min(config.limit, 100));
  }, [deferredTasks, cells, columns, activeFilter, config]);

  if (visibleTasks.length === 0) {
    return (
      <div className="widget-body">
        <div className="widget-empty-state">No tasks</div>
      </div>
    );
  }

  return (
    <div className="widget-body table-widget" style={{ padding: 0, alignItems: "flex-start" }}>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            {previewColumns.map((col) => (
              <th key={col.id}>{col.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((task) => (
            <tr key={task.id}>
              <td
                style={{
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.title || "(Untitled)"}
              </td>
              {previewColumns.map((col) => {
                const cell = cells.get(`${task.id}:${col.id}`);
                let displayValue = "";
                try {
                  const def = getCellDef(col.type as CellTypeId);
                  const value = def.fromRow(cell);
                  displayValue = def.toSearchString(value, col.settings ?? def.defaultConfig);
                } catch {
                  displayValue = "";
                }
                return (
                  <td
                    key={col.id}
                    style={{
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayValue || "—"}
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
