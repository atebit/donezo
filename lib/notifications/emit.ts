/**
 * lib/notifications/emit.ts
 *
 * Typed thin wrapper around notifyUsers.
 *
 * CONTRACT — best-effort:
 *   Every call to `emit(...)` is fire-and-forget. Errors are caught, logged via
 *   lib/logger, and NEVER propagated to the calling server action. This contract
 *   is enforced here and must be maintained in all callers (emitters.ts).
 *
 * Callers (emitters.ts) must still wrap their own logic in try/catch because
 * this module only guards the final notifyUsers call — upstream DB queries in
 * an emitter must also be guarded.
 */

import { logger } from "@/lib/logger";
import type { NotificationKind, NotificationPayloadByKind } from "@/lib/notifications/kinds";
import { notifyUsers } from "@/lib/notifications/notify";

/** A single typed notification row ready for insertion. */
export type EmitRow<K extends NotificationKind = NotificationKind> = {
  user_id: string;
  kind: K;
  payload: NotificationPayloadByKind[K];
};

/**
 * Best-effort emit of one or more notification rows.
 * Never throws. Logs warnings on failure.
 *
 * @param rows - Typed notification rows to insert.
 * @param context - Optional label for log messages (e.g. "emitMentionNotifications").
 */
export async function emit(rows: EmitRow[], context?: string): Promise<void> {
  if (rows.length === 0) return;
  try {
    await notifyUsers(rows);
  } catch (err) {
    logger.warn({ err, count: rows.length, context }, "emit: unexpected error");
  }
}
