"use client";

/**
 * BarWidget — Recharts BarChart grouped by a column's values.
 *
 * Spec §E.4: BYPASS def.aggregate for chart widgets; use bucketValuesByColumn
 * + computeChartData to get raw numbers for the Y axis.
 */

import { useDeferredValue, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useShallow } from "zustand/react/shallow";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { AggregationKind, ViewConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { bucketValuesByColumn, computeChartData } from "../widget-data";

interface BarWidgetProps {
  xColumnId: string;
  yAggregation: AggregationKind;
  yColumnId?: string;
  filter?: ViewConfig["filter"];
}

const CHART_COLORS = [
  "var(--color-primary)",
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f87171",
  "#a78bfa",
];

export function BarWidget({ xColumnId, yAggregation, yColumnId, filter }: BarWidgetProps) {
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

  const chartData = useMemo(() => {
    const buckets = bucketValuesByColumn(
      deferredTasks,
      cells,
      columns,
      labelsByColumn,
      xColumnId,
    );
    return computeChartData(buckets, cells, columns, yColumnId, yAggregation);
  }, [deferredTasks, cells, columns, labelsByColumn, xColumnId, yColumnId, yAggregation]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[color:var(--color-fg-muted)]">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-strong)" />
        <XAxis
          dataKey="x"
          tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border-strong)" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Bar
          dataKey="y"
          fill="var(--color-primary)"
          radius={[3, 3, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
