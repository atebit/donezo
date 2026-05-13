/**
 * app/api/cron/digest/route.ts
 *
 * Digest email cron handler — fires every 15 minutes (see vercel.json).
 *
 * Logic per run:
 *   1. Find all users whose configured digest hour-in-their-TZ falls within
 *      [now, now + 15 minutes) via findUsersDueForDigest().
 *   2. For each due user:
 *      a. buildDigest(userId) — aggregate pending digest rows into DigestData.
 *      b. Render the DigestEmail template.
 *      c. sendEmail() — logs the envelope if RESEND_API_KEY is unset (dev/preview).
 *      d. Mark digested_at = now() on all rows included in the digest.
 *   3. Return a summary JSON response.
 *
 * Idempotency:
 *   - digested_at is set after send; if the route crashes before marking, the next
 *     run (15 min later) will re-send. Acceptable for v1.
 *   - Rows are only marked when they were actually included in the digest payload
 *     (i.e., buildDigest found them and returned a non-null DigestData).
 *
 * Mark strategy:
 *   - Only rows with digest-eligible kinds (per user preference) are marked.
 *   - The update query mirrors the fetch conditions in buildDigest:
 *       digested_at IS NULL AND read_at IS NULL AND kind IN (digestKinds).
 *   - We mark by user_id rather than individual row IDs to keep the query simple;
 *     this is safe because buildDigest already fetches exactly those rows.
 */

import { NextResponse } from "next/server";
import { createElement } from "react";
import { DigestEmail } from "@/emails/digest/Digest";
import { buildDigest } from "@/lib/email/digest";
import { findUsersDueForDigest } from "@/lib/email/digest-due-users";
import { sendEmail } from "@/lib/email/send";
import { withCronAuth } from "@/lib/jobs/wrap-cron";
import { logger } from "@/lib/logger";
import { NOTIFICATION_KIND_LIST, type NotificationKind } from "@/lib/notifications/kinds";
import { getPreferenceFor } from "@/lib/notifications/preferences";
// biome-ignore lint/style/noRestrictedImports: service-role for digested_at marking.
import { adminClient } from "@/lib/supabase/admin";

/**
 * Resolves the kinds whose email preference is 'digest' for this user.
 * Used to construct the mark-as-digested update query.
 */
async function resolveDigestKinds(userId: string): Promise<NotificationKind[]> {
  const kinds: NotificationKind[] = [];
  for (const kind of NOTIFICATION_KIND_LIST) {
    const pref = await getPreferenceFor(userId, kind);
    if (pref.email === "digest") kinds.push(kind);
  }
  return kinds;
}

/**
 * Marks all qualifying rows as digested for the given user.
 * Only touches rows that were included in the digest (same filter as buildDigest).
 */
async function markDigested(userId: string): Promise<void> {
  const admin = adminClient();
  const digestKinds = await resolveDigestKinds(userId);
  if (digestKinds.length === 0) return;

  const { error } = await admin
    .from("notification")
    .update({ digested_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("digested_at", null)
    .is("read_at", null)
    .in("kind", digestKinds);

  if (error) {
    logger.error({ userId, error }, "[digest-cron] failed to mark digested_at");
  }
}

export const GET = withCronAuth(
  async (_req) => {
    const now = new Date();

    // 1. Find users whose digest window starts now.
    let dueUsers: string[];
    try {
      dueUsers = await findUsersDueForDigest(now);
    } catch (err) {
      logger.error({ err }, "[digest-cron] findUsersDueForDigest failed");
      return NextResponse.json({ error: "scheduling query failed" }, { status: 500 });
    }

    logger.info({ count: dueUsers.length }, "[digest-cron] users due for digest");

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const userId of dueUsers) {
      try {
        // 2a. Build digest payload.
        const data = await buildDigest(userId);

        if (!data) {
          // No pending digest rows — skip without sending.
          skipped++;
          continue;
        }

        // 2b. Render template.
        const react = createElement(DigestEmail, { data });

        // 2c. Send email (logs envelope when RESEND_API_KEY is unset).
        await sendEmail({
          to: data.recipient.email,
          subject: `Your Donezo digest — ${data.counts.total} notification${data.counts.total !== 1 ? "s" : ""}`,
          react,
          tag: "digest",
        });

        // 2d. Mark rows as digested.
        await markDigested(userId);

        logger.info({ userId, total: data.counts.total }, "[digest-cron] digest sent and marked");
        sent++;
      } catch (err) {
        logger.error({ userId, err }, "[digest-cron] error processing user");
        errors++;
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, errors });
  },
  { name: "digest" },
);
