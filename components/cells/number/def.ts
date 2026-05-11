/**
 * Cell type definition: number
 *
 * TValue  : number | null
 * TConfig : { decimals?: number; suffix?: string; min?: number; max?: number }
 * Storage : cell.number_value
 */

import { Hash } from "lucide-react";

import {
  aggregateAvg,
  aggregateCount,
  aggregateCountEmpty,
  aggregateMax,
  aggregateMedian,
  aggregateMin,
  aggregateSum,
} from "@/lib/cells/aggregations";
import type { CellTypeDef } from "@/lib/cells/types";

import { Cell } from "./Cell";
import { Editor } from "./Editor";

export type NumberConfig = {
  decimals?: number;
  suffix?: string;
  min?: number;
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

export const numberType: CellTypeDef<number, NumberConfig> = {
  id: "number",
  label: "Number",
  icon: Hash,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline",

  Cell,
  Editor,

  fromRow: (row) => row?.number_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    number_value: value,
  }),

  filterOperators: ["equals", "lt", "lte", "gt", "gte", "between", "is_empty", "is_not_empty"],

  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value == null;
    if (op === "is_not_empty") return value != null;
    if (value == null) return false;
    const o = Number(operand);
    if (op === "equals") return value === o;
    if (op === "lt") return value < o;
    if (op === "lte") return value <= o;
    if (op === "gt") return value > o;
    if (op === "gte") return value >= o;
    if (op === "between") {
      const range = Array.isArray(operand)
        ? (operand as number[])
        : [Number(operand), Number(operand)];
      const lo = range[0] ?? Number.NEGATIVE_INFINITY;
      const hi = range[1] ?? Number.POSITIVE_INFINITY;
      return value >= lo && value <= hi;
    }
    return false;
  },

  aggregations: ["count", "count_empty", "sum", "avg", "min", "max", "median"],

  aggregate: (values, kind) => {
    const nonNull = values.filter((v): v is number => v != null);
    if (kind === "count") return aggregateCount(values);
    if (kind === "count_empty") return aggregateCountEmpty(values);
    if (kind === "sum") return aggregateSum(nonNull);
    if (kind === "avg") return aggregateAvg(nonNull);
    if (kind === "min") return aggregateMin(nonNull);
    if (kind === "max") return aggregateMax(nonNull);
    if (kind === "median") return aggregateMedian(nonNull);
    return "—";
  },

  compare: (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    return a - b;
  },

  convertTo: {
    text: { fn: (v) => v?.toString() ?? "" },
    currency: { fn: (v) => v ?? null },
  },
};
