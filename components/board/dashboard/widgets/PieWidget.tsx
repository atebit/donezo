"use client";

/**
 * PieWidget — Recharts PieChart showing proportion by column bucket.
 *
 * Slice colors come from label color palette (status/priority) or
 * a neutral fallback cycle for other column types.
 *
 * Epic 12, Slice E — E.4.
 */

import { useDeferredValue, useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useShallow } from "zustand/react/shallow";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { FilterTree, WidgetConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { bucketValuesByColumn } from "../widget-data";

type PieConfig = Extract<WidgetConfig, { kind: "pie" }>;

// Neutral fallback color cycle for non-label columns.
const FALLBACK_COLORS = [
  "#5c6bc0",
  "#26a69a",
  "#ef5350",
  "#ffa726",
  "#66bb6a",
  "#ab47bc",
  "#29b6f6",
  "#ff7043",
];

interface PieWidgetProps {
  config: PieConfig;
  activeFilter?: FilterTree | undefined;
}

export function PieWidget({ config, activeFilter }: PieWidgetProps) {
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
    const buckets = bucketValuesByColumn(filtered, cells, columns, labelsByColumn, config.columnId);

    return buckets.map((bucket, idx) => ({
      name: bucket.bucketLabel,
      value: bucket.tasks.length,
      fill: bucket.bucketColor ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length] ?? "#5c6bc0",
    }));
  }, [deferredTasks, cells, columns, labelsByColumn, activeFilter, config]);

  const totalTasks = chartData.reduce((s, d) => s + d.value, 0);

  if (totalTasks === 0) {
    return (
      <div className="widget-body">
        <div className="widget-empty-state">No data</div>
      </div>
    );
  }

  return (
    <div className="widget-body" style={{ padding: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="65%"
            strokeWidth={2}
            stroke="var(--color-bg-elevated)"
          >
            {chartData.map((entry, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: recharts cell key
              <Cell key={index} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "var(--color-fg-subtle)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
