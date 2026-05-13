"use client";

/**
 * LineWidget — Recharts LineChart showing time-series task data.
 *
 * X-axis = date buckets (day / week / month).
 * Y-axis = aggregated value per date bucket or task count.
 *
 * Epic 12, Slice E — E.4.
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
import type { CellTypeId } from "@/lib/cells/types";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { FilterTree, WidgetConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { aggregateForWidget, extractColumnValues, timeSeriesBuckets } from "../widget-data";

type LineConfig = Extract<WidgetConfig, { kind: "line" }>;

interface LineWidgetProps {
  config: LineConfig;
  activeFilter?: FilterTree | undefined;
}

export function LineWidget({ config, activeFilter }: LineWidgetProps) {
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  const deferredTasks = useDeferredValue(tasks);

  const chartData = useMemo(() => {
    const filtered = applyFilterTree(deferredTasks, cells, columns, activeFilter);
    const buckets = timeSeriesBuckets(filtered, cells, config.dateColumnId, config.bucket);

    // Exclude the __no_date__ bucket from the chart line (it doesn't map to an X position).
    return buckets
      .filter((b) => b.dateKey !== "__no_date__")
      .map((bucket) => {
        let yValue: number | null;

        if (!config.yColumnId) {
          yValue = bucket.tasks.length;
        } else {
          const yColumn = columns.find((c) => c.id === config.yColumnId);
          if (!yColumn) {
            yValue = bucket.tasks.length;
          } else {
            const values = extractColumnValues(bucket.tasks, cells, columns, config.yColumnId);
            const agg = aggregateForWidget(
              values,
              config.yAggregation,
              yColumn.type as CellTypeId,
              yColumn.settings,
            );
            yValue = agg.numeric;
          }
        }

        return { date: bucket.dateKey, value: yValue ?? 0 };
      });
  }, [deferredTasks, cells, columns, activeFilter, config]);

  if (chartData.length === 0) {
    return (
      <div className="widget-body">
        <div className="widget-empty-state">No data</div>
      </div>
    );
  }

  return (
    <div className="widget-body" style={{ padding: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--color-fg-subtle)" }}
            axisLine={{ stroke: "var(--color-border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-fg-subtle)" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ fill: "var(--color-primary)", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
