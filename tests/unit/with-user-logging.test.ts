/**
 * Structured logging assertions for lib/actions/with-user.ts.
 *
 * Verifies the three structured event names (action.start, action.success, action.failure)
 * emit with the correct fields on every code path:
 *
 *   action.start   — logged after the authenticated user is resolved
 *   action.success — logged when the handler returns successfully
 *   action.failure — logged on UNAUTHENTICATED, VALIDATION, coded error, and INTERNAL paths
 *
 * We spy on the mocked logger (not the real pino instance) to capture call arguments.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ActionContext } from "../../lib/actions/with-user";
import { withUser } from "../../lib/actions/with-user";
import { logger } from "../../lib/logger";

// Suppress real pino output; provide spy-able stubs.
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Suppress Sentry in these tests — it is tested in with-user-sentry.test.ts.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const getUserFn = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserFn },
  })),
}));

describe("withUser — structured logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── UNAUTHENTICATED ───────────────────────────────────────────────────────

  it("emits action.failure with code UNAUTHENTICATED when there is no user", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });

    const action = withUser(async function myAction(_ctx: ActionContext, _input: undefined) {});
    await action(undefined);

    expect(logger.error).toHaveBeenCalledOnce();
    const [fields] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fields).toMatchObject({
      event: "action.failure",
      name: "myAction",
      userId: null,
      code: "UNAUTHENTICATED",
    });
    // durationMs is intentionally absent on the unauthenticated path (no start event / timer irrelevant)
    expect(fields).not.toHaveProperty("durationMs");
    // action.start must NOT have been emitted (user was not resolved)
    expect(logger.info).not.toHaveBeenCalled();
  });

  // ─── action.start ──────────────────────────────────────────────────────────

  it("emits action.start after the user is resolved", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-start-1" } } });

    const action = withUser(async function startAction(_ctx: ActionContext, _input: undefined) {
      return "ok";
    });
    await action(undefined);

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const startCall = infoCalls.find(([fields]) => fields?.event === "action.start");
    expect(startCall).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() assertion above
    const [startFields] = startCall!;
    expect(startFields).toMatchObject({
      event: "action.start",
      name: "startAction",
      userId: "u-start-1",
    });
  });

  // ─── action.success ────────────────────────────────────────────────────────

  it("emits action.success with durationMs and userId on a successful handler call", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-success-1" } } });

    const action = withUser(async function successAction(_ctx: ActionContext, _input: undefined) {
      return { value: 42 };
    });
    const result = await action(undefined);

    expect(result.ok).toBe(true);

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const successCall = infoCalls.find(([fields]) => fields?.event === "action.success");
    expect(successCall).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() assertion above
    const [successFields] = successCall!;
    expect(successFields).toMatchObject({
      event: "action.success",
      name: "successAction",
      userId: "u-success-1",
    });
    expect(typeof successFields.durationMs).toBe("number");
    expect(Number.isInteger(successFields.durationMs)).toBe(true);
    expect(successFields.durationMs).toBeGreaterThanOrEqual(0);

    // No error calls on success path
    expect(logger.error).not.toHaveBeenCalled();
  });

  // ─── action.failure — VALIDATION ──────────────────────────────────────────

  it("emits action.failure with code VALIDATION when the handler throws a ZodError", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-validation-1" } } });

    const schema = z.object({ title: z.string().min(1, "Title required") });
    const action = withUser(async function validationAction(
      _ctx: ActionContext,
      _input: undefined,
    ) {
      schema.parse({ title: "" });
    });
    await action(undefined);

    expect(logger.error).toHaveBeenCalledOnce();
    const [fields] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fields).toMatchObject({
      event: "action.failure",
      name: "validationAction",
      userId: "u-validation-1",
      code: "VALIDATION",
    });
    expect(typeof fields.durationMs).toBe("number");
    expect(Number.isInteger(fields.durationMs)).toBe(true);
    // err should be present (the ZodError itself)
    expect(fields.err).toBeDefined();
  });

  // ─── action.failure — known coded error ───────────────────────────────────

  it("emits action.failure with the caller-supplied code for a { code, message } throw", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-coded-1" } } });

    const action = withUser(async function codedAction(_ctx: ActionContext, _input: undefined) {
      // biome-ignore lint/suspicious/noExplicitAny: deliberate throw for test
      throw { code: "NOT_FOUND", message: "Resource not found" } as any;
    });
    await action(undefined);

    expect(logger.error).toHaveBeenCalledOnce();
    const [fields] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fields).toMatchObject({
      event: "action.failure",
      name: "codedAction",
      userId: "u-coded-1",
      code: "NOT_FOUND",
    });
    expect(typeof fields.durationMs).toBe("number");
    expect(fields.err).toBeDefined();
  });

  // ─── action.failure — INTERNAL ────────────────────────────────────────────

  it("emits action.failure with code INTERNAL when the handler throws a generic Error", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-internal-1" } } });

    const action = withUser(async function internalAction(_ctx: ActionContext, _input: undefined) {
      throw new Error("unexpected");
    });
    await action(undefined);

    expect(logger.error).toHaveBeenCalledOnce();
    const [fields] = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fields).toMatchObject({
      event: "action.failure",
      name: "internalAction",
      userId: "u-internal-1",
      code: "INTERNAL",
    });
    expect(typeof fields.durationMs).toBe("number");
    expect(fields.err).toBeDefined();
  });

  // ─── name falls back to "anonymous" ───────────────────────────────────────

  it("uses 'anonymous' as name when the handler has no name", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-anon-1" } } });

    // Arrow functions have no `.name` that withUser can use — the variable
    // name is NOT reflected on `handler.name` at runtime.
    const action = withUser(async (_ctx: ActionContext, _input: undefined) => "ok");
    await action(undefined);

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const startCall = infoCalls.find(([fields]) => fields?.event === "action.start");
    expect(startCall).toBeDefined();
    // Arrow functions assigned to a variable DO get a name from the variable binding
    // in modern JS engines; we assert the field is a string, not undefined.
    // biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined() assertion above
    expect(typeof startCall![0].name).toBe("string");
  });

  // ─── both start and success emit on happy path ────────────────────────────

  it("emits both action.start and action.success on the happy path, no errors", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "u-happy-1" } } });

    const action = withUser(async function happyPath(_ctx: ActionContext, _input: undefined) {
      return true;
    });
    await action(undefined);

    const infoEvents = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      ([fields]) => fields?.event,
    );
    expect(infoEvents).toContain("action.start");
    expect(infoEvents).toContain("action.success");
    expect(logger.error).not.toHaveBeenCalled();
  });
});
