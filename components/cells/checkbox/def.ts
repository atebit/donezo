/**
 * Cell type definition: checkbox
 *
 * TValue  : boolean | null
 * TConfig : {}  (no per-column config)
 * Storage : cell.boolean_value
 */

import { CheckSquare } from "lucide-react";

import { aggregateCount, aggregatePercentChecked } from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

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

export const checkboxType: CellTypeDef<boolean, Record<string, never>> = {
  id: "checkbox",
  label: "Checkbox",
  icon: CheckSquare,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow: (row) => row?.boolean_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    boolean_value: value,
  }),

  filterOperators: ["equals", "is_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (op === "equals") return value === Boolean(operand);
    return false;
  },

  aggregations: ["count", "percent_checked"],

  aggregate: (values, kind) => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "percent_checked") return aggregatePercentChecked(values);
    return "—";
  },

  compare: (a, b) => {
    // null < false < true
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (a === b) return 0;
    return a ? 1 : -1;
  },

  convertTo: {
    text: { fn: (v) => (v ? "true" : "false") },
  },
};
