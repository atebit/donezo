// TODO epic 03: replace SYNTHETIC_USER with real Supabase auth user. The all-zeros uuid will collide with gen_random_uuid() inserts.
import { logger } from "@/lib/logger";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };

const SYNTHETIC_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@donezo.local",
};

export function withUser<I, O>(
  handler: (ctx: { user: { id: string; email: string } }, input: I) => Promise<ActionResult<O>>,
): (input: I) => Promise<ActionResult<O>> {
  return async (input: I) => {
    const start = performance.now();
    const action = handler.name || "anonymous";
    try {
      const result = await handler({ user: SYNTHETIC_USER }, input);
      logger.info({ action, durationMs: performance.now() - start }, "action complete");
      return result;
    } catch (err) {
      logger.error({ err, action }, "action threw");
      return { ok: false, error: { code: "INTERNAL", message: "Unexpected error" } };
    }
  };
}
