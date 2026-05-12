/**
 * Cell type definition: link
 *
 * TValue  : { url: string; label?: string }
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 *
 * Note: `fromRow` casts json_value. The DB stores `Json` which at runtime
 * is a plain JS object matching LinkValue. We guard the cast with a type
 * predicate to avoid trusting arbitrary json_value contents.
 */

import { Link } from "lucide-react";

import { aggregateCount } from "@/lib/cells/aggregations";
import type { CellRow, CellTypeDef, FilterOperator } from "@/lib/cells/types";

import { Cell, type LinkValue } from "./Cell";
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

function isLinkValue(v: unknown): v is LinkValue {
  return (
    v !== null &&
    typeof v === "object" &&
    "url" in v &&
    typeof (v as Record<string, unknown>).url === "string"
  );
}

function fromRow(row: CellRow | undefined): LinkValue | null {
  if (!row) return null;
  const v = row.json_value;
  return isLinkValue(v) ? v : null;
}

function matchesFilter(value: LinkValue | null, op: FilterOperator, operand: unknown): boolean {
  if (op === "is_empty") return value == null;
  if (op === "contains") {
    if (value == null) return false;
    const haystack = `${value.url} ${value.label ?? ""}`.toLowerCase();
    return haystack.includes(String(operand ?? "").toLowerCase());
  }
  return false;
}

export const linkType: CellTypeDef<LinkValue, Record<string, never>> = {
  id: "link",
  label: "Link",
  icon: Link,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,

  fromRow,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value: value as unknown as import("@/lib/supabase/types").Json,
  }),

  filterOperators: ["contains", "is_empty"],

  matchesFilter,

  aggregations: ["count"],

  aggregate: (values, kind) => {
    if (kind === "count") return aggregateCount(values);
    return "—";
  },

  toSearchString: (value) => {
    if (value == null) return "";
    return [value.label, value.url].filter(Boolean).join(" ");
  },

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    const labelA = a.label ?? a.url;
    const labelB = b.label ?? b.url;
    return labelA.localeCompare(labelB);
  },

  convertTo: {
    // link → text: join url and label into a single string
    text: {
      fn: (v) => {
        if (v == null) return null;
        return v.label ? `${v.label} (${v.url})` : v.url;
      },
    },
  },
};
