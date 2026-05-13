/**
 * widget-data.ts — Pure helper functions for dashboard widget data computation.
 *
 * All functions are pure (no React, no Supabase, no side effects).
 * They take tasks + cells + columns and produce the data shapes each widget
 * needs for rendering.
 *
 * Spec reference: Slice E §E.6
 */

import { getCellDef } from "@/lib/cells/registry";
import type { AggregationKind, CellTypeId } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";

type Task = Database["public"]["Tables"]["task"]["Row"];
type Cell = Database["public"]["Tables"]["cell"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];
type Label = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// Bucket helpers
// ---------------------------------------------------------------------------

/** A bucket groups tasks under a single label key. */
export type ValueBucket = {
  bucketKey: string;
  bucketLabel: string;
  tasks: Task[];
  /** Hex color from the cell type's label, if any. */
  color?: string;
};

/**
 * Group tasks into buckets based on the value in a specific column.
 *
 * Bucketing strategy per cell type:
 *   - status / priority: one bucket per label (uses label.id as key; label.name as label)
 *   - checkbox:          "Checked" / "Unchecked" buckets
 *   - person:            one bucket per user_id present in any cell
 *   - text / long_text:  each distinct string value is a bucket (≤ 50 unique values)
 *   - number / currency / rating / vote: numeric bucket (string of the number)
 *   - everything else:   toSearchString output as the bucket key
 *
 * Tasks with an empty/null cell land in an "__empty__" bucket labelled "Empty".
 */
export function bucketValuesByColumn(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  labelsByColumn: Map<string, Label[]>,
  bucketColumnId: string,
): ValueBucket[] {
  const column = columns.find((c) => c.id === bucketColumnId);
  if (!column) return [{ bucketKey: "__all__", bucketLabel: "All", tasks }];

  let def: ReturnType<typeof getCellDef>;
  try {
    def = getCellDef(column.type as CellTypeId);
  } catch {
    return [{ bucketKey: "__all__", bucketLabel: "All", tasks }];
  }

  // Pre-build bucket map: ordered insertion keeps buckets in definition order.
  const bucketMap = new Map<string, ValueBucket>();

  // For status/priority: pre-populate buckets in label order so empty ones still appear.
  const isLabelType = column.type === "status" || column.type === "priority";
  if (isLabelType) {
    const labels = labelsByColumn.get(bucketColumnId) ?? [];
    for (const lbl of labels) {
      bucketMap.set(lbl.id, {
        bucketKey: lbl.id,
        bucketLabel: lbl.name,
        tasks: [],
        color: lbl.color ?? undefined,
      });
    }
  }

  // Assign tasks to buckets.
  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${bucketColumnId}`);
    const value = def.fromRow(cell ?? null);

    // Determine bucket key.
    let key: string;
    let label: string;
    let color: string | undefined;

    if (value == null) {
      key = "__empty__";
      label = "Empty";
    } else if (isLabelType) {
      // value shape: { labelId: string }
      const labelId = (value as { labelId?: string })?.labelId;
      if (!labelId) {
        key = "__empty__";
        label = "Empty";
      } else {
        const lbl = (labelsByColumn.get(bucketColumnId) ?? []).find((l) => l.id === labelId);
        key = labelId;
        label = lbl?.name ?? labelId;
        color = lbl?.color ?? undefined;
      }
    } else if (column.type === "checkbox") {
      key = value === true ? "checked" : "unchecked";
      label = value === true ? "Checked" : "Unchecked";
    } else if (column.type === "person") {
      // value shape: { userIds: string[] }
      const userIds = (value as { userIds?: string[] })?.userIds ?? [];
      if (userIds.length === 0) {
        key = "__empty__";
        label = "Empty";
      } else {
        // A task can appear in multiple person buckets.
        for (const uid of userIds) {
          if (!bucketMap.has(uid)) {
            bucketMap.set(uid, { bucketKey: uid, bucketLabel: uid, tasks: [] });
          }
          bucketMap.get(uid)!.tasks.push(task);
        }
        continue; // Skip the default append below.
      }
    } else {
      key = def.toSearchString(value, column.settings);
      if (!key) {
        key = "__empty__";
        label = "Empty";
      } else {
        label = key;
      }
    }

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { bucketKey: key, bucketLabel: label, tasks: [], color });
    }
    bucketMap.get(key)!.tasks.push(task);
  }

  // Move the __empty__ bucket to the end for cleaner charts.
  const emptyBucket = bucketMap.get("__empty__");
  if (emptyBucket) {
    bucketMap.delete("__empty__");
    bucketMap.set("__empty__", emptyBucket);
  }

  return Array.from(bucketMap.values());
}

// ---------------------------------------------------------------------------
// Time-series bucketing
// ---------------------------------------------------------------------------

export type TimeBucket = {
  dateKey: string; // ISO string — start of the bucket period
  tasks: Task[];
};

/**
 * Bucket tasks by the value of a date or timeline column.
 *
 * - `day`  — one bucket per calendar day (YYYY-MM-DD)
 * - `week` — one bucket per ISO week (YYYY-[W]WW, anchored to Monday)
 * - `month`— one bucket per month (YYYY-MM)
 *
 * Tasks without a date value are excluded (callers handle "no date" tasks separately).
 * Buckets are sorted chronologically.
 */
export function timeSeriesBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  dateColumnId: string,
  bucket: "day" | "week" | "month",
): TimeBucket[] {
  const bucketMap = new Map<string, Task[]>();

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${dateColumnId}`);
    if (!cell) continue;

    // Prefer date_value; fall back to json_value for timeline cells.
    let rawDate: string | null = null;
    if (cell.date_value) {
      rawDate = cell.date_value;
    } else if (cell.json_value && typeof (cell.json_value as Record<string, unknown>)?.start === "string") {
      rawDate = (cell.json_value as Record<string, unknown>).start as string;
    }
    if (!rawDate) continue;

    const dateKey = dateToBucketKey(rawDate, bucket);
    if (!bucketMap.has(dateKey)) {
      bucketMap.set(dateKey, []);
    }
    bucketMap.get(dateKey)!.push(task);
  }

  // Sort chronologically.
  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, tasks]) => ({ dateKey, tasks }));
}

