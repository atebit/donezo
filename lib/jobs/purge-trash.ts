/**
 * lib/jobs/purge-trash.ts
 *
 * Service-role job: hard-delete soft-deleted rows that have been in the trash
 * longer than 30 days.
 *
 * Tables:
 *  - `board`: has `deleted_at timestamptz null` — rows where deleted_at IS NOT NULL
 *    AND deleted_at < now() - interval '30 days' are permanently removed.
 *
 * Note on `comment`: the comment table does not have a `deleted_at` column in the
 * current schema (it uses hard-delete via cascade from task). As a result
 * `commentsDeleted` is always 0 and this function is a no-op for comments. If
 * comment soft-delete is added in a future epic, update this function accordingly.
 *
 * Called by app/api/cron/purge-trash/route.ts (daily at 04:00 UTC).
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role job; never imported from client code.
import { adminClient } from "@/lib/supabase/admin";

export interface PurgeTrashResult {
  boardsDeleted: number;
  commentsDeleted: number;
}

/**
 * ISO-8601 timestamp for 30 days ago.
 * Extracted as a function so it can be mocked cleanly in tests.
 */
export function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export async function runPurgeTrash(): Promise<PurgeTrashResult> {
  const admin = adminClient();
  const cutoff = thirtyDaysAgo();

  // Hard-delete boards soft-deleted more than 30 days ago.
  const { count: boardCount, error: boardError } = await admin
    .from("board")
    .delete({ count: "exact" })
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (boardError) {
    const err = new Error(`purge-trash board delete failed: ${boardError.message}`);
    Sentry.captureException(err, { tags: { job: "purge-trash" } });
    throw err;
  }

  const boardsDeleted = boardCount ?? 0;
  logger.info({ boardsDeleted, cutoff }, "[purge-trash] boards hard-deleted");

  // comment.deleted_at does not exist in the current schema — return 0.
  const commentsDeleted = 0;

  return { boardsDeleted, commentsDeleted };
}
