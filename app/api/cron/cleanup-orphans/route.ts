/**
 * app/api/cron/cleanup-orphans/route.ts
 *
 * Cleanup-orphan-attachments cron handler — fires every hour (see vercel.json).
 *
 * Authentication:
 *   - Authorization: Bearer ${INTERNAL_CRON_SECRET}
 *   - x-vercel-cron: 1  (sanity check; not a security boundary)
 *
 * Logic per run:
 *  1. Calls purge_orphan_attachments() SQL function to remove pending attachment
 *     rows (is_uploaded=false) older than 1 hour.
 *  2. Pages through all storage objects in the "attachments" bucket and removes
 *     any whose attachmentId segment has no corresponding attachment row.
 *
 * Returns a summary JSON: { ok, pendingRowsDeleted, storageObjectsDeleted }.
 */

import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { runCleanupOrphans } from "@/lib/jobs/cleanup-orphans";
import { logger } from "@/lib/logger";

function getCronSecret(): string | undefined {
  return process.env.INTERNAL_CRON_SECRET;
}

function verifyAuth(request: NextRequest): boolean {
  const secret = getCronSecret();
  if (!secret) {
    logger.warn("[cleanup-orphans-cron] INTERNAL_CRON_SECRET not set — running in open mode");
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
    logger.warn("[cleanup-orphans-cron] missing x-vercel-cron header in production");
  }

  const now = new Date();
  logger.info({ now: now.toISOString() }, "[cleanup-orphans-cron] run started");

  try {
    const result = await runCleanupOrphans();
    logger.info(result, "[cleanup-orphans-cron] run complete");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "[cleanup-orphans-cron] run failed");
    Sentry.captureException(err, { tags: { cron: "cleanup-orphans" } });
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }
}
