import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: server-only notification fan-out.
import { adminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export type NotificationInsert = Database["public"]["Tables"]["notification"]["Insert"];

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
