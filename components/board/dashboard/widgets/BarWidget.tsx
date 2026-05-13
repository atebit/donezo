"use client";

/**
 * BarWidget — Recharts BarChart grouped by a chosen column.
 *
 * X-axis = bucket labels from the chosen xColumnId column.
 * Y-axis = aggregated value per bucket (via yAggregation + optional yColumnId).
 *
 * When no yColumnId is set, uses "count" of tasks per bucket.
 *
 * Epic 12, Slice E — E.4.
 */

import { useDeferredValue, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { aggregateForWidget, bucketValuesByColumn, extractColumnValues } from "../widget-data";

type BarConfig = Extract<WidgetConfig, { kind: "bar" }>;

// Neutral fill cycle for bar charts.
const CHART_COLORS = [
  "var(--color-primary)",
  "#5c6bc0",
  "#26a69a",
  "#ef5350",
  "#ffa726",
  "#66bb6a",
  "#ab47bc",
  "#29b6f6",
];

interface BarWidgetProps {
  config: BarConfig;
  activeFilter?: FilterTree | undefined;
}

export function BarWidget({ config, activeFilter }: BarWidgetProps) {
  const { tasks, cells, columns, labelsByColumn } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
      labelsByColumn: s.labelsByColumn,
    })),
  );

  const deferredTasks = useDeferredValue(tasks);

  const chartData = useMemo(() => {
    const filtered = applyFilterTree(deferredTasks, cells, columns, activeFilter);
    const buckets = bucketValuesByColumn(
      filtered,
      cells,
      columns,
      labelsByColumn,
      config.xColumnId,
    );

    return buckets.map((bucket, idx) => {
      let yValue: number | null;

      if (!config.yColumnId) {
        // Count tasks per bucket.
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

      return {
        name: bucket.bucketLabel,
        value: yValue ?? 0,
        fill: bucket.bucketColor ?? CHART_COLORS[idx % CHART_COLORS.length] ?? "#5c6bc0",
      };
    });
  }, [deferredTasks, cells, columns, labelsByColumn, activeFilter, config]);

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
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="name"
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
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: recharts cell key
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
