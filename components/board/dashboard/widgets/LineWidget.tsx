"use client";

/**
 * LineWidget — Recharts LineChart for time-series data.
 *
 * X axis: date buckets (day / week / month)
 * Y axis: task count or aggregated value from yColumnId
 *
 * Single series only (multi-series deferred per spec).
 */

import { useDeferredValue, useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useShallow } from "zustand/react/shallow";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { AggregationKind, ViewConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { computeTimeSeriesChartData, timeSeriesBuckets } from "../widget-data";

interface LineWidgetProps {
  dateColumnId: string;
  yAggregation: AggregationKind;
  yColumnId?: string;
  bucket: "day" | "week" | "month";
  filter?: ViewConfig["filter"];
}

export function LineWidget({
  dateColumnId,
  yAggregation,
  yColumnId,
  bucket,
  filter,
}: LineWidgetProps) {
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  const filteredTasks = useMemo(
    () => applyFilterTree(tasks, cells, columns, filter),
    [tasks, cells, columns, filter],
  );
  const deferredTasks = useDeferredValue(filteredTasks);

  const chartData = useMemo(() => {
    const timeBuckets = timeSeriesBuckets(deferredTasks, cells, dateColumnId, bucket);
    return computeTimeSeriesChartData(timeBuckets, cells, columns, yColumnId, yAggregation);
  }, [deferredTasks, cells, dateColumnId, bucket, columns, yColumnId, yAggregation]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[color:var(--color-fg-muted)]">
        No data — tasks need a value in the selected date column.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-strong)" />
        <XAxis
          dataKey="date"
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
        <Line
          type="monotone"
          dataKey="y"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-primary)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
