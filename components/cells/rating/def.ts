/**
 * Cell type definition: rating
 *
 * TValue  : number | null  (integer 0..max)
 * TConfig : { max?: number }  — default 5
 * Storage : cell.number_value
 */

import { Star } from "lucide-react";

import { aggregateAvg, aggregateCount } from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type RatingConfig = {
  max?: number;
};

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

export const ratingType: CellTypeDef<number, RatingConfig> = {
  id: "rating",
  label: "Rating",
  icon: Star,
  defaultConfig: { max: 5 },
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow: (row) => row?.number_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    number_value: value,
  }),

  filterOperators: ["equals", "gte", "lte", "is_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (value == null) return false;
    const o = Number(operand);
    if (op === "equals") return value === o;
    if (op === "gte") return value >= o;
    if (op === "lte") return value <= o;
    return false;
  },

  aggregations: ["count", "avg"],

  aggregate: (values, kind) => {
    const nonNull = values.filter((v): v is number => v != null);
    if (kind === "count") return aggregateCount(values);
    if (kind === "avg") return aggregateAvg(nonNull);
    return "—";
  },

  toSearchString: (value) => (value == null ? "" : String(value)),

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return a - b;
  },

  convertTo: {
    number: { fn: (v) => v ?? null },
  },
};
