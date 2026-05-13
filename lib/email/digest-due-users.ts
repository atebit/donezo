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
 *     4. The caller (buildDigest) returns null when there are no pending digest rows,
 *        so the timing gate here is sufficient — no double-query needed.
 *
 * TZ math uses `@date-fns/tz` (TZDate) — the native v4 TZ companion library.
 *
 * DST caveat: on spring-forward the window is skipped; on fall-back it fires twice
 * (idempotent because buildDigest marks digested_at before returning). Acceptable for v1.
 */

import { TZDate } from "@date-fns/tz";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role path for digest scheduling.
import { adminClient } from "@/lib/supabase/admin";

/** Window size in milliseconds (15 minutes). */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Returns the scheduled digest instant (UTC ms) for the given preference row
 * on the same calendar day as `now` in `tz`.
 *
 * Throws if `tz` is invalid (caller should catch and skip).
 */
function scheduledMs(now: Date, digestHour: number, tz: string): number {
  // Build a TZDate for `now` in the user's timezone.
  // TZDate(date, tz) returns NaN getTime() when tz is invalid — we treat that as an error.
  const nowInTz = new TZDate(now, tz);
  if (Number.isNaN(nowInTz.getTime())) {
    throw new RangeError(`Invalid timezone: ${tz}`);
  }

  // Reconstruct the scheduled fire time: same year/month/day, digestHour:00:00 in tz.
  const sched = new TZDate(
    nowInTz.getFullYear(),
    nowInTz.getMonth(),
    nowInTz.getDate(),
    digestHour,
    0,
    0,
    0,
    tz,
  );

  if (Number.isNaN(sched.getTime())) {
    throw new RangeError(`Could not compute scheduled time in timezone: ${tz}`);
  }

  return sched.getTime();
}

/**
 * Returns the list of user IDs whose digest should fire during the 15-minute
 * window that starts at `now`.
 *
 * @param now - The reference instant (usually `new Date()` in the cron route,
 *              but injectable for testing).
 */
export async function findUsersDueForDigest(now: Date): Promise<string[]> {
  const admin = adminClient();

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
      const fireMs = scheduledMs(now, hour, tz);

      if (nowMs >= fireMs && nowMs < fireMs + WINDOW_MS) {
        due.push(pref.user_id);
      }
    } catch (err) {
      logger.warn(
        { userId: pref.user_id, tz, err },
        "[findUsersDueForDigest] invalid timezone — skipping user",
      );
    }
  }

  return due;
}
