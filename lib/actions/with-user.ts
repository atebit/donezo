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
    const action = handler.name || "anonymous";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      logger.info({ action }, "action denied — unauthenticated");
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required" } };
    }
    try {
      const data = await handler({ supabase, userId: user.id }, input);
      logger.info(
        { action, durationMs: performance.now() - start, userId: user.id },
        "action complete",
      );
      return { ok: true, data };
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.issues[0];
        const fieldPath = first?.path.join(".");
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
        return { ok: false, error: err as { code: string; message: string; field?: string } };
      }
      logger.error({ err, action, userId: user.id }, "action threw");
      if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        Sentry.captureException(err, { extra: { action, userId: user.id } });
      }
      return { ok: false, error: { code: "INTERNAL", message: "Unexpected error" } };
    }
  };
}
