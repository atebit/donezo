/**
 * app/api/cron/compact-positions/route.ts
 *
 * Compact-positions cron handler — fires weekly on Sunday at 05:00 UTC (see vercel.json).
 *
 * Logic per run:
 *  Resets group and task positions to integer-spaced values (1000-step) on boards
 *  updated in the last 7 days. Prevents POSITION_PRECISION_EXHAUSTED errors caused
 *  by repeated fractional bisection in lib/positions.ts.
 *
 * Returns a summary JSON: { ok, boardsProcessed, groupsCompacted, tasksCompacted }.
 */

import { NextResponse } from "next/server";
import { runCompactPositions } from "@/lib/jobs/compact-positions";
import { withCronAuth } from "@/lib/jobs/wrap-cron";

export const GET = withCronAuth(
  async (_req) => {
    const result = await runCompactPositions();
    return NextResponse.json({ ok: true, ...result });
  },
  { name: "compact-positions" },
);
