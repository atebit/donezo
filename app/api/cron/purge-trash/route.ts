/**
 * app/api/cron/purge-trash/route.ts
 *
 * Purge-trash cron handler — fires daily at 04:00 UTC (see vercel.json).
 *
 * Logic per run:
 *  Hard-deletes soft-deleted rows that have been in the trash longer than 30 days.
 *  Currently covers `board` (has deleted_at). Comment rows cascade-delete from tasks.
 *
 * Returns a summary JSON: { ok, boardsDeleted, commentsDeleted }.
 */

import { NextResponse } from "next/server";
import { runPurgeTrash } from "@/lib/jobs/purge-trash";
import { withCronAuth } from "@/lib/jobs/wrap-cron";

export const GET = withCronAuth(
  async (_req) => {
    const result = await runPurgeTrash();
    return NextResponse.json({ ok: true, ...result });
  },
  { name: "purge-trash" },
);
