/**
 * Tests for the Sentry capture integration in lib/actions/with-user.ts.
 *
 * Verifies that:
 *   - `captureException` is called for INTERNAL errors (plain Error throws).
 *   - `captureException` is NOT called for VALIDATION, coded { code, message } errors,
 *     or when the user is unauthenticated.
 *
 * The env var NEXT_PUBLIC_SENTRY_DSN must be set to a truthy value for the
 * gate inside with-user.ts to pass. Tests set it via vi.stubEnv.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ActionContext } from "../../lib/actions/with-user";
import { withUser } from "../../lib/actions/with-user";

// vi.hoisted runs before vi.mock hoisting — safe to reference in factory.
const { captureExceptionMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
}));

// Mock @sentry/nextjs before anything imports it.
vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

// Suppress logger output in tests.
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const getUserFn = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserFn,
    },
  })),
}));

describe("withUser Sentry integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enable Sentry gate (the env-var guard in with-user.ts).
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example@sentry.io/1");
    getUserFn.mockResolvedValue({ data: { user: { id: "u-sentry-1" } } });
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("calls captureException when the handler throws a plain Error (INTERNAL branch)", async () => {
    const boom = new Error("unexpected");
    const action = withUser(async (_ctx, _input: undefined) => {
      throw boom;
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL");
    expect(captureExceptionMock).toHaveBeenCalledOnce();
    expect(captureExceptionMock).toHaveBeenCalledWith(boom, {
      extra: { action: expect.any(String), userId: "u-sentry-1" },
    });
  });

  it("does NOT call captureException for ZodError (VALIDATION branch)", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const action = withUser(async (_ctx, _input: undefined) => {
      schema.parse({ name: "" });
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("does NOT call captureException for coded { code, message } errors (pass-through branch)", async () => {
    const action = withUser(async (_ctx, _input: undefined) => {
      // biome-ignore lint/suspicious/noExplicitAny: deliberate throw for test
      throw { code: "NOT_FOUND", message: "Not found" } as any;
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("does NOT call captureException when user is not authenticated", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });
    const handler = vi.fn();

    const action = withUser(handler as (ctx: ActionContext, input: undefined) => Promise<void>);
    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("does NOT call captureException when NEXT_PUBLIC_SENTRY_DSN is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const action = withUser(async (_ctx, _input: undefined) => {
      throw new Error("gate off");
    });

    const result = await action(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INTERNAL");
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
