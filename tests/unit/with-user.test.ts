// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ActionContext } from "../../lib/actions/with-user";
import { withUser } from "../../lib/actions/with-user";

/**
 * Tests for lib/actions/with-user.ts — rewritten for the Q14/Q15/Q26/Q46/Q47 contract.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * Mocks:
 * - @/lib/supabase/server: createClient returns a fake SupabaseClient with auth.getUser.
 * - @/lib/logger: no-op to avoid pino + server-only guard.
 */

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// We mock the module; each test configures getUserFn behaviour.
const getUserFn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserFn,
    },
  })),
}));

describe("withUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test A: unauthenticated — getUser returns no user
  it("A: returns UNAUTHENTICATED and does not call handler when getUser returns no user", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });
    const handler = vi.fn();

    const action = withUser(handler as (ctx: ActionContext, input: undefined) => Promise<void>);
    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNAUTHENTICATED");
      expect(result.error.message).toBe("Sign in required");
    }
    expect(handler).not.toHaveBeenCalled();
  });

  // Test B: authenticated — handler is called with context and input, result is { ok: true, data }
  it("B: calls handler with { supabase, userId } and wraps return value in { ok: true, data }", async () => {
    const fakeUser = { id: "u-1" };
    getUserFn.mockResolvedValue({ data: { user: fakeUser } });

    let capturedCtx: ActionContext | undefined;
    let capturedInput: string | undefined;

    const action = withUser(async (ctx, input: string) => {
      capturedCtx = ctx;
      capturedInput = input;
      return { echo: input };
    });

    const result = await action("hello");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ echo: "hello" });
    }
    expect(capturedCtx?.userId).toBe("u-1");
    expect(capturedCtx?.supabase).toBeDefined();
    expect(capturedInput).toBe("hello");
  });

  // Test C: handler throws plain Error → INTERNAL
  it("C: maps a thrown plain Error to { ok: false, error: { code: 'INTERNAL' } }", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-1" } } });

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

  // Test D: handler throws { code, message } shaped object → returned as-is
  it("D: passes through a { code, message } shaped throw as ok: false error", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-1" } } });

    const action = withUser(async (_ctx, _input: undefined) => {
      // biome-ignore lint/suspicious/noExplicitAny: deliberate throw for test
      throw { code: "NOT_FOUND", message: "Resource not found" } as any;
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("Resource not found");
    }
  });

  // Test E: handler throws ZodError → VALIDATION with message and field
  it("E: maps a ZodError throw to { ok: false, error: { code: 'VALIDATION', message, field } }", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-1" } } });

    const schema = z.object({ name: z.string().min(1, "Name is required.") });

    const action = withUser(async (_ctx, _input: undefined) => {
      schema.parse({ name: "" });
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.message).toBe("Name is required.");
      expect(result.error.field).toBe("name");
    }
  });
});
