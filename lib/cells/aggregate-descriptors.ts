/**
 * AggregateRenderDescriptor — discriminated union of structured aggregation
 * payloads returned by `CellTypeDef.aggregate()`.
 *
 * When `aggregate()` returns one of these (instead of a plain string), the
 * group footer renders it via `<AggregateRender descriptor={...} />`.
 *
 * String returns from `aggregate()` continue to render as plain text in the
 * footer — this is the backward-compatible path for cell types that were not
 * updated in Epic 16.
 *
 * Epic 16 (Slice C): initial implementation.
 */

export type AggregateRenderDescriptor =
  /** Generic plain-text fallback — wraps an already-formatted string so the
   *  footer can go through a single code path even for string results. */
  | { kind: "text"; value: string }

  /** N / M — count of non-empty cells over total cells. Used by text-family
   *  types (text, long_text, link, email, phone, country, location). */
  | { kind: "count_non_empty"; nonEmpty: number; total: number }

  /** Stacked proportional bar — used by status, priority, and tags.
   *  Each segment carries the label (or tag) identity, its count, display
   *  color (hex / CSS color), and human-readable name. */
  | {
      kind: "label_distribution";
      segments: { labelId: string; count: number; color: string; name: string }[];
    }

  /** Date-range pill — `min … max` for date and timeline types.
   *  `null` means "no non-empty dates in the group". */
  | { kind: "date_range"; min: string | null; max: string | null }

  /** Percent of checked cells — used by checkbox. */
  | { kind: "percent_checked"; pct: number; total: number }

  /** Avatar-stack + count — used by person. */
  | { kind: "unique_count_avatars"; count: number; userIds: string[] };
