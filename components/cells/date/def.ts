/**
 * Cell type definition: date
 *
 * TValue  : { iso: string } | null   (ISO 8601 date string, e.g. "2026-05-11")
 * TConfig : { format?: string }      (default "yyyy-MM-dd", used as display hint)
 * Storage : cell.date_value
 */

import { Calendar } from "lucide-react";
import type { AggregateRenderDescriptor } from "@/lib/cells/aggregate-descriptors";
import { aggregateCount, aggregateCountEmpty } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";
import { OperandEditor } from "./OperandEditor";

export type DateCellValue = { iso: string };
export type DateConfig = { format?: string };

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

export const dateType: CellTypeDef<DateCellValue, DateConfig> = {
  id: "date",
  label: "Date",
  icon: Calendar,
  defaultConfig: { format: "yyyy-MM-dd" },
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,
  OperandEditor,

  fromRow: (row) => (row?.date_value ? { iso: row.date_value } : null),

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    date_value: value?.iso ?? null,
  }),

  filterOperators: [
    "equals",
    "before",
    "after",
    "between",
    "today",
    "this_week",
    "this_month",
    "is_empty",
  ],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (value == null) return false;

    const d = new Date(value.iso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (op === "equals") return value.iso === String(operand ?? "");
    if (op === "before") return d < new Date(String(operand ?? ""));
    if (op === "after") return d > new Date(String(operand ?? ""));
    if (op === "today") {
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + 1);
      return d >= start && d < end;
    }
    if (op === "this_week") {
      const dow = today.getDay(); // 0 = Sunday
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dow + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);
      return d >= monday && d < sunday;
    }
    if (op === "this_month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return d >= start && d < end;
    }
    if (op === "between") {
      const [from, to] = Array.isArray(operand) ? operand : [];
      if (!from || !to) return false;
      return d >= new Date(String(from)) && d <= new Date(String(to));
    }
    return false;
  },

  aggregations: ["count", "count_empty", "range", "earliest", "latest"],
  defaultAggregation: "range",

  aggregate: (values, kind: AggregationKind): string | AggregateRenderDescriptor => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_empty") return aggregateCountEmpty(values);
    if (kind === "range") {
      const isos = values.filter((v): v is DateCellValue => v != null).map((v) => v.iso);
      if (isos.length === 0) return { kind: "date_range", min: null, max: null };
      const times = isos.map((s) => new Date(s).getTime());
      const minIso = isos[times.indexOf(Math.min(...times))] ?? null;
      const maxIso = isos[times.indexOf(Math.max(...times))] ?? null;
      return { kind: "date_range", min: minIso, max: maxIso };
    }
    if (kind === "earliest") {
      const dates = values
        .filter((v) => v?.iso)
        .map((v) => v?.iso)
        .sort();
      return dates[0] ?? "—";
    }
    if (kind === "latest") {
      const dates = values
        .filter((v) => v?.iso)
        .map((v) => v?.iso)
        .sort();
      return dates[dates.length - 1] ?? "—";
    }
    return "—";
  },

  toSearchString: (value) => value?.iso ?? "",

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a.iso.localeCompare(b.iso);
  },

  convertTo: {
    text: { fn: (v) => v?.iso ?? "" },
    timeline: { fn: (v) => (v ? { start: v.iso, end: v.iso } : null) },
  },
};
