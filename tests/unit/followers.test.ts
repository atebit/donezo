/**
 * tests/unit/followers.test.ts
 *
 * Unit tests for lib/notifications/followers.ts.
 *
 * Coverage:
 *   - ensureFollower: calls adminClient upsert; handles errors gracefully.
 *   - removeFollower: calls adminClient delete; handles errors gracefully.
 *   - getFollowers: returns user_id list; returns [] on error.
 *   - autoFollowOnComment: delegates to ensureFollower.
 *   - autoFollowOnMention: delegates to ensureFollower.
 *   - autoFollowOnAssign: delegates to ensureFollower.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock adminClient
// ---------------------------------------------------------------------------

const mockUpsert = vi.fn().mockResolvedValue({ error: null });

const mockFrom = vi.fn();
const mockAdminClient = vi.fn(() => ({ from: mockFrom }));

vi.mock("../../lib/supabase/admin", () => ({
  adminClient: () => mockAdminClient(),
}));

vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const TASK_ID = "tttt0000-0000-0000-0000-000000000001";
const USER_A = "uuuu0000-0000-0000-0000-000000000001";
const USER_B = "uuuu0000-0000-0000-0000-000000000002";

function makeSelectChain(
  rows: Array<{ user_id: string }>,
  error: null | { message: string } = null,
) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: rows, error }),
  };
}

// ---------------------------------------------------------------------------
// ensureFollower
// ---------------------------------------------------------------------------

describe("ensureFollower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls adminClient().from('task_follower').upsert() with correct args", async () => {
    const upsertChain = {
      upsert: mockUpsert,
    };
    mockFrom.mockReturnValue(upsertChain);

    const { ensureFollower } = await import("../../lib/notifications/followers");
    await ensureFollower(TASK_ID, USER_A);

    expect(mockFrom).toHaveBeenCalledWith("task_follower");
    expect(mockUpsert).toHaveBeenCalledWith(
      { task_id: TASK_ID, user_id: USER_A },
      { onConflict: "task_id,user_id", ignoreDuplicates: true },
    );
  });

  it("logs a warning but does not throw when upsert returns an error", async () => {
    const { logger } = await import("../../lib/logger");
    const upsertChain = {
      upsert: vi.fn().mockResolvedValue({ error: { message: "conflict" } }),
    };
    mockFrom.mockReturnValue(upsertChain);

    const { ensureFollower } = await import("../../lib/notifications/followers");
    await expect(ensureFollower(TASK_ID, USER_A)).resolves.toBeUndefined();
    expect((logger.warn as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not throw when upsert throws unexpectedly", async () => {
    const upsertChain = {
      upsert: vi.fn().mockRejectedValue(new Error("network failure")),
    };
    mockFrom.mockReturnValue(upsertChain);

    const { ensureFollower } = await import("../../lib/notifications/followers");
    await expect(ensureFollower(TASK_ID, USER_A)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// removeFollower
// ---------------------------------------------------------------------------

describe("removeFollower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls adminClient().from('task_follower').delete().eq().eq()", async () => {
    const eqFn2 = vi.fn().mockResolvedValue({ error: null });
    const eqFn1 = vi.fn().mockReturnValue({ eq: eqFn2 });
    const deleteChain = {
      delete: vi.fn().mockReturnValue({ eq: eqFn1 }),
    };
    mockFrom.mockReturnValue(deleteChain);

    const { removeFollower } = await import("../../lib/notifications/followers");
    await removeFollower(TASK_ID, USER_A);

    expect(mockFrom).toHaveBeenCalledWith("task_follower");
    expect(deleteChain.delete).toHaveBeenCalledOnce();
    expect(eqFn1).toHaveBeenCalledWith("task_id", TASK_ID);
    expect(eqFn2).toHaveBeenCalledWith("user_id", USER_A);
  });

  it("does not throw when delete returns an error", async () => {
    const eqFn2 = vi.fn().mockResolvedValue({ error: { message: "not found" } });
    const eqFn1 = vi.fn().mockReturnValue({ eq: eqFn2 });
    const deleteChain = { delete: vi.fn().mockReturnValue({ eq: eqFn1 }) };
    mockFrom.mockReturnValue(deleteChain);

    const { removeFollower } = await import("../../lib/notifications/followers");
    await expect(removeFollower(TASK_ID, USER_A)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getFollowers
// ---------------------------------------------------------------------------

describe("getFollowers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user_id list from the supabase query result", async () => {
    const mockSupabase = {
      from: vi.fn(() => makeSelectChain([{ user_id: USER_A }, { user_id: USER_B }])),
    };

    const { getFollowers } = await import("../../lib/notifications/followers");
    const result = await getFollowers(TASK_ID, mockSupabase as never);

    expect(result).toEqual([USER_A, USER_B]);
    expect(mockSupabase.from).toHaveBeenCalledWith("task_follower");
  });

  it("returns [] on DB error (graceful fallback)", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      })),
    };

    const { getFollowers } = await import("../../lib/notifications/followers");
    const result = await getFollowers(TASK_ID, mockSupabase as never);

    expect(result).toEqual([]);
  });

  it("returns [] on unexpected throw (graceful fallback)", async () => {
    const mockSupabase = {
      from: vi.fn(() => {
        throw new Error("unexpected");
      }),
    };

    const { getFollowers } = await import("../../lib/notifications/followers");
    const result = await getFollowers(TASK_ID, mockSupabase as never);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Auto-follow helpers (thin wrappers over ensureFollower)
// ---------------------------------------------------------------------------

describe("autoFollowOnComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ensureFollower with taskId and authorId", async () => {
    const upsertChain = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(upsertChain);

    const { autoFollowOnComment } = await import("../../lib/notifications/followers");
    await autoFollowOnComment(TASK_ID, USER_A);

    expect(mockFrom).toHaveBeenCalledWith("task_follower");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      { task_id: TASK_ID, user_id: USER_A },
      expect.any(Object),
    );
  });
});

describe("autoFollowOnMention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ensureFollower with taskId and mentionedUserId", async () => {
    const upsertChain = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(upsertChain);

    const { autoFollowOnMention } = await import("../../lib/notifications/followers");
    await autoFollowOnMention(TASK_ID, USER_B);

    expect(mockFrom).toHaveBeenCalledWith("task_follower");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      { task_id: TASK_ID, user_id: USER_B },
      expect.any(Object),
    );
  });
});

describe("autoFollowOnAssign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ensureFollower with taskId and assignedUserId", async () => {
    const upsertChain = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockReturnValue(upsertChain);

    const { autoFollowOnAssign } = await import("../../lib/notifications/followers");
    await autoFollowOnAssign(TASK_ID, USER_A);

    expect(mockFrom).toHaveBeenCalledWith("task_follower");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      { task_id: TASK_ID, user_id: USER_A },
      expect.any(Object),
    );
  });
});
