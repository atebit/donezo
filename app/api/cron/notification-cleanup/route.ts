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
 * Uses the admin (service-role) client — no user context; bypasses RLS.
 * This is intentional: cleanup is a system-level operation.
 */

import { NextResponse } from "next/server";
import { withCronAuth } from "@/lib/jobs/wrap-cron";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: service-role for system-level cleanup.
import { adminClient } from "@/lib/supabase/admin";

export const GET = withCronAuth(
  async (_req) => {
    const admin = adminClient();

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
  },
  { name: "notification-cleanup" },
);
