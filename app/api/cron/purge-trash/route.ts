/**
 * app/api/cron/purge-trash/route.ts
 *
 * Purge-trash cron handler — fires daily at 04:00 UTC (see vercel.json).
 *
 * Authentication:
 *   - Authorization: Bearer ${INTERNAL_CRON_SECRET}
 *   - x-vercel-cron: 1  (sanity check; not a security boundary)
 *
 * Logic per run:
 *  Hard-deletes soft-deleted rows that have been in the trash longer than 30 days.
 *  Currently covers `board` (has deleted_at). Comment rows cascade-delete from tasks.
 *
 * Returns a summary JSON: { ok, boardsDeleted, commentsDeleted }.
 */

import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { runPurgeTrash } from "@/lib/jobs/purge-trash";
import { logger } from "@/lib/logger";

function getCronSecret(): string | undefined {
  return process.env.INTERNAL_CRON_SECRET;
}

function verifyAuth(request: NextRequest): boolean {
  const secret = getCronSecret();
  if (!secret) {
    logger.warn("[purge-trash-cron] INTERNAL_CRON_SECRET not set — running in open mode");
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
    logger.warn("[purge-trash-cron] missing x-vercel-cron header in production");
  }

  const now = new Date();
  logger.info({ now: now.toISOString() }, "[purge-trash-cron] run started");

  try {
    const result = await runPurgeTrash();
    logger.info(result, "[purge-trash-cron] run complete");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "[purge-trash-cron] run failed");
    Sentry.captureException(err, { tags: { cron: "purge-trash" } });
    return NextResponse.json({ error: "purge failed" }, { status: 500 });
  }
}
