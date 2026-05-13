/**
 * widget-data.ts — pure aggregation helpers for dashboard widgets.
 *
 * No React, no Supabase, no window references. All functions are deterministic
 * given the same inputs and can be freely unit-tested in Node environment.
 *
 * Epic 12, Slice E.
 */

import { getCellDef } from "@/lib/cells/registry";
import type { AggregationKind, CellTypeId } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";

type Task = Database["public"]["Tables"]["task"]["Row"];
type Cell = Database["public"]["Tables"]["cell"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];
type Label = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// bucketValuesByColumn
//
// Groups tasks into buckets based on the value of a single column per task.
// Returns a sorted-by-bucket-key array (stable ordering).
//
// Supports:
//   - status / priority cells: label-based bucketing (one bucket per label +
//     one "None" bucket for empty cells).
//   - person cells: user_id bucketing (json_value.userIds[] or first userId).
//   - text / long_text: verbatim text bucketing.
//   - number / currency / rating: string-coerced numeric bucketing.
//   - checkbox: "true" / "false" / "None" buckets.
//   - All other types: text fallback via fromRow → toString.
// ---------------------------------------------------------------------------

export type BucketedGroup = {
  bucketKey: string;
  bucketLabel: string;
  /** Color from the label table (status/priority only); otherwise undefined. */
  bucketColor?: string | undefined;
  tasks: Task[];
};

export function bucketValuesByColumn(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  labelsByColumn: Map<string, Label[]>,
  bucketColumnId: string,
): BucketedGroup[] {
  const column = columns.find((c) => c.id === bucketColumnId);
  if (!column) return [{ bucketKey: "none", bucketLabel: "None", tasks }];

  const columnType = column.type as CellTypeId;
  const labels = labelsByColumn.get(bucketColumnId) ?? [];

  let getDef: ReturnType<typeof getCellDef> | null = null;
  try {
    getDef = getCellDef(columnType);
  } catch {
    // Unregistered type — fall through to text fallback.
  }

  const buckets = new Map<string, BucketedGroup>();

  const getOrCreate = (key: string, label: string, color?: string | undefined): BucketedGroup => {
    if (!buckets.has(key)) {
      const entry: BucketedGroup = { bucketKey: key, bucketLabel: label, tasks: [] };
      if (color !== undefined) entry.bucketColor = color;
      buckets.set(key, entry);
    }
    // biome-ignore lint/style/noNonNullAssertion: key was just set in the if-branch above
    return buckets.get(key)!;
  };

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${bucketColumnId}`);

    if (columnType === "status" || columnType === "priority") {
      const labelId = cell?.label_id ?? null;
      if (!labelId) {
        getOrCreate("__none__", "None").tasks.push(task);
      } else {
        const lbl = labels.find((l) => l.id === labelId);
        getOrCreate(labelId, lbl?.name ?? labelId, lbl?.color).tasks.push(task);
      }
    } else if (columnType === "person") {
      // person value is stored as json_value = { userIds: string[] }
      const raw = cell?.json_value as { userIds?: string[] } | null;
      const userIds = raw?.userIds ?? [];
      if (userIds.length === 0) {
        getOrCreate("__none__", "None").tasks.push(task);
      } else {
        // Each task may belong to multiple person buckets (one per assignee).
        for (const uid of userIds) {
          getOrCreate(uid, uid).tasks.push(task);
        }
      }
    } else if (columnType === "checkbox") {
      const boolVal = cell?.boolean_value;
      if (boolVal === true) {
        getOrCreate("true", "Checked").tasks.push(task);
      } else if (boolVal === false) {
        getOrCreate("false", "Unchecked").tasks.push(task);
      } else {
        getOrCreate("__none__", "None").tasks.push(task);
      }
    } else if (getDef) {
      // Generic: convert the value to a searchable string for the bucket key.
      const value = getDef.fromRow(cell);
      if (value == null || value === "") {
        getOrCreate("__none__", "None").tasks.push(task);
      } else {
        const key = String(value);
        getOrCreate(key, key).tasks.push(task);
      }
    } else {
      getOrCreate("__none__", "None").tasks.push(task);
    }
  }

  // Sort: explicit label positions first (by labels array order), then alphabetically.
  const labelOrder = new Map(labels.map((l, i) => [l.id, i]));
  return Array.from(buckets.values()).sort((a, b) => {
    const ai = labelOrder.get(a.bucketKey) ?? Number.MAX_SAFE_INTEGER;
    const bi = labelOrder.get(b.bucketKey) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    if (a.bucketKey === "__none__") return 1;
    if (b.bucketKey === "__none__") return -1;
    return a.bucketLabel.localeCompare(b.bucketLabel);
  });
}

// ---------------------------------------------------------------------------
// timeSeriesBuckets
//
// Groups tasks by the date value in a date/timeline column, binned into
// day / week / month buckets.  Returns an array sorted by dateKey ascending.
//
// For timeline columns: uses cell.date_value (start date).
// For date columns: uses cell.date_value.
// Tasks with no date land in a separate "__no_date__" bucket which is appended
// at the end (after sorting by dateKey).
// ---------------------------------------------------------------------------

export type DateBucket = "day" | "week" | "month";

export type TimeSeriesEntry = {
  /** ISO date string: YYYY-MM-DD (day), YYYY-W## (week), YYYY-MM (month). */
  dateKey: string;
  tasks: Task[];
};

export function timeSeriesBuckets(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  dateColumnId: string,
  bucket: DateBucket,
): TimeSeriesEntry[] {
  const bins = new Map<string, Task[]>();
  const noDate: Task[] = [];

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${dateColumnId}`);
    const raw = cell?.date_value ?? null;
    if (!raw) {
      noDate.push(task);
      continue;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      noDate.push(task);
      continue;
    }
    const key = dateToKey(date, bucket);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key)?.push(task);
  }

  const sorted = Array.from(bins.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, ts]) => ({ dateKey, tasks: ts }));

  if (noDate.length > 0) {
    sorted.push({ dateKey: "__no_date__", tasks: noDate });
  }

  return sorted;
}

