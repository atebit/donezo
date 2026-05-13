/**
 * Structured log event canon for Server Action wrappers
 * -------------------------------------------------------
 * Three event names are emitted on every call:
 *
 *   action.start   — logger.info  — immediately after the user is resolved
 *   action.success — logger.info  — when the handler returns successfully
 *   action.failure — logger.error — on every failure branch:
 *                      UNAUTHENTICATED, VALIDATION, known coded error, INTERNAL
 *
 * Fields by event:
 *   action.start   : { event, name, userId }           userId is null when unauthenticated
 *   action.success : { event, name, durationMs, userId }
 *   action.failure : { event, name, durationMs, userId, code, err? }
 *                      durationMs/userId/err are undefined for UNAUTHENTICATED (no user yet)
 *
 * UNAUTHENTICATED design choice: we emit action.failure (not action.start) so that
 * every denied request shows up in the failure stream and can be alerted on. There is
 * no PII risk because userId is null on that path.
 */

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type ActionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };

export function withUser<I, O>(
  handler: (ctx: ActionContext, input: I) => Promise<O>,
): (input: I) => Promise<ActionResult<O>> {
  return async (input: I) => {
    const start = performance.now();
    // TODO: callers should prefer named functions or `.bind({ name: "myAction" })`
    // so `name` is meaningful in logs rather than falling back to "anonymous".
    const name = handler.name || "anonymous";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logger.error(
        { event: "action.failure", name, userId: null, code: "UNAUTHENTICATED" },
        "action denied — unauthenticated",
      );
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required" } };
    }

    logger.info({ event: "action.start", name, userId: user.id }, "action start");

    try {
      const data = await handler({ supabase, userId: user.id }, input);
      logger.info(
        {
          event: "action.success",
          name,
          durationMs: Math.round(performance.now() - start),
          userId: user.id,
        },
        "action success",
      );
      return { ok: true, data };
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);

      if (err instanceof z.ZodError) {
        const first = err.issues[0];
        const fieldPath = first?.path.join(".");
        logger.error(
          { event: "action.failure", name, durationMs, userId: user.id, code: "VALIDATION", err },
          "action validation failure",
        );
        return {
          ok: false,
          error: {
            code: "VALIDATION",
            message: first?.message ?? "Invalid input",
            ...(fieldPath ? { field: fieldPath } : {}),
          },
        };
      }

      if (err && typeof err === "object" && "code" in err && "message" in err) {
        const code = (err as { code: string }).code;
        logger.error(
          { event: "action.failure", name, durationMs, userId: user.id, code, err },
          "action coded failure",
        );
        return { ok: false, error: err as { code: string; message: string; field?: string } };
      }

      logger.error(
        { event: "action.failure", name, durationMs, userId: user.id, code: "INTERNAL", err },
        "action threw",
      );
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(err, { extra: { action: name, userId: user.id } });
      }
      return { ok: false, error: { code: "INTERNAL", message: "Unexpected error" } };
    }
  };
}
