/**
 * app/api/cron/cleanup-orphans/route.ts
 *
 * Cleanup-orphan-attachments cron handler — fires every hour (see vercel.json).
 *
 * Logic per run:
 *  1. Calls purge_orphan_attachments() SQL function to remove pending attachment
 *     rows (is_uploaded=false) older than 1 hour.
 *  2. Pages through all storage objects in the "attachments" bucket and removes
 *     any whose attachmentId segment has no corresponding attachment row.
 *
 * Returns a summary JSON: { ok, pendingRowsDeleted, storageObjectsDeleted }.
 */

import { NextResponse } from "next/server";
import { runCleanupOrphans } from "@/lib/jobs/cleanup-orphans";
import { withCronAuth } from "@/lib/jobs/wrap-cron";

export const GET = withCronAuth(
  async (_req) => {
    const result = await runCleanupOrphans();
    return NextResponse.json({ ok: true, ...result });
  },
  { name: "cleanup-orphans" },
);
