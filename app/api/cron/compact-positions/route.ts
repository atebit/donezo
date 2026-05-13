/**
 * app/api/cron/compact-positions/route.ts
 *
 * Compact-positions cron handler — fires weekly on Sunday at 05:00 UTC (see vercel.json).
 *
 * Authentication:
 *   - Authorization: Bearer ${INTERNAL_CRON_SECRET}
 *   - x-vercel-cron: 1  (sanity check; not a security boundary)
 *
 * Logic per run:
 *  Resets group and task positions to integer-spaced values (1000-step) on boards
 *  updated in the last 7 days. Prevents POSITION_PRECISION_EXHAUSTED errors caused
 *  by repeated fractional bisection in lib/positions.ts.
 *
 * Returns a summary JSON: { ok, boardsProcessed, groupsCompacted, tasksCompacted }.
 */

import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { runCompactPositions } from "@/lib/jobs/compact-positions";
import { logger } from "@/lib/logger";

function getCronSecret(): string | undefined {
  return process.env.INTERNAL_CRON_SECRET;
}

function verifyAuth(request: NextRequest): boolean {
  const secret = getCronSecret();
  if (!secret) {
    logger.warn("[compact-positions-cron] INTERNAL_CRON_SECRET not set — running in open mode");
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

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronHeader = request.headers.get("x-vercel-cron");
  if (process.env.NODE_ENV === "production" && cronHeader !== "1") {
    logger.warn("[compact-positions-cron] missing x-vercel-cron header in production");
  }

  const now = new Date();
  logger.info({ now: now.toISOString() }, "[compact-positions-cron] run started");

  try {
    const result = await runCompactPositions();
    logger.info(result, "[compact-positions-cron] run complete");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "[compact-positions-cron] run failed");
    Sentry.captureException(err, { tags: { cron: "compact-positions" } });
    return NextResponse.json({ error: "compaction failed" }, { status: 500 });
  }
}
