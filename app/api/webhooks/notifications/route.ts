/**
 * app/api/webhooks/notifications/route.ts
 *
 * Supabase database webhook handler for the `notification` table (INSERT events).
 *
 * Authentication: Bearer token via Authorization header, compared in constant time
 * against SUPABASE_DB_WEBHOOK_SECRET.
 *
 * For each incoming notification row:
 *   1. Load email context.
 *   2. Consult getPreferenceFor(userId, kind) for the email channel.
 *      - 'instant' → idempotent claim → render + send → mark email_sent_at.
 *      - 'digest'  → skip (leave for digest cron).
 *      - 'off'     → claim email_sent_at = now() to suppress future attempts.
 *   3. Idempotent claim: UPDATE ... WHERE email_sent_at IS NULL RETURNING * —
 *      zero rows means already handled (concurrent delivery or replay), skip.
 *
 * Webhook setup: Supabase local CLI does not currently support [db.webhooks] in
 * config.toml (as of CLI 2.98.2). Configure via the Supabase dashboard:
 *   Dashboard → Database → Webhooks → Create new webhook
 *     Table:  public.notification
 *     Events: INSERT
 *     URL:    ${NEXT_PUBLIC_SITE_URL}/api/webhooks/notifications
 *     Headers: Authorization: Bearer ${SUPABASE_DB_WEBHOOK_SECRET}
 * See CONTRIBUTING.md for full setup instructions.
 */

import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { loadEmailContext } from "@/lib/email/context";
import { renderNotificationEmail } from "@/lib/email/render-notification";
import { sendEmail } from "@/lib/email/send";
import { logger } from "@/lib/logger";
import type { NotificationKind } from "@/lib/notifications/kinds";
import { getPreferenceFor } from "@/lib/notifications/preferences";
// biome-ignore lint/style/noRestrictedImports: service-role for idempotent claim.
import { adminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];

function getWebhookSecret(): string | undefined {
  return process.env.SUPABASE_DB_WEBHOOK_SECRET;
}

function verifyAuth(request: NextRequest): boolean {
  const secret = getWebhookSecret();
  if (!secret) {
    // In dev, allow if secret is not configured (will log a warning).
    logger.warn(
      "[notifications-webhook] SUPABASE_DB_WEBHOOK_SECRET not set — running in open mode",
    );
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7);
  try {
    // Constant-time comparison to avoid timing attacks.
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Supabase webhook payload shape: { type, table, record, old_record, schema }
  const payload = body as { type?: string; record?: NotificationRow };
  if (payload.type !== "INSERT" || !payload.record) {
    return NextResponse.json({ ok: true, skipped: "not-insert" });
  }

  const notification = payload.record;
  await processNotification(notification);

  return NextResponse.json({ ok: true });
}

async function processNotification(notification: NotificationRow): Promise<void> {
  const kind = notification.kind as NotificationKind;
  const admin = adminClient();

  try {
    // 1. Check preference.
    const pref = await getPreferenceFor(notification.user_id, kind);

    if (pref.email === "digest") {
      // Leave for digest cron — do not claim.
      logger.debug(
        { notificationId: notification.id, kind },
        "[notifications-webhook] email=digest — leaving for cron",
      );
      return;
    }

    // 2. Idempotent claim — prevents duplicate sends on webhook replay or
    //    concurrent delivery from the polling fallback.
    const { data: claimed } = await admin
      .from("notification")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", notification.id)
      .is("email_sent_at", null)
      .select("id")
      .maybeSingle();

    if (!claimed) {
      logger.debug(
        { notificationId: notification.id },
        "[notifications-webhook] already claimed — skipping",
      );
      return;
    }

    if (pref.email === "off") {
      // Suppressed — the claim above prevents future polling attempts.
      logger.debug(
        { notificationId: notification.id, kind },
        "[notifications-webhook] email=off — suppressed",
      );
      return;
    }

    // pref.email === 'instant' — render and send.
    const ctx = await loadEmailContext(notification);
    if (!ctx) {
      logger.warn(
        { notificationId: notification.id },
        "[notifications-webhook] loadEmailContext returned null — skipping",
      );
      return;
    }

    const envelope = renderNotificationEmail(kind, ctx);
    if (!envelope) {
      logger.debug(
        { notificationId: notification.id, kind },
        "[notifications-webhook] no email template for kind — skipping",
      );
      return;
    }

    await sendEmail({
      to: ctx.recipient.email,
      subject: envelope.subject,
      react: envelope.react,
      tag: envelope.tag,
    });
  } catch (err) {
    logger.error(
      { err, notificationId: notification.id, kind },
      "[notifications-webhook] unexpected error processing notification",
    );
  }
}
