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
 *
 * Authentication:
 *   - Authorization: Bearer ${INTERNAL_CRON_SECRET}  (timing-safe compare)
 *   - x-vercel-cron: 1  (sanity check only; not a security boundary)
 */

import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { runDueScanner } from "@/lib/notifications/due-scanner";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyAuth(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) {
    // In dev / test the secret may be unset — allow open access with a warning.
    logger.warn("[due-scanner] INTERNAL_CRON_SECRET not set — running in open mode");
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice(7);
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronHeader = request.headers.get("x-vercel-cron");
  if (process.env.NODE_ENV === "production" && cronHeader !== "1") {
    logger.warn("[due-scanner] missing x-vercel-cron header in production");
  }

  logger.info("[due-scanner] run started");

  try {
    const result = await runDueScanner();
    logger.info({ result }, "[due-scanner] run complete");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // runDueScanner is best-effort internally, but guard any unexpected top-level throw.
    logger.error({ err }, "[due-scanner] unexpected top-level error");
    return NextResponse.json({ error: "Scanner failed" }, { status: 500 });
  }
}