/** Convert a Date to a bucket key string. */
function dateToKey(date: Date, bucket: DateBucket): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  if (bucket === "day") {
    return `${y}-${m}-${d}`;
  }
  if (bucket === "month") {
    return `${y}-${m}`;
  }
  // week: ISO week — YYYY-W##
  const week = getISOWeek(date);
  return `${y}-W${String(week).padStart(2, "0")}`;
}

/** Compute the ISO week number (1-53) for a given UTC date. */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to Thursday of the week (ISO week number belongs to the year of its Thursday).
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// aggregateForWidget
//
// Computes an aggregation over an array of raw cell values for a single column.
// Falls back gracefully when:
//   - The cell registry doesn't know the type (returns { display: "—", numeric: null }).
//   - The aggregation kind is not supported by the type (ditto).
//
// Returns both a display string (ready to render) and a nullable numeric value
// (used for Y-axis in chart widgets).
// ---------------------------------------------------------------------------

export type AggregateResult = {
  display: string;
  numeric: number | null;
};

export function aggregateForWidget(
  values: unknown[],
  kind: AggregationKind,
  columnType: CellTypeId,
  columnConfig: unknown,
): AggregateResult {
  let def: ReturnType<typeof getCellDef> | null = null;
  try {
    def = getCellDef(columnType);
    // The registry uses a Proxy sentinel for unimplemented types. Probe
    // the `aggregations` property to trigger an early throw if sentinel.
    void def.aggregations;
  } catch {
    return { display: "—", numeric: null };
  }

  let supported: boolean;
  try {
    supported = def.aggregations.includes(kind);
  } catch {
    return { display: "—", numeric: null };
  }

  if (!supported) {
    // Unsupported aggregation for this type.
    return { display: "—", numeric: null };
  }

  let display: string;
  try {
    // biome-ignore lint/suspicious/noExplicitAny: def.aggregate is generic over TValue
    display = def.aggregate(values as any[], kind, columnConfig ?? def.defaultConfig);
  } catch {
    return { display: "—", numeric: null };
  }

  // Attempt to parse a numeric value from the display string for chart Y-axis.
  const numeric = parseFloat(display.replace(/[^0-9.%-]/g, ""));

  return {
    display,
    numeric: Number.isNaN(numeric) ? null : numeric,
  };
}

// ---------------------------------------------------------------------------
// extractColumnValues
//
// Helper used by widgets: given a list of tasks and a column id, extract the
// raw cell values as an array (may include nulls).
// ---------------------------------------------------------------------------

export function extractColumnValues(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  columns: Column[],
  columnId: string,
): unknown[] {
  const column = columns.find((c) => c.id === columnId);
  if (!column) return [];
  const columnType = column.type as CellTypeId;
  let def: ReturnType<typeof getCellDef> | null = null;
  try {
    def = getCellDef(columnType);
    // Probe to trigger throw if Proxy sentinel for unimplemented type.
    void def.fromRow;
  } catch {
    return [];
  }
  return tasks.map((task) => {
    const cell = cellsByKey.get(`${task.id}:${columnId}`);
    return def?.fromRow(cell);
  });
}
