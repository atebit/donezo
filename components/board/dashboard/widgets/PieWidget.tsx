"use client";

/**
 * PieWidget — Recharts PieChart showing task distribution across a column's values.
 *
 * Slice colors come from the cell registry's color palette (status/priority labels)
 * or neutral fallbacks for other column types.
 */

import { useDeferredValue, useMemo } from "react";
import { Cell as RechartsCell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useShallow } from "zustand/react/shallow";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { AggregationKind, ViewConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { bucketValuesByColumn } from "../widget-data";

// Fallback neutral colors when no palette is available.
const NEUTRAL_PALETTE = [
  "var(--color-primary)",
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f87171",
  "#a78bfa",
  "#fb7185",
  "#38bdf8",
];

interface PieWidgetProps {
  columnId: string;
  aggregation: AggregationKind;
  filter?: ViewConfig["filter"];
}

export function PieWidget({ columnId, filter }: PieWidgetProps) {
  const { tasks, cells, columns, labelsByColumn } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
      labelsByColumn: s.labelsByColumn,
    })),
  );

  const filteredTasks = useMemo(
    () => applyFilterTree(tasks, cells, columns, filter),
    [tasks, cells, columns, filter],
  );
  const deferredTasks = useDeferredValue(filteredTasks);

  const pieData = useMemo(() => {
    const buckets = bucketValuesByColumn(
      deferredTasks,
      cells,
      columns,
      labelsByColumn,
      columnId,
    );
    return buckets
      .filter((b) => b.tasks.length > 0)
      .map((b, i) => ({
        name: b.bucketLabel,
        value: b.tasks.length,
        fill: b.color ?? NEUTRAL_PALETTE[i % NEUTRAL_PALETTE.length],
      }));
  }, [deferredTasks, cells, columns, labelsByColumn, columnId]);

  if (pieData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[color:var(--color-fg-muted)]">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          label={({ name, percent }) =>
            `${name} (${Math.round(percent * 100)}%)`
          }
          labelLine={false}
        >
          {pieData.map((entry, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: index is the stable key here
            <RechartsCell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "var(--color-fg-muted)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
