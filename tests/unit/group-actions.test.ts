import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written here so the epic 15 executor can wire them without changes.
 *
 * Approach:
 * - Mock `lib/supabase/server` so no real Supabase client is constructed.
 * - Mock `lib/authorization` so `requireBoardRole` can be controlled per test.
 * - Mock `lib/activity` so `logActivity` calls can be asserted / counted.
 * - All DB interactions go through the mock Supabase builder chain.
 */

// ---------------------------------------------------------------------------
// Shared mock infrastructure
// ---------------------------------------------------------------------------

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/activity", () => ({ logActivity: mockLogActivity }));

const mockRequireBoardRole = vi.fn().mockResolvedValue("member");
vi.mock("../../lib/authorization", () => ({
  requireBoardRole: mockRequireBoardRole,
  requireWorkspaceRole: vi.fn().mockResolvedValue("owner"),
}));

/** Minimal chainable Supabase mock. Each call to `supabaseChain()` returns a
 *  fresh builder that records method calls and resolves with `resolveWith`. */
function makeSupabaseChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "is",
    "in",
    "order",
    "maybeSingle",
    "single",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Terminal methods that actually resolve.
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  return chain;
}

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11" } },
});

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Helper: re-import actions fresh each test (avoids module cache issues)
// ---------------------------------------------------------------------------

async function getActions() {
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions");
}

// ---------------------------------------------------------------------------
// describe.skip — all test cases
// ---------------------------------------------------------------------------

describe("group server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11" } },
    });
    mockRequireBoardRole.mockResolvedValue("member");
    mockLogActivity.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // createGroup
  // -------------------------------------------------------------------------

  describe("createGroup", () => {
    it("rejects unauthorized — requireBoardRole throws FORBIDDEN", async () => {
      mockRequireBoardRole.mockRejectedValueOnce({
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      });

      // Provide a valid group row for the fetch chain (won't reach insert).
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { createGroup } = await getActions();
      const result = await createGroup({
        boardId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "New Group",
        color: "#a25ddc",
        position: 1,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      });
    });

    it("rejects an invalid color with VALIDATION error on field 'color'", async () => {
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { createGroup } = await getActions();
      const result = await createGroup({
        boardId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "New Group",
        color: "#badbad", // not in palette
        position: 1,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION", message: "Invalid color", field: "color" },
      });
    });

    it("succeeds: calls insert and logActivity with correct type and payload", async () => {
      const newGroupRow = {
        id: "f599bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Sprint 1",
        color: "#a25ddc",
        position: 1,
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
      };

      const chain = makeSupabaseChain({ data: newGroupRow, error: null });
      mockFrom.mockReturnValue(chain);

      const { createGroup } = await getActions();
      const result = await createGroup({
        boardId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Sprint 1",
        color: "#a25ddc",
        position: 1,
      });

      expect(result).toEqual({ ok: true, data: newGroupRow });

      // Verify insert was invoked.
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          name: "Sprint 1",
          color: "#a25ddc",
          position: 1,
        }),
      );

      // Verify logActivity was called with the correct type and payload.
      expect(mockLogActivity).toHaveBeenCalledOnce();
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "group.created",
          payload: expect.objectContaining({
            name: "Sprint 1",
            color: "#a25ddc",
            position: 1,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // renameGroup
  // -------------------------------------------------------------------------

  describe("renameGroup", () => {
    it("rejects when name is empty string (Zod validation)", async () => {
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { renameGroup } = await getActions();
      const result = await renameGroup({
        groupId: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION");
      }
    });

    it("succeeds: logActivity payload contains from/to names", async () => {
      const existingGroup = {
        id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Old Name",
      };
      const updatedGroup = {
        ...existingGroup,
        name: "New Name",
        color: "#a25ddc",
        position: 1,
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
      };

      // First call: maybeSingle (fetch existing group).
      // Second call: single (updated row after UPDATE).
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeSupabaseChain({ data: existingGroup, error: null });
        }
        return makeSupabaseChain({ data: updatedGroup, error: null });
      });

      const { renameGroup } = await getActions();
      const result = await renameGroup({
        groupId: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "New Name",
      });

      expect(result).toEqual({ ok: true, data: updatedGroup });

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "group.renamed",
          payload: { from: "Old Name", to: "New Name" },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // duplicateGroup
  // -------------------------------------------------------------------------

  describe("duplicateGroup", () => {
    it("copies the correct number of tasks from the source group", async () => {
      const sourceGroup = {
        id: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Sprint 1",
        color: "#a25ddc",
        position: 2,
      };
      const sourceTasks = [
        {
          id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          title: "Task A",
          position: 1,
          created_by: null,
          updated_by: null,
        },
        {
          id: "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          title: "Task B",
          position: 2,
          created_by: null,
          updated_by: null,
        },
      ];
      const newGroup = {
        ...sourceGroup,
        id: "f599bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Sprint 1 copy",
        position: 2.5,
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
      };

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        // Call 1: fetch source group → maybeSingle resolves to sourceGroup.
        if (callIdx === 1) return makeSupabaseChain({ data: sourceGroup, error: null });
        // Call 2: fetch tasks → single/maybeSingle NOT used; need array response.
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: sourceTasks, error: null });
          // The tasks query ends with .order() — override to resolve with array.
          (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: sourceTasks,
            error: null,
          });
          return chain;
        }
        // Call 3: fetch cells (empty — no cells in this test).
        if (callIdx === 3) {
          const chain = makeSupabaseChain({ data: [], error: null });
          (chain.in as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
          return chain;
        }
        // Call 4: INSERT new group → single resolves to newGroup.
        if (callIdx === 4) return makeSupabaseChain({ data: newGroup, error: null });
        // Calls 5+: INSERT each task → single resolves to a new task id.
        return makeSupabaseChain({
          data: { id: `ef39bc99-9c0b-4ef8-bb6d-6bb9bd380a11-${callIdx}` },
          error: null,
        });
      });

      const { duplicateGroup } = await getActions();
      const result = await duplicateGroup({ groupId: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result).toEqual({ ok: true, data: newGroup });

      // logActivity should record taskCount = 2 (number of source tasks).
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "group.duplicated",
          payload: expect.objectContaining({ taskCount: 2 }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // deleteGroup
  // -------------------------------------------------------------------------

  describe("deleteGroup", () => {
    it("soft deletes by setting deleted_at (cascade is DB-side, not asserted here)", async () => {
      const group = {
        id: "a6a9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "To Delete",
      };

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          // Fetch group for authorization.
          return makeSupabaseChain({ data: group, error: null });
        }
        // UPDATE soft delete — does not call .single(), just resolves.
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.update as ReturnType<typeof vi.fn>).mockReturnValue({
          ...chain,
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        });
        return chain;
      });

      const { deleteGroup } = await getActions();
      const result = await deleteGroup({ groupId: "a6a9bc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result).toEqual({
        ok: true,
        data: { groupId: "a6a9bc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      });

      // Verify the update was called with deleted_at.
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "group.deleted",
          payload: expect.objectContaining({
            groupId: "a6a9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            name: "To Delete",
          }),
        }),
      );
    });
  });
});
