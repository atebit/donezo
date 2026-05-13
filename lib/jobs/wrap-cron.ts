/**
 * lib/jobs/wrap-cron.ts
 *
 * Higher-order wrapper for cron route handlers.
 *
 * Responsibilities:
 *   1. Bearer-token authentication via timing-safe compare against
 *      INTERNAL_CRON_SECRET. Falls back to open mode (warning) when the
 *      secret is not configured (dev/test).
 *   2. Structured log events: cron.start, cron.success, cron.failure.
 *   3. Sentry.captureException on unhandled handler throws.
 *
 * Usage:
 *   export const GET = withCronAuth(async (req) => {
 *     // ... business logic ...
 *     return NextResponse.json({ ok: true, ... });
 *   }, { name: "my-cron-name" });
 */

import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type CronHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Performs a timing-safe Bearer token comparison against INTERNAL_CRON_SECRET.
 *
 * Returns true (open mode) when the secret is not configured — emits a warning.
 * Returns false when auth fails.
 * Returns true when the token matches.
 */
function verifyCronAuth(req: NextRequest, cronName: string): boolean {
  const secret = env.INTERNAL_CRON_SECRET;
  if (!secret) {
    logger.warn(
      { cron: cronName },
      `[${cronName}] INTERNAL_CRON_SECRET not set — running in open mode`,
    );
    return true;
  }
  const authHeader = req.headers.get("authorization");
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

/**
 * Wraps a cron route handler with auth, structured logging, and Sentry capture.
 */
export function withCronAuth(handler: CronHandler, opts: { name: string }): CronHandler {
  const { name } = opts;

  return async (req: NextRequest): Promise<NextResponse> => {
    if (!verifyCronAuth(req, name)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    logger.info({ event: "cron.start", cron: name }, "cron start");

    try {
      const res = await handler(req);
      const durationMs = Date.now() - startedAt;
      logger.info({ event: "cron.success", cron: name, durationMs }, "cron success");
      return res;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      logger.error(
        {
          event: "cron.failure",
          cron: name,
          durationMs,
          err: err instanceof Error ? err.message : String(err),
        },
        "cron failure",
      );
      Sentry.captureException(err, { tags: { cron: name } });
      return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
  };
}
