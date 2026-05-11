/**
 * Server-only. Uses `adminClient()` because `public.activity` has no INSERT RLS policy
 * (epic 04 risk-note 8). Service-role write is the only permitted path.
 *
 * Writes are best-effort and never fail the parent action. All errors are caught and
 * routed to `logger.warn` so the calling server action continues successfully.
 */

import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: server-only activity log; no client callsites.
import { adminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

export type ActivityType =
  | "group.created"
  | "group.renamed"
  | "group.recolored"
  | "group.reordered"
  | "group.duplicated"
  | "group.deleted"
  | "task.created"
  | "task.renamed"
  | "task.duplicated"
  | "task.deleted"
  | "task.moved"
  | "task.bulk_deleted"
  | "task.bulk_duplicated"
  | "task.bulk_moved"
  | "column.created"
  | "column.renamed"
  | "column.reordered"
  | "column.duplicated"
  | "column.type_changed"
  | "column.deleted"
  | "column.settings_updated"
  | "label.created"
  | "label.renamed"
  | "label.recolored"
  | "label.reordered"
  | "label.deleted"
  | "cell.changed"
  | "cell.bulk_changed";

export type LogActivityArgs = {
  boardId: string;
  taskId?: string | null;
  actorId: string;
  type: ActivityType;
  payload: Record<string, unknown>;
};

/**
 * Insert a row into `public.activity` via the service-role client (no INSERT RLS policy).
 * Best-effort: any error is caught and logged as a warning; the function never throws.
 */
export async function logActivity(args: LogActivityArgs): Promise<void> {
  try {
    const { error } = await adminClient()
      .from("activity")
      .insert({
        board_id: args.boardId,
        task_id: args.taskId ?? null,
        actor_id: args.actorId,
        type: args.type,
        payload: args.payload as Json,
      });

    if (error) {
      logger.warn({ err: error, args }, "logActivity: insert failed");
    }
  } catch (err) {
    logger.warn({ err, args }, "logActivity: unexpected error");
  }
}
