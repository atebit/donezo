/**
 * Cell type definition: tags
 *
 * TValue  : { values: string[] } | null  (free-form tag strings)
 * TConfig : {}  (no per-column config)
 * Storage : cell.json_value
 */

import { Tag } from "lucide-react";

import { aggregateCount, aggregateCountUnique } from "@/lib/cells/aggregations";
import type { AggregationKind, CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";
import { OperandEditor } from "./OperandEditor";

export type TagsCellValue = { values: string[] };

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

/** Runtime guard: validates that an unknown JSON value has the `{ values: string[] }` shape. */
function isTagsValue(v: unknown): v is TagsCellValue {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "values" in v &&
    Array.isArray((v as Record<string, unknown>).values) &&
    ((v as Record<string, unknown>).values as unknown[]).every((tag) => typeof tag === "string")
  );
}

export const tagsType: CellTypeDef<TagsCellValue, Record<string, never>> = {
  id: "tags",
  label: "Tags",
  icon: Tag,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  Cell,
  Editor,
  OperandEditor,

  fromRow: (row) => {
    const raw = row?.json_value;
    if (isTagsValue(raw)) return raw;
    return null;
  },

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    json_value: value && value.values.length > 0 ? { values: value.values } : null,
  }),

  filterOperators: ["contains", "in", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null || value.values.length === 0;
    if (op === "is_not_empty") return value != null && value.values.length > 0;
    if (op === "contains") {
      const o = String(operand ?? "").toLowerCase();
      return value?.values.some((tag) => tag.toLowerCase().includes(o)) ?? false;
    }
    if (op === "in") {
      const ids = Array.isArray(operand) ? operand.map(String) : [];
      return value?.values.some((tag) => ids.includes(tag)) ?? false;
    }
    return false;
  },

  aggregations: ["count", "count_unique"],

  aggregate: (values, kind: AggregationKind) => {
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_unique") {
      // count_unique counts unique tag VALUES across cells, not cells
      const unique = new Set<string>();
      for (const v of values) {
        if (v != null) {
          for (const tag of v.values) {
            unique.add(tag);
          }
        }
      }
      return aggregateCountUnique(Array.from(unique));
    }
    return "—";
  },

  toSearchString: (value) => value?.values.join(" ") ?? "",

  compare: (a, b) => {
    const aLen = a?.values.length ?? 0;
    const bLen = b?.values.length ?? 0;
    return aLen - bLen;
  },

  convertTo: {
    text: { fn: (v) => v?.values.join(", ") ?? "" },
  },
};
