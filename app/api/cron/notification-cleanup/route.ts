/**
 * app/api/cron/notification-cleanup/route.ts
 *
 * Daily cron that hard-deletes old notification rows.
 *
 * Schedule: daily at 03:00 UTC — `0 3 * * *` (see vercel.json).
 *
 * Deletion policy (per Q9):
 *   - Rows where read_at < now() - 90 days  (read and old)
 *   - Rows where created_at < now() - 365 days  (any unread older than a year)
 *
 * Authentication:
 *   - Authorization: Bearer ${INTERNAL_CRON_SECRET}  (timing-safe compare)
 *   - x-vercel-cron: 1  (sanity check only; not a security boundary)
 *
 * Uses the admin (service-role) client — no user context; bypasses RLS.
 * This is intentional: cleanup is a system-level operation.
 */

import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role for system-level cleanup.
import { adminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyAuth(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) {
    // In dev / test the secret may be unset — allow open access with a warning.
    logger.warn("[notification-cleanup] INTERNAL_CRON_SECRET not set — running in open mode");
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
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronHeader = request.headers.get("x-vercel-cron");
  // Sanity check — not a security boundary (Bearer token is the real auth).
  if (process.env.NODE_ENV === "production" && cronHeader !== "1") {
    logger.warn("[notification-cleanup] missing x-vercel-cron header in production");
  }

  const admin = adminClient();

  logger.info("[notification-cleanup] run started");

  // Delete read notifications older than 90 days.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: readDeleted, error: readError } = await admin
    .from("notification")
    .delete({ count: "exact" })
    .not("read_at", "is", null)
    .lt("read_at", ninetyDaysAgo);

  if (readError) {
    logger.error({ error: readError }, "[notification-cleanup] failed to delete old read rows");
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }

  // Delete any notification older than 365 days (regardless of read status).
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { count: oldDeleted, error: oldError } = await admin
    .from("notification")
    .delete({ count: "exact" })
    .lt("created_at", oneYearAgo);

  if (oldError) {
    logger.error({ error: oldError }, "[notification-cleanup] failed to delete year-old rows");
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }

  const totalDeleted = (readDeleted ?? 0) + (oldDeleted ?? 0);
  logger.info(
    { readDeleted: readDeleted ?? 0, oldDeleted: oldDeleted ?? 0, totalDeleted },
    "[notification-cleanup] run complete",
  );

  return NextResponse.json({
    ok: true,
    readDeleted: readDeleted ?? 0,
    oldDeleted: oldDeleted ?? 0,
    totalDeleted,
  });
}
