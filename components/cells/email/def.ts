/**
 * Cell type definition: email
 *
 * TValue  : string
 * TConfig : {} (no per-column config)
 * Storage : cell.text_value
 */

import { Mail } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

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

export const emailType: CellTypeDef<string, Record<string, never>> = {
  id: "email",
  label: "Email",
  icon: Mail,
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

  filterOperators: ["equals", "contains", "is_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value === "";
    const v = (value ?? "").toLowerCase();
    const o = String(operand ?? "").toLowerCase();
    if (op === "equals") return v === o;
    if (op === "contains") return v.includes(o);
    return false;
  },

  aggregations: ["count"],

  aggregate: (values, kind) => {
    if (kind === "count") return aggregateCount(values);
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
    // email → phone: loses the email structure; treat as lossy
    phone: { fn: (v) => v ?? null, lossy: true },
  },
};
