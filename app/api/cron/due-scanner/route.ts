/**
 * app/api/cron/due-scanner/route.ts
 *
 * Hourly cron that scans date cells and emits `due_soon` / `due_overdue`
 * notifications to task assignees.
 *
 * Schedule: every hour on the hour — `0 * * * *` (see vercel.json).
 *
 * MULTI-DATE-COLUMN DESIGN NOTE:
 *   A board may have several date-type columns (e.g. "Start Date", "Due Date").
 *   The scanner queries ALL date columns. The idempotency key is (task_id, kind)
 *   only — not (task_id, column_id, kind) — so a task fires AT MOST ONE
 *   `due_soon` and ONE `due_overdue` regardless of how many date columns match.
 *   The first column to win the task_reminder_sent INSERT takes the slot;
 *   subsequent column matches in the same run (or overlapping runs) are silently
 *   skipped via ON CONFLICT DO NOTHING. See lib/notifications/due-scanner.ts for
 *   full design rationale.
 */

import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/jobs/wrap-cron";
import { logger } from "@/lib/logger";
import { runDueScanner } from "@/lib/notifications/due-scanner";

export const GET = withCronAuth(
  async (_req) => {
    try {
      const result = await runDueScanner();
      logger.info({ result }, "[due-scanner] run complete");
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      // runDueScanner is best-effort internally, but guard any unexpected top-level throw.
      logger.error({ err }, "[due-scanner] unexpected top-level error");
      return NextResponse.json({ error: "Scanner failed" }, { status: 500 });
    }
  },
  { name: "due-scanner" },
);
