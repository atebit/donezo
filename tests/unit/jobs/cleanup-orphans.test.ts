/**
 * tests/unit/jobs/cleanup-orphans.test.ts
 *
 * Unit tests for lib/jobs/cleanup-orphans.ts (runCleanupOrphans).
 *
 * Coverage:
 *  - Returns counts from SQL RPC and storage operations.
 *  - RPC error: throws and captures to Sentry.
 *  - Storage list error: throws and captures to Sentry.
 *  - Attachment lookup error: throws and captures to Sentry.
 *  - Storage remove error: throws and captures to Sentry.
 *  - No objects in bucket → skips storage step.
 *  - Non-conforming object paths are skipped.
 *  - Objects whose attachmentId exists in attachment table are kept.
 *  - Objects whose attachmentId is absent from attachment table are deleted.
 *  - Structured logger calls happen (start, success, etc.).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be hoisted before imports of the module under test)
// ---------------------------------------------------------------------------

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockSentryCapture = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock("../../../lib/supabase/admin", () => ({
  adminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockSentryCapture,
}));

vi.mock("../../../lib/logger", () => ({
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

/** A valid UUID-v4-looking string for tests. */
const ATTACH_ID_1 = "11111111-1111-4111-8111-111111111111";
const ATTACH_ID_2 = "22222222-2222-4222-8222-222222222222";

function makeObjectName(attachId: string) {
  return `board-id/task-id/${attachId}/file.pdf`;
}

/** Minimal Supabase-chain stub returning a resolved promise. */
function chain(result: unknown) {
  const p = Promise.resolve(result);
  const c: Record<string, unknown> = {
    select: () => c,
    in: () => c,
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

describe("runCleanupOrphans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns zero counts when no storage objects exist", async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null });
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    const result = await runCleanupOrphans();

    expect(result.pendingRowsDeleted).toBe(3);
    expect(result.storageObjectsDeleted).toBe(0);
    expect(mockLoggerInfo).toHaveBeenCalled();
  });

  it("deletes orphan objects whose attachmentId has no attachment row", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const listMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ name: makeObjectName(ATTACH_ID_1) }, { name: makeObjectName(ATTACH_ID_2) }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null }); // second page → done

    const removeMock = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ list: listMock, remove: removeMock });

    // Only ATTACH_ID_1 exists in the attachment table.
    mockFrom.mockReturnValue(chain({ data: [{ id: ATTACH_ID_1 }], error: null }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    const result = await runCleanupOrphans();

    expect(result.storageObjectsDeleted).toBe(1);
    expect(removeMock).toHaveBeenCalledWith([makeObjectName(ATTACH_ID_2)]);
  });

  it("does not delete objects whose attachmentId exists in attachment table", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const listMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ name: makeObjectName(ATTACH_ID_1) }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const removeMock = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ list: listMock, remove: removeMock });

    // ATTACH_ID_1 exists in DB.
    mockFrom.mockReturnValue(chain({ data: [{ id: ATTACH_ID_1 }], error: null }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    const result = await runCleanupOrphans();

    expect(result.storageObjectsDeleted).toBe(0);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("skips objects with non-conforming paths (not enough segments)", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const listMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ name: "malformed/path" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const removeMock = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ list: listMock, remove: removeMock });

    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    const result = await runCleanupOrphans();

    expect(result.storageObjectsDeleted).toBe(0);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("throws and captures to Sentry when the RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "rpc error" } });

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    await expect(runCleanupOrphans()).rejects.toThrow("purge_orphan_attachments RPC failed");
    expect(mockSentryCapture).toHaveBeenCalledOnce();
  });

  it("throws and captures to Sentry when storage list fails", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: null, error: { message: "list error" } }),
    });

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    await expect(runCleanupOrphans()).rejects.toThrow("storage list failed");
    expect(mockSentryCapture).toHaveBeenCalledOnce();
  });

  it("throws and captures to Sentry when attachment lookup fails", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const listMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ name: makeObjectName(ATTACH_ID_1) }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    mockStorageFrom.mockReturnValue({ list: listMock });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "db error" } }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    await expect(runCleanupOrphans()).rejects.toThrow("attachment lookup failed");
    expect(mockSentryCapture).toHaveBeenCalledOnce();
  });

  it("throws and captures to Sentry when storage remove fails", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const listMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ name: makeObjectName(ATTACH_ID_1) }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    mockStorageFrom.mockReturnValue({
      list: listMock,
      remove: vi.fn().mockResolvedValue({ error: { message: "remove error" } }),
    });

    // No live rows → orphan
    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    await expect(runCleanupOrphans()).rejects.toThrow("storage remove failed");
    expect(mockSentryCapture).toHaveBeenCalledOnce();
  });

  it("logs info on success", async () => {
    mockRpc.mockResolvedValue({ data: 2, error: null });
    mockStorageFrom.mockReturnValue({
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const { runCleanupOrphans } = await import("@/lib/jobs/cleanup-orphans");
    await runCleanupOrphans();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ pendingRowsDeleted: 2 }),
      expect.any(String),
    );
  });
});
