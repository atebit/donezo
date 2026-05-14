/**
 * uniqueName — return a name that does not collide with any existing name.
 *
 * If `desired` is not in `existing`, return `desired` unchanged.
 * Otherwise, find the smallest n ≥ 2 such that `"${desired} (${n})"` is not
 * in `existing` and return that suffixed variant.
 *
 * Gaps in the numeric sequence are NOT skipped over — we fill from 2 upward:
 *   existing = ["X", "X (3)"]  →  desired "X"  →  returns "X (2)"
 *
 * This is a pure function with no side effects.
 */
export function uniqueName(desired: string, existing: readonly string[]): string {
  if (!existing.includes(desired)) return desired;
  let n = 2;
  while (existing.includes(`${desired} (${n})`)) n++;
  return `${desired} (${n})`;
}
