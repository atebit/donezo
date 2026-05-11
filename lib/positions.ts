/**
 * Fractional position helpers for group and task ordering.
 *
 * Algorithm: insert between `a` and `b` via bisection — `(a + b) / 2`.
 * - End-insert (no next neighbour): `a + 1`.
 * - Front-insert (no prev neighbour): `next - 1`.
 * - Empty list (both null): start at `1` so front-inserts into `a / 2` stay
 *   positive for a long time.
 *
 * Precision-decay risk: repeated bisection causes positions to converge toward
 * zero floating-point precision. A nightly Edge Function (epic 15) compacts
 * positions for active boards by resetting them to integers. Until that runs,
 * `positionBetween` throws `POSITION_PRECISION_EXHAUSTED` when `|next - prev|`
 * falls below `MIN_POSITION_DELTA`, signalling that compaction is required.
 * Server actions catch this throw and surface a user-friendly error.
 */

/** Minimum allowed gap between two adjacent positions before compaction is needed. */
export const MIN_POSITION_DELTA = 1e-6;

/**
 * Compute a position value that sorts between `prev` and `next`.
 *
 * @param prev - Position of the item immediately before the insertion point,
 *               or `null` if inserting at the front.
 * @param next - Position of the item immediately after the insertion point,
 *               or `null` if inserting at the end.
 * @returns A number that compares as `prev < result < next`.
 * @throws `{ code: "POSITION_PRECISION_EXHAUSTED", message: string }` when the
 *         gap between `prev` and `next` is too small to bisect safely.
 */
export function positionBetween(prev: number | null, next: number | null): number {
  // Both absent — seed the list at position 1.
  if (prev === null && next === null) return 1;
  // Front-insert: place one unit before the current first item.
  if (prev === null) return (next as number) - 1;
  // End-insert: place one unit after the current last item.
  if (next === null) return prev + 1;

  // Both present — bisect. Check precision headroom first.
  if (Math.abs(next - prev) < MIN_POSITION_DELTA) {
    throw {
      code: "POSITION_PRECISION_EXHAUSTED",
      message: "Positions need compaction",
    };
  }

  return (prev + next) / 2;
}
