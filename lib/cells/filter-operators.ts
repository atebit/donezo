/**
 * Filter operator definitions.
 *
 * `FilterOperator` is re-exported from `./types` (S1's file).
 * `FILTER_OPERATOR_LABELS` provides UI display strings for every operator in the union.
 *
 * The actual `matchesFilter` implementations live in per-type defs (Stage 3).
 */

import type { FilterOperator } from "./types";

export type { FilterOperator } from "./types";

/**
 * How many operand inputs a filter row needs for this operator.
 *
 *   "none"   → is_empty, is_not_empty, today, this_week, this_month
 *   "one"    → equals, not_equals, contains, not_contains, starts_with,
 *              ends_with, lt, lte, gt, gte, before, after
 *   "many"   → in, not_in
 *   "range"  → between
 */
export type OperatorArity = "none" | "one" | "many" | "range";

export function getOperatorArity(op: FilterOperator): OperatorArity {
  switch (op) {
    case "is_empty":
    case "is_not_empty":
    case "today":
    case "this_week":
    case "this_month":
      return "none";
    case "in":
    case "not_in":
      return "many";
    case "between":
      return "range";
    default:
      return "one";
  }
}

/** Human-readable labels for every `FilterOperator` value. Used in filter-builder UIs. */
export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "doesn't contain",
  starts_with: "starts with",
  ends_with: "ends with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  in: "any of",
  not_in: "none of",
  lt: "less than",
  lte: "≤",
  gt: "greater than",
  gte: "≥",
  between: "between",
  before: "before",
  after: "after",
  today: "today",
  this_week: "this week",
  this_month: "this month",
};
