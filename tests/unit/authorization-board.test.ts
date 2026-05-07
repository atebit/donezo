// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBoardRole, requireBoardRole } from "../../lib/authorization/board";

/**
 * Tests for lib/authorization/board.ts — getBoardRole and requireBoardRole.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * Mocks:
 * - @/lib/supabase/server: createClient returns a fake SupabaseClient with auth.getUser and rpc.
 */

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const getUserFn = vi.fn();
const rpcFn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserFn,
    },
    rpc: rpcFn,
  })),
}));

describe("getBoardRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when there is no authenticated user", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });

    const result = await getBoardRole("board-uuid-1");

    expect(result).toBeNull();
    expect(rpcFn).not.toHaveBeenCalled();
  });

  it("returns the role string when user has a board role", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: "member", error: null });

    const result = await getBoardRole("board-uuid-1");

    expect(result).toBe("member");
    expect(rpcFn).toHaveBeenCalledWith("role_for_board", {
      p_board_id: "board-uuid-1",
      p_user_id: "user-uuid-1",
    });
  });

  it("returns null when rpc returns null (user has no role)", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: null, error: null });

    const result = await getBoardRole("board-uuid-1");

    expect(result).toBeNull();
  });

  it("throws { code: 'DB' } when rpc returns an error", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: null, error: { message: "rpc failure" } });

    await expect(getBoardRole("board-uuid-1")).rejects.toMatchObject({
      code: "DB",
      message: "rpc failure",
    });
  });
});

describe("requireBoardRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the role when role meets minimum requirement (exact match)", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: "member", error: null });

    const result = await requireBoardRole("board-uuid-1", "member");

    expect(result).toBe("member");
  });

  it("returns the role when role exceeds minimum requirement", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: "admin", error: null });

    const result = await requireBoardRole("board-uuid-1", "member");

    expect(result).toBe("admin");
  });

  it("throws { code: 'FORBIDDEN' } when role is below minimum requirement", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: "viewer", error: null });

    await expect(requireBoardRole("board-uuid-1", "admin")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });
  });

  it("throws { code: 'FORBIDDEN' } when role is null (unauthenticated or no membership)", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });

    await expect(requireBoardRole("board-uuid-1", "viewer")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });
  });

  it("owner role satisfies any minRole requirement", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    rpcFn.mockResolvedValue({ data: "owner", error: null });

    const result = await requireBoardRole("board-uuid-1", "admin");

    expect(result).toBe("owner");
  });
});
