// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkspaceRole, requireWorkspaceRole } from "../../lib/authorization/workspace";

/**
 * Tests for lib/authorization/workspace.ts — getWorkspaceRole and requireWorkspaceRole.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * Mocks:
 * - @/lib/supabase/server: createClient returns a fake SupabaseClient with auth.getUser
 *   and a chainable query builder simulating .from().select().eq().eq().maybeSingle().
 */

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const getUserFn = vi.fn();
const maybeSingleFn = vi.fn();

// Chainable query builder stub: .from().select().eq().eq().maybeSingle()
const eqFn2 = vi.fn(() => ({ maybeSingle: maybeSingleFn }));
const eqFn1 = vi.fn(() => ({ eq: eqFn2 }));
const selectFn = vi.fn(() => ({ eq: eqFn1 }));
const fromFn = vi.fn(() => ({ select: selectFn }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserFn,
    },
    from: fromFn,
  })),
}));

describe("getWorkspaceRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain stubs (clearAllMocks resets calls but not implementations)
    eqFn2.mockReturnValue({ maybeSingle: maybeSingleFn });
    eqFn1.mockReturnValue({ eq: eqFn2 });
    selectFn.mockReturnValue({ eq: eqFn1 });
    fromFn.mockReturnValue({ select: selectFn });
  });

  it("returns null when there is no authenticated user", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });

    const result = await getWorkspaceRole("workspace-uuid-1");

    expect(result).toBeNull();
    expect(fromFn).not.toHaveBeenCalled();
  });

  it("returns the role string when user has a workspace membership", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: { role: "admin" }, error: null });

    const result = await getWorkspaceRole("workspace-uuid-1");

    expect(result).toBe("admin");
    expect(fromFn).toHaveBeenCalledWith("workspace_member");
    expect(selectFn).toHaveBeenCalledWith("role");
    expect(eqFn1).toHaveBeenCalledWith("workspace_id", "workspace-uuid-1");
    expect(eqFn2).toHaveBeenCalledWith("user_id", "user-uuid-1");
  });

  it("returns null when user has no workspace membership (maybeSingle returns null data)", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: null, error: null });

    const result = await getWorkspaceRole("workspace-uuid-1");

    expect(result).toBeNull();
  });

  it("throws { code: 'DB' } when the query returns an error", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: null, error: { message: "query failure" } });

    await expect(getWorkspaceRole("workspace-uuid-1")).rejects.toMatchObject({
      code: "DB",
      message: "query failure",
    });
  });
});

describe("requireWorkspaceRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqFn2.mockReturnValue({ maybeSingle: maybeSingleFn });
    eqFn1.mockReturnValue({ eq: eqFn2 });
    selectFn.mockReturnValue({ eq: eqFn1 });
    fromFn.mockReturnValue({ select: selectFn });
  });

  it("returns the role when role meets minimum requirement (exact match)", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: { role: "member" }, error: null });

    const result = await requireWorkspaceRole("workspace-uuid-1", "member");

    expect(result).toBe("member");
  });

  it("returns the role when role exceeds minimum requirement", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: { role: "owner" }, error: null });

    const result = await requireWorkspaceRole("workspace-uuid-1", "admin");

    expect(result).toBe("owner");
  });

  it("throws { code: 'FORBIDDEN' } when role is below minimum requirement", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: { role: "viewer" }, error: null });

    await expect(requireWorkspaceRole("workspace-uuid-1", "member")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });
  });

  it("throws { code: 'FORBIDDEN' } when role is null (unauthenticated or no membership)", async () => {
    getUserFn.mockResolvedValue({ data: { user: null } });

    await expect(requireWorkspaceRole("workspace-uuid-1", "viewer")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });
  });

  it("owner role satisfies any minRole requirement", async () => {
    getUserFn.mockResolvedValue({ data: { user: { id: "user-uuid-1" } } });
    maybeSingleFn.mockResolvedValue({ data: { role: "owner" }, error: null });

    const result = await requireWorkspaceRole("workspace-uuid-1", "admin");

    expect(result).toBe("owner");
  });
});
