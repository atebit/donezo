/**
 * Cell type definition: timeline
 *
 * TValue  : { start: string; end: string } | null  (ISO 8601 date strings)
 * TConfig : {}  (no per-column config)
 * Storage : cell.date_value (start) + cell.date_end_value (end)
 *
 * Special case: toRow writes BOTH date_value AND date_end_value.
 * The cell_one_value_check constraint counts date_value but excludes date_end_value,
 * so this is consistent per the S8 schema note.
 */

import { BarChart2 } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type TimelineCellValue = { start: string; end: string };

export const timelineType: CellTypeDef<TimelineCellValue, Record<string, never>> = {
  id: "timeline",
  label: "Timeline",
  icon: BarChart2,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow: (row) =>
    row?.date_value && row?.date_end_value
      ? { start: row.date_value, end: row.date_end_value }
      : null,

  /**
   * Sets BOTH date_value (start) and date_end_value (end).
   * The cell_one_value_check constraint only counts date_value;
   * date_end_value is an auxiliary column excluded from that constraint.
   */
  toRow: (value) => ({
    text_value: null,
    number_value: null,
    boolean_value: null,
    json_value: null,
    label_id: null,
    date_value: value?.start ?? null,
    date_end_value: value?.end ?? null,
  }),

  filterOperators: ["between", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (op === "is_not_empty") return value != null;
    if (op === "between") {
      if (value == null) return false;
      const [from, to] = Array.isArray(operand) ? operand : [];
      if (!from || !to) return false;
      const start = new Date(value.start);
      const end = new Date(value.end);
      const filterFrom = new Date(String(from));
      const filterTo = new Date(String(to));
      // Overlaps: timeline overlaps the filter window if start <= filterTo && end >= filterFrom
      return start <= filterTo && end >= filterFrom;
    }
    return false;
  },

  aggregations: ["count", "range"],

  aggregate: (values, kind: AggregationKind) => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "range") {
      const nonNull = values.filter((v): v is TimelineCellValue => v != null);
      if (nonNull.length === 0) return "—";
      const starts = nonNull.map((v) => new Date(v.start).getTime());
      const ends = nonNull.map((v) => new Date(v.end).getTime());
      const min = new Date(Math.min(...starts));
      const max = new Date(Math.max(...ends));
      const fmt = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return `${fmt.format(min)} – ${fmt.format(max)}`;
    }
    return "—";
  },

  toSearchString: (value) => (value ? `${value.start} → ${value.end}` : ""),

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
  },

  convertTo: {
    date: { fn: (v) => (v?.start ? { iso: v.start } : null) },
    text: { fn: (v) => (v ? `${v.start} – ${v.end}` : "") },
  },
};
