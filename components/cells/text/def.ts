/**
 * Cell type definition: text
 *
 * TValue  : string
 * TConfig : {} (no per-column config)
 * Storage : cell.text_value
 */

import { Type } from "lucide-react";

import { aggregateCount, aggregateCountEmpty } from "@/lib/cells/aggregations";
import { tryParseNumber } from "@/lib/cells/conversions";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

/** All value columns in the `cell` table (per schema inspection, S8 reference). */
const NULL_VALUE_PATCH = {
  text_value: null,
  number_value: null,
  boolean_value: null,
  date_value: null,
  date_end_value: null,
  label_id: null,
  json_value: null,
} as const;

export const textType: CellTypeDef<string, Record<string, never>> = {
  id: "text",
  label: "Text",
  icon: Type,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow: (row) => row?.text_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    text_value: value,
  }),

  filterOperators: ["equals", "contains", "starts_with", "ends_with", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value === "";
    if (op === "is_not_empty") return value != null && value !== "";
    const v = value ?? "";
    const o = String(operand ?? "").toLowerCase();
    const vl = v.toLowerCase();
    if (op === "equals") return vl === o;
    if (op === "contains") return vl.includes(o);
    if (op === "starts_with") return vl.startsWith(o);
    if (op === "ends_with") return vl.endsWith(o);
    return false;
  },

  aggregations: ["count", "count_empty"],

  aggregate: (values, kind) => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_empty") return aggregateCountEmpty(values);
    return "—";
  },

  toSearchString: (value) => value ?? "",

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return a.localeCompare(b);
  },

  convertTo: {
    number: { fn: (v) => (v == null ? null : tryParseNumber(v)) },
    email: { fn: (v) => v ?? null },
    phone: { fn: (v) => v ?? null },
    country: { fn: (v) => v ?? null },
    link: { fn: (v) => (v ? { url: v } : null) },
    // text → status: free-form string can't map to a label; lossy
    status: { fn: () => null, lossy: true },
  },
};
