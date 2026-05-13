/**
 * tests/unit/jobs/purge-trash.test.ts
 *
 * Unit tests for lib/jobs/purge-trash.ts (runPurgeTrash).
 *
 * Coverage:
 *  - Returns { boardsDeleted, commentsDeleted } summary.
 *  - commentsDeleted is always 0 (comment has no deleted_at column).
 *  - boardsDeleted matches the count returned by the delete query.
 *  - null count from DB is treated as 0.
 *  - DB error on board delete: throws and captures to Sentry.
 *  - Structured log calls happen.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockSentryCapture = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../../../lib/supabase/admin", () => ({
  adminClient: () => ({ from: mockFrom }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockSentryCapture,
}));

vi.mock("../../../lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Supabase delete chain stub.
 * Resolves with `result` when awaited.
 */
function makeDeleteChain(result: { count: number | null; error: unknown }) {
  const p = Promise.resolve(result);
  const c: Record<string, unknown> = {
    delete: () => c,
    not: () => c,
    lt: () => p,
    // biome-ignore lint/suspicious/noThenProperty: required for Supabase query chain mock
    then: (p as Promise<unknown>).then.bind(p),
    catch: (p as Promise<unknown>).catch.bind(p),
    finally: (p as Promise<unknown>).finally.bind(p),
  };
  return c;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPurgeTrash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns boardsDeleted count from the delete query", async () => {
    mockFrom.mockReturnValue(makeDeleteChain({ count: 5, error: null }));

    const { runPurgeTrash } = await import("@/lib/jobs/purge-trash");
    const result = await runPurgeTrash();

    expect(result.boardsDeleted).toBe(5);
    expect(result.commentsDeleted).toBe(0);
  });

  it("treats null count as 0", async () => {
    mockFrom.mockReturnValue(makeDeleteChain({ count: null, error: null }));

    const { runPurgeTrash } = await import("@/lib/jobs/purge-trash");
    const result = await runPurgeTrash();

    expect(result.boardsDeleted).toBe(0);
  });

  it("returns 0 boardsDeleted when no rows matched the cutoff", async () => {
    mockFrom.mockReturnValue(makeDeleteChain({ count: 0, error: null }));

    const { runPurgeTrash } = await import("@/lib/jobs/purge-trash");
    const result = await runPurgeTrash();

    expect(result.boardsDeleted).toBe(0);
  });

  it("commentsDeleted is always 0 (comment has no deleted_at column)", async () => {
    mockFrom.mockReturnValue(makeDeleteChain({ count: 10, error: null }));

    const { runPurgeTrash } = await import("@/lib/jobs/purge-trash");
    const result = await runPurgeTrash();

    expect(result.commentsDeleted).toBe(0);
  });

  it("throws and captures to Sentry when board delete fails", async () => {
    mockFrom.mockReturnValue(
      makeDeleteChain({ count: null, error: { message: "DB connection failed" } }),
    );

    const { runPurgeTrash } = await import("@/lib/jobs/purge-trash");
    await expect(runPurgeTrash()).rejects.toThrow("purge-trash board delete failed");
    expect(mockSentryCapture).toHaveBeenCalledOnce();
    expect(mockSentryCapture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { job: "purge-trash" } }),
    );
  });

  it("logs info with boardsDeleted count on success", async () => {
    mockFrom.mockReturnValue(makeDeleteChain({ count: 3, error: null }));

    const { runPurgeTrash } = await import("@/lib/jobs/purge-trash");
    await runPurgeTrash();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ boardsDeleted: 3 }),
      expect.any(String),
    );
  });
});
