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
