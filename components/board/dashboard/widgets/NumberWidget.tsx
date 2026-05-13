"use client";

/**
 * NumberWidget — renders a single aggregated value in large type.
 *
 * Visual contract (must-match per component-system Visual fidelity — Dashboard):
 *   - Font: 48px / weight 600 / var(--color-fg)
 *   - Label: smaller muted text below the number
 *
 * Aggregation: calls def.aggregate(values, config.aggregation, columnConfig)
 * and renders the returned string verbatim (Slice E §E.4 spec).
 */

import { useDeferredValue, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { ViewConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

interface NumberWidgetProps {
  columnId: string;
  aggregation: string;
  label?: string;
  /** Active view filter to apply before aggregating. */
  filter?: ViewConfig["filter"];
}

export function NumberWidget({ columnId, aggregation, label, filter }: NumberWidgetProps) {
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  // Apply filter to narrow the task set (live updates through the store).
  const filteredTasks = useMemo(
    () => applyFilterTree(tasks, cells, columns, filter),
    [tasks, cells, columns, filter],
  );

  // useDeferredValue: softens recompute cost for dashboards with > 1000 tasks.
  const deferredTasks = useDeferredValue(filteredTasks);

  const displayValue = useMemo(() => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return "—";

    let def: ReturnType<typeof getCellDef>;
    try {
      def = getCellDef(column.type as CellTypeId);
    } catch {
      return "—";
    }

    // Extract typed values for each task.
    const values = deferredTasks.map((task) => {
      const cell = cells.get(`${task.id}:${columnId}`);
      return def.fromRow(cell ?? null);
    });

    try {
      // biome-ignore lint/suspicious/noExplicitAny: heterogeneous value array from cell registry
      return def.aggregate(values as any[], aggregation as CellTypeId, column.settings);
    } catch {
      return "—";
    }
  }, [deferredTasks, cells, columns, columnId, aggregation]);

  const column = columns.find((c) => c.id === columnId);
  const widgetLabel = label ?? (column ? `${column.name}` : "");

  return (
    <div className="flex flex-col justify-center h-full">
      <div className="number-widget-value">{displayValue}</div>
      {widgetLabel && <div className="number-widget-label">{widgetLabel}</div>}
    </div>
  );
}
