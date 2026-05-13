"use client";

/**
 * NumberWidget — displays a single aggregated value in large text.
 *
 * Reads tasks / cells / columns from the board store (with useShallow),
 * applies the view's active filter, then delegates aggregation to widget-data.ts.
 *
 * Visual contract:
 *   - 48px / weight 600 / --color-fg number value
 *   - Optional label below in 12px / --color-fg-subtle
 *
 * Epic 12, Slice E — E.4.
 */

import { useDeferredValue, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CellTypeId } from "@/lib/cells/types";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { FilterTree, WidgetConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { aggregateForWidget, extractColumnValues } from "../widget-data";

type NumberConfig = Extract<WidgetConfig, { kind: "number" }>;

interface NumberWidgetProps {
  config: NumberConfig;
  activeFilter?: FilterTree | undefined;
}

export function NumberWidget({ config, activeFilter }: NumberWidgetProps) {
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  // Defer over source list for dashboards with large task counts (Q19).
  const deferredTasks = useDeferredValue(tasks);

  const result = useMemo(() => {
    const filtered = applyFilterTree(deferredTasks, cells, columns, activeFilter);

    const column = columns.find((c) => c.id === config.columnId);
    if (!column) return { display: "—", numeric: null };

    const values = extractColumnValues(filtered, cells, columns, config.columnId);
    return aggregateForWidget(
      values,
      config.aggregation,
      column.type as CellTypeId,
      column.settings,
    );
  }, [deferredTasks, cells, columns, activeFilter, config]);

  const label = config.label ?? "";
  const column = columns.find((c) => c.id === config.columnId);
  const defaultLabel = column
    ? `${config.aggregation.replace(/_/g, " ")} of ${column.name}`
    : config.aggregation;

  return (
    <div className="widget-body" style={{ flexDirection: "column", gap: 8 }}>
      <div className="number-widget-value">{result.display}</div>
      <div className="number-widget-label">{label || defaultLabel}</div>
    </div>
  );
}
