/**
 * Cell type definition: week
 *
 * TValue  : { year: number; week: number } | null
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 *
 * Display format: "2026-W19"
 */

import { CalendarDays } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type WeekCellValue = { year: number; week: number };

/** All value columns in the `cell` table — every toRow must set all 7 explicitly. */
const NULL_VALUE_PATCH = {
  text_value: null,
  number_value: null,
  boolean_value: null,
  date_value: null,
  date_end_value: null,
  label_id: null,
  json_value: null,
} as const;

/** Runtime guard: validates that an unknown JSON value has the `{ year: number; week: number }` shape. */
function isWeekValue(v: unknown): v is WeekCellValue {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "year" in v &&
    "week" in v &&
    typeof (v as Record<string, unknown>).year === "number" &&
    typeof (v as Record<string, unknown>).week === "number"
  );
}

/** Format `{ year, week }` as "2026-W19". */
export function formatWeek(v: WeekCellValue): string {
  return `${v.year}-W${String(v.week).padStart(2, "0")}`;
}

export const weekType: CellTypeDef<WeekCellValue, Record<string, never>> = {
  id: "week",
  label: "Week",
  icon: CalendarDays,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow: (row) => {
    const raw = row?.json_value;
    if (isWeekValue(raw)) return raw;
    return null;
  },

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value: value ? { year: value.year, week: value.week } : null,
  }),

  filterOperators: ["equals", "is_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (op === "equals") {
      if (value == null) return false;
      const target = String(operand ?? "");
      return formatWeek(value) === target;
    }
    return false;
  },

  aggregations: ["count"],

  aggregate: (values, kind: AggregationKind) => {
    if (kind === "count") return aggregateCount(values);
    return "—";
  },

  // v1: no obvious searchable text representation for a week number.
  toSearchString: () => "",

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  },

  convertTo: {
    text: {
      fn: (v) => (v ? formatWeek(v) : ""),
    },
  },
};
