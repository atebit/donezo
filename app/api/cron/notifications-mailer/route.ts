/**
 * app/api/cron/notifications-mailer/route.ts
 *
 * Polling fallback for instant notification emails.
 * Fires every 5 minutes (see vercel.json). Lookback window: 30 minutes.
 *
 * Logic:
 *   For each notification where:
 *     - email_sent_at IS NULL
 *     - digested_at IS NULL
 *     - created_at > now() - 30 minutes
 *   Apply the same preference-gating + idempotent-claim logic as the webhook handler.
 *
 * The webhook is the primary delivery path. This cron is the safety net for
 * rows the webhook missed (cold starts, transient failures, etc.).
 */

import { NextResponse } from "next/server";
import { loadEmailContext } from "@/lib/email/context";
import { renderNotificationEmail } from "@/lib/email/render-notification";
import { sendEmail } from "@/lib/email/send";
import { withCronAuth } from "@/lib/jobs/wrap-cron";
import { logger } from "@/lib/logger";
import type { NotificationKind } from "@/lib/notifications/kinds";
import { getPreferenceFor } from "@/lib/notifications/preferences";
// biome-ignore lint/style/noRestrictedImports: service-role for polling + claims.
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];

export const GET = withCronAuth(
  async (_req) => {
    const admin = adminClient();
    const lookbackAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Fetch pending notifications (lookback: 30 minutes).
    const { data: rows, error } = await admin
      .from("notification")
      .select("*")
      .is("email_sent_at", null)
      .is("digested_at", null)
      .gte("created_at", lookbackAt)
      .order("created_at", { ascending: true })
      .limit(100); // Process up to 100 per run to stay within function timeout.

    if (error) {
      logger.error({ error }, "[notifications-mailer] failed to fetch pending notifications");
      return NextResponse.json({ error: "DB query failed" }, { status: 500 });
    }

    let sent = 0;
    let skipped = 0;
    let suppressed = 0;

    for (const row of rows ?? []) {
      const result = await processRow(row as NotificationRow);
      if (result === "sent") sent++;
      else if (result === "suppressed") suppressed++;
      else skipped++;
    }

    return NextResponse.json({ ok: true, sent, skipped, suppressed });
  },
  { name: "notifications-mailer" },
);

async function processRow(
  notification: NotificationRow,
): Promise<"sent" | "skipped" | "suppressed"> {
  const kind = notification.kind as NotificationKind;
  const admin = adminClient();

  try {
    const pref = await getPreferenceFor(notification.user_id, kind);

    if (pref.email === "digest") {
      // Leave for digest cron.
      return "skipped";
    }

    // Idempotent claim.
    const { data: claimed } = await admin
      .from("notification")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", notification.id)
      .is("email_sent_at", null)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      // Already processed by the webhook or a concurrent mailer run.
      return "skipped";
    }

    if (pref.email === "off") {
      return "suppressed";
    }

    // pref.email === 'instant'.
    const ctx = await loadEmailContext(notification);
    if (!ctx) return "skipped";

    const envelope = renderNotificationEmail(kind, ctx);
    if (!envelope) return "skipped";

    await sendEmail({
      to: ctx.recipient.email,
      subject: envelope.subject,
      react: envelope.react,
      tag: envelope.tag,
    });

    return "sent";
  } catch (err) {
    logger.error(
      { err, notificationId: notification.id, kind },
      "[notifications-mailer] error processing row",
    );
    return "skipped";
  }
}
