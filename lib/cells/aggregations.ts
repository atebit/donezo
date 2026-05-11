/**
 * Aggregation helper functions used by per-type `CellTypeDef.aggregate`.
 *
 * All functions are pure — no React, no Supabase, no `window`.
 * They return display-ready strings so the group-footer renderer stays trivial.
 */

/** Count all values (including nulls). Returns the total row count. */
export function aggregateCount(values: unknown[]): string {
  return values.length.toString();
}

/** Count null (or undefined) values in the array. */
export function aggregateCountEmpty<T>(values: (T | null)[]): string {
  return values.filter((v) => v == null).length.toString();
}

/** Count distinct values using Set equality. Nulls each count as one bucket. */
export function aggregateCountUnique<T>(values: T[]): string {
  return new Set(values).size.toString();
}

/** Sum an array of numbers. Returns "0" on empty input. */
export function aggregateSum(values: number[]): string {
  return values.reduce((s, v) => s + v, 0).toString();
}

/** Average of an array of numbers, formatted to 2 decimal places. Returns "—" on empty input. */
export function aggregateAvg(values: number[]): string {
  if (values.length === 0) return "—";
  return (values.reduce((s, v) => s + v, 0) / values.length).toFixed(2);
}

/** Minimum value in an array of numbers. Returns "—" on empty input. */
export function aggregateMin(values: number[]): string {
  if (values.length === 0) return "—";
  return Math.min(...values).toString();
}

/** Maximum value in an array of numbers. Returns "—" on empty input. */
export function aggregateMax(values: number[]): string {
  if (values.length === 0) return "—";
  return Math.max(...values).toString();
}

/** Median of an array of numbers. Returns "—" on empty input. */
export function aggregateMedian(values: number[]): string {
  if (values.length === 0) return "—";
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return (sorted[mid] ?? 0).toString();
  }
  return (((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2).toFixed(2);
}

/**
 * Percentage breakdown by label name, formatted as "60% Done · 30% Working · 10% Stuck".
 * Returns "—" if `values` is empty.
 */
export function aggregatePercentByLabel(
  values: ({ labelId: string } | null)[],
  labels: { id: string; name: string }[],
): string {
  if (values.length === 0) return "—";
  const total = values.length;
  const counts = new Map<string, number>();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v.labelId, (counts.get(v.labelId) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [labelId, count] of counts) {
    const label = labels.find((l) => l.id === labelId);
    const name = label?.name ?? labelId;
    const pct = Math.round((count / total) * 100);
    parts.push(`${pct}% ${name}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * Percentage of truthy (checked) booleans in the array, rounded to the nearest integer.
 * Returns "0%" on empty input.
 */
export function aggregatePercentChecked(values: (boolean | null)[]): string {
  const total = values.length;
  if (total === 0) return "0%";
  const checked = values.filter((v) => v === true).length;
  return `${Math.round((checked / total) * 100)}%`;
}

/**
 * Date range across an array of ISO date strings.
 * Returns "min – max" formatted via `toLocaleDateString()`. Returns "—" if no non-null dates.
 */
export function aggregateRange(values: (string | null)[]): string {
  const dates = values.filter((v): v is string => v != null).map((v) => new Date(v));
  if (dates.length === 0) return "—";
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  return `${min.toLocaleDateString()} – ${max.toLocaleDateString()}`;
}
