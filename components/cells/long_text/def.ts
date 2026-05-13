/**
 * Cell type definition: long_text
 *
 * TValue  : string
 * TConfig : { richText: boolean }  — richText=false for v1; flip when Tiptap lands (epic 09)
 * Storage : cell.text_value
 */

import { AlignLeft } from "lucide-react";

import { aggregateCount, aggregateCountEmpty } from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

type LongTextConfig = { richText: boolean };

/** All value columns in the `cell` table — explicit null-out per Q35. */
const NULL_VALUE_PATCH = {
  text_value: null,
  number_value: null,
  boolean_value: null,
  date_value: null,
  date_end_value: null,
  label_id: null,
  json_value: null,
} as const;

export const longTextType: CellTypeDef<string, LongTextConfig> = {
  id: "long_text",
  label: "Long Text",
  icon: AlignLeft,
  defaultConfig: { richText: false },
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow: (row) => row?.text_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    text_value: value,
  }),

  filterOperators: ["contains", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value === "";
    if (op === "is_not_empty") return value != null && value !== "";
    const v = (value ?? "").toLowerCase();
    const o = String(operand ?? "").toLowerCase();
    if (op === "contains") return v.includes(o);
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
    text: { fn: (v) => v ?? null },
  },
};
