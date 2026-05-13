/**
 * lib/email/digest-due-users.ts
 *
 * Returns the list of user IDs whose digest is due at `now`.
 *
 * "Due" definition (per spec):
 *   For each notification_preference row where digest_enabled = true:
 *     1. Convert `now` to the user's preferred timezone.
 *     2. Derive the scheduled fire time for today: midnight + digest_hour hours in that TZ.
 *     3. If `now` ∈ [scheduled, scheduled + 15 minutes) → the user is due.
 *     4. Additionally, the user must have pending digest rows
 *        (digested_at IS NULL AND read_at IS NULL AND kind with pref.email = 'digest').
 *        Step 4 is handled by the caller (buildDigest returns null when nothing to send),
 *        so here we only apply the timing gate.
 *
 * TZ math:
 *   - `date-fns-tz` is used for TZ-aware date arithmetic.
 *   - `toZonedTime(now, tz)` converts the UTC instant to a wall-clock Date in `tz`.
 *   - We reconstruct the scheduled instant by building a Date in the same TZ at
 *     hour=digest_hour, minute=0, second=0, then converting back to UTC for comparison.
 *   - DST caveat: on DST transitions one window (spring-forward: gap) is skipped and
 *     one (fall-back: overlap) fires twice. This is acceptable for v1 and documented
 *     in docs/conversion-plan/_dispatch/epic-13.md (risk notes).
 *
 * This function is service-role only (adminClient) — it reads all preference rows.
 */

import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role path for digest scheduling.
import { adminClient } from "@/lib/supabase/admin";

/** Window size in milliseconds (15 minutes). */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Returns the list of user IDs whose digest should fire during the 15-minute
 * window that starts at `now`.
 *
 * @param now - The reference instant (usually `new Date()` in the cron route,
 *              but injectable for testing).
 */
export async function findUsersDueForDigest(now: Date): Promise<string[]> {
  const admin = adminClient();

  // Fetch all rows where digest is enabled.
  const { data: prefs, error } = await admin
    .from("notification_preference")
    .select("user_id, digest_hour, digest_timezone")
    .eq("digest_enabled", true);

  if (error) {
    logger.error({ error }, "[findUsersDueForDigest] failed to fetch preferences");
    return [];
  }

  if (!prefs || prefs.length === 0) return [];

  const due: string[] = [];
  const nowMs = now.getTime();

  for (const pref of prefs) {
    const tz = pref.digest_timezone || "UTC";
    const hour = pref.digest_hour ?? 9;

    try {
      // Convert `now` to the user's timezone wall clock.
      const zonedNow = toZonedTime(now, tz);

      // Build the scheduled fire instant for TODAY in the user's TZ:
      // same year/month/day, at hour:00:00.
      const scheduledZoned = new Date(zonedNow);
      scheduledZoned.setHours(hour, 0, 0, 0);

      // Convert scheduled wall-clock time back to UTC for comparison.
      const scheduledUtc = fromZonedTime(scheduledZoned, tz);
      const scheduledMs = scheduledUtc.getTime();

      // Check: now ∈ [scheduled, scheduled + 15 minutes)
      if (nowMs >= scheduledMs && nowMs < scheduledMs + WINDOW_MS) {
        due.push(pref.user_id);
      }
    } catch (err) {
      // Invalid TZ string — skip the user, log a warning.
      logger.warn(
        { userId: pref.user_id, tz, err },
        "[findUsersDueForDigest] invalid timezone — skipping user",
      );
    }
  }

  return due;
}
