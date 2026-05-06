// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import type { ActionResult } from "../../lib/actions/with-user";
import { withUser } from "../../lib/actions/with-user";

/**
 * Tests for lib/actions/with-user.ts — withUser server-action helper stub.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * lib/logger.ts has a server-only guard (throws if window is defined).
 * In Vitest's Node environment, `window` is undefined, so the guard passes.
 */

describe("withUser", () => {
  it("passes the synthetic user to the handler context", async () => {
    let capturedUserId: string | undefined;
    let capturedUserEmail: string | undefined;

    const action = withUser(async ({ user }, _input: undefined) => {
      capturedUserId = user.id;
      capturedUserEmail = user.email;
      return { ok: true, data: "success" } satisfies ActionResult<string>;
    });

    const result = await action(undefined);

    expect(result.ok).toBe(true);
    expect(capturedUserId).toBe("00000000-0000-0000-0000-000000000000");
    expect(capturedUserEmail).toBe("dev@donezo.local");
  });

  it("returns ok: true with the handler's return value", async () => {
    const action = withUser(async (_ctx, input: { value: number }) => {
      return { ok: true, data: input.value * 2 } satisfies ActionResult<number>;
    });

    const result = await action({ value: 21 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(42);
    }
  });

  it("maps a thrown error to ok: false with code INTERNAL", async () => {
    const action = withUser(async (_ctx, _input: undefined) => {
      throw new Error("boom");
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.message).toBe("Unexpected error");
    }
  });

  it("returns ok: false when the handler returns an error result", async () => {
    const action = withUser(async (_ctx, _input: undefined): Promise<ActionResult<never>> => {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "Resource not found", field: "id" },
      };
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.field).toBe("id");
    }
  });
});
