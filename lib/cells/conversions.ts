/**
 * Cross-type conversion utility helpers used by per-type `CellTypeDef.convertTo` maps.
 *
 * All functions are pure — no React, no Supabase, no `window`.
 */

/** Parse a string as a finite number. Returns `null` if the result is NaN or Infinity. */
export function tryParseNumber(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Validate an email address with a basic regex heuristic. */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Join an array of tag strings into a single comma-separated string. */
export function joinTagValues(values: string[]): string {
  return values.join(", ");
}

/** Split a comma-separated string into an array of trimmed, non-empty tag strings. */
export function splitToTagValues(s: string): string[] {
  return s.split(/,\s*/).filter(Boolean);
}