/** Convert an ISO date string to the appropriate bucket key. */
function dateToBucketKey(isoDate: string, bucket: "day" | "week" | "month"): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "invalid";

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  if (bucket === "day") {
    return `${year}-${month}-${day}`;
  }
  if (bucket === "month") {
    return `${year}-${month}`;
  }
  // week — ISO week (Monday anchor)
  return isoWeekKey(d);
}

/** Return the ISO week key YYYY-WWW (e.g. "2026-W20") for a date. */
function isoWeekKey(date: Date): string {
  // Copy the date to avoid mutating.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // (making Sunday = 7).
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Aggregation for widget display
// ---------------------------------------------------------------------------

/**
 * Aggregate a set of cell values for a specific column and aggregation kind.
 *
 * Returns both a display-ready string (via `def.aggregate`) and a raw numeric
 * value for chart widgets that need numbers (null when aggregation is non-numeric).
 *
 * Callers:
 *   - NumberWidget: uses `display`.
 *   - BarWidget / LineWidget: use `numeric` for chart Y values; `display` as tooltip.
 *   - PieWidget: uses task counts per bucket (not this function).
 */
export function aggregateForWidget(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
  kind: AggregationKind,
): { display: string; numeric: number | null } {
  let def: ReturnType<typeof getCellDef>;
  try {
    def = getCellDef(column.type as CellTypeId);
  } catch {
    return { display: "—", numeric: null };
  }

  // Extract typed values from each task's cell.
  const values: unknown[] = tasks.map((task) => {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    return def.fromRow(cell ?? null);
  });

  // Use def.aggregate for the display string (already handles units, formatting, etc.)
  let display: string;
  try {
    // biome-ignore lint/suspicious/noExplicitAny: heterogeneous value array
    display = def.aggregate(values as any[], kind, column.settings);
  } catch {
    display = "—";
  }

  // For chart widgets: derive a raw number from the display string when possible.
  // aggregations that produce raw numbers: count, count_empty, count_unique, sum, avg, min, max, median
  const numericKinds = new Set<AggregationKind>([
    "count",
    "count_empty",
    "count_unique",
    "sum",
    "avg",
    "min",
    "max",
    "median",
  ]);
  let numeric: number | null = null;
  if (numericKinds.has(kind)) {
    const parsed = parseFloat(display.replace(/[^0-9.\-]/g, ""));
    if (!Number.isNaN(parsed)) numeric = parsed;
  }

  return { display, numeric };
}

/**
 * Given a set of value buckets and a Y aggregation, compute the numeric Y value
 * per bucket for bar / line charts.
 *
 * If `yColumnId` is provided, the Y value is aggregated from that column.
 * If `yColumnId` is absent, the Y value is the task count per bucket.
 */
export function computeChartData(
  buckets: ValueBucket[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  yColumnId: string | undefined,
  yAggregation: AggregationKind,
): { x: string; y: number; color?: string }[] {
  const yColumn = yColumnId ? columns.find((c) => c.id === yColumnId) : null;

  return buckets.map((bucket) => {
    let y: number;
    if (!yColumn) {
      // Default: count tasks in bucket.
      y = bucket.tasks.length;
    } else {
      const { numeric } = aggregateForWidget(bucket.tasks, cellsByKey, yColumn, yAggregation);
      y = numeric ?? 0;
    }
    return { x: bucket.bucketLabel, y, color: bucket.color };
  });
}

/**
 * Build chart data for a time-series LineWidget.
 * Y values are either task counts or aggregated per `yColumnId`.
 */
export function computeTimeSeriesChartData(
  timeBuckets: TimeBucket[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  yColumnId: string | undefined,
  yAggregation: AggregationKind,
): { date: string; y: number }[] {
  const yColumn = yColumnId ? columns.find((c) => c.id === yColumnId) : null;

  return timeBuckets.map((bucket) => {
    let y: number;
    if (!yColumn) {
      y = bucket.tasks.length;
    } else {
      const { numeric } = aggregateForWidget(bucket.tasks, cellsByKey, yColumn, yAggregation);
      y = numeric ?? 0;
    }
    return { date: bucket.dateKey, y };
  });
}
