/**
 * tests/unit/jobs/wrap-cron.test.ts
 *
 * Unit tests for lib/jobs/wrap-cron.ts (withCronAuth).
 *
 * Coverage:
 *  - Returns 401 when Authorization header is missing.
 *  - Returns 401 when bearer token mismatches INTERNAL_CRON_SECRET.
 *  - Returns 200 with the handler's response when auth succeeds.
 *  - Emits cron.start with { cron: name } before the handler runs.
 *  - Emits cron.success with { cron, durationMs } after handler resolves.
 *  - Emits cron.failure with { cron, durationMs, err } when handler throws.
 *  - Calls Sentry.captureException with { tags: { cron: name } } on throw.
 *  - Allows open mode (no auth header required) when INTERNAL_CRON_SECRET is not set.
 */

import { type NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be hoisted before imports of the module under test)
// ---------------------------------------------------------------------------

const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = "supersecretcrontoken123456789012"; // >= 32 chars

/**
 * Build a minimal NextRequest with the given Authorization header.
 */
function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("authorization", authHeader);
  }
  return new Request("http://localhost/api/cron/test", { headers }) as unknown as NextRequest;
}

/**
 * A handler that returns 200 with a body.
 */
const successHandler = vi.fn(async (_req: NextRequest) => {
  return NextResponse.json({ ok: true, result: "done" });
});

/**
 * A handler that throws.
 */
const throwingHandler = vi.fn(async (_req: NextRequest): Promise<NextResponse> => {
  throw new Error("boom");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withCronAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default: secret is set.
    process.env.INTERNAL_CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.INTERNAL_CRON_SECRET;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "test-cron" });
    const req = makeRequest(); // no auth header

    const res = await wrapped(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(successHandler).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token mismatches INTERNAL_CRON_SECRET", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "test-cron" });
    const req = makeRequest("Bearer wrong-token-that-is-not-the-secret");

    const res = await wrapped(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(successHandler).not.toHaveBeenCalled();
  });

  it("returns the handler's response when auth succeeds", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "test-cron" });
    const req = makeRequest(`Bearer ${CRON_SECRET}`);

    const res = await wrapped(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, result: "done" });
    expect(successHandler).toHaveBeenCalledOnce();
  });

  it("emits cron.start with { cron: name } before handler runs", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "my-cron" });
    const req = makeRequest(`Bearer ${CRON_SECRET}`);

    await wrapped(req);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ event: "cron.start", cron: "my-cron" }),
      expect.any(String),
    );
  });

  it("emits cron.success with { cron, durationMs } after handler resolves", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "my-cron" });
    const req = makeRequest(`Bearer ${CRON_SECRET}`);

    await wrapped(req);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cron.success",
        cron: "my-cron",
        durationMs: expect.any(Number),
      }),
      expect.any(String),
    );
  });

  it("emits cron.failure with { cron, durationMs, err } when handler throws", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(throwingHandler, { name: "my-cron" });
    const req = makeRequest(`Bearer ${CRON_SECRET}`);

    const res = await wrapped(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "internal" });

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "cron.failure",
        cron: "my-cron",
        durationMs: expect.any(Number),
        err: "boom",
      }),
      expect.any(String),
    );
  });

  it("calls Sentry.captureException with { tags: { cron: name } } on handler throw", async () => {
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(throwingHandler, { name: "my-cron" });
    const req = makeRequest(`Bearer ${CRON_SECRET}`);

    await wrapped(req);

    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { cron: "my-cron" } }),
    );
  });

  it("allows open mode when INTERNAL_CRON_SECRET is not set (no auth required)", async () => {
    delete process.env.INTERNAL_CRON_SECRET;
    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "test-cron" });
    const req = makeRequest(); // no auth header — should still pass in open mode

    const res = await wrapped(req);

    expect(res.status).toBe(200);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ cron: "test-cron" }),
      expect.stringContaining("open mode"),
    );
  });

  it("cron.start is logged before cron.success (ordering)", async () => {
    const callOrder: string[] = [];
    mockLoggerInfo.mockImplementation((obj: Record<string, unknown>) => {
      if (typeof obj === "object" && obj !== null && "event" in obj) {
        callOrder.push(obj.event as string);
      }
    });

    const { withCronAuth } = await import("@/lib/jobs/wrap-cron");
    const wrapped = withCronAuth(successHandler, { name: "order-cron" });
    const req = makeRequest(`Bearer ${CRON_SECRET}`);

    await wrapped(req);

    const startIdx = callOrder.indexOf("cron.start");
    const successIdx = callOrder.indexOf("cron.success");
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(successIdx).toBeGreaterThan(startIdx);
  });
});
