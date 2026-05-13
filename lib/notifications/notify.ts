import { logger } from "@/lib/logger";
import type { NotificationKind } from "@/lib/notifications/kinds";
// biome-ignore lint/style/noRestrictedImports: server-only notification fan-out.
import { adminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

/**
 * NotificationInsert with a typed `kind` field drawn from the NotificationKind
 * union. The DB stores kind as text; this type ensures callers only pass the
 * 13 values that satisfy the check constraint.
 */
export type NotificationInsert = Omit<
  Database["public"]["Tables"]["notification"]["Insert"],
  "kind"
> & {
  kind: NotificationKind;
};

/**
 * Best-effort insert of notification rows. Never throws. Logs warnings on error.
 * Service-role bypasses the per-user notification_select RLS; insert is system-only
 * because the notification table has no INSERT policy.
 */
export async function notifyUsers(rows: NotificationInsert[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { error } = await adminClient()
      .from("notification")
      .insert(rows.map((r) => ({ ...r, payload: r.payload as Json })));
    if (error) logger.warn({ err: error, count: rows.length }, "notifyUsers: insert failed");
  } catch (err) {
    logger.warn({ err, count: rows.length }, "notifyUsers: unexpected error");
  }
}
