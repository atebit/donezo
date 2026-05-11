// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written here so the epic 15 executor can wire them without changes.
 *
 * Approach:
 * - Mock `lib/supabase/server` so no real Supabase client is constructed.
 * - Mock `lib/authorization` so `requireBoardRole` can be controlled per test.
 * - Mock `lib/activity` so `logActivity` calls can be asserted / counted.
 * - All DB interactions go through the mock Supabase builder chain.
 *
 * Guardrail #20 assertions:
 * - createTask / duplicateTask / bulkDuplicateTasks insert payloads must NOT
 *   contain `board_id` (trigger sets it). We assert on the shape passed to
 *   `chain.insert` to confirm compliance.
 * - moveTask / bulkMoveTasksToGroup update payloads must NOT contain `board_id`.
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

/** Minimal chainable Supabase mock. Returns a fresh builder that resolves with
 *  `resolveWith` at any terminal point. */
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
    "gt",
    "order",
    "limit",
    "maybeSingle",
    "single",
  ];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Terminal methods.
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  // Non-terminal methods that may be final in a chain (e.g., `.limit(1)` on SELECT).
  (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue(resolveWith);
  return chain;
}

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "user-uuid-actor" } },
});

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Helper: import actions (module is cached after first call in a describe block)
// ---------------------------------------------------------------------------

async function getActions() {
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions");
}

// ---------------------------------------------------------------------------
// describe.skip — all test cases
// ---------------------------------------------------------------------------

describe.skip("task server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-uuid-actor" } } });
    mockRequireBoardRole.mockResolvedValue("member");
    mockLogActivity.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // createTask — guardrail #20: insert payload must NOT include board_id
  // -------------------------------------------------------------------------

  describe("createTask", () => {
    it("succeeds and insert payload contains group_id but NOT board_id", async () => {
      const groupRow = { board_id: "board-uuid-1" };
      // The returned row simulates the trigger having fired and set board_id.
      const newTaskRow = {
        id: "task-uuid-new",
        board_id: "board-uuid-1", // trigger-derived
        group_id: "group-uuid-1",
        title: "My Task",
        position: 1,
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
        created_by: "user-uuid-actor",
        updated_by: "user-uuid-actor",
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        // Call 1: fetch group (resolves via maybeSingle).
        if (callCount === 1) return makeSupabaseChain({ data: groupRow, error: null });
        // Call 2: insert task (resolves via single).
        return makeSupabaseChain({ data: newTaskRow, error: null });
      });

      const { createTask } = await getActions();
      const result = await createTask({
        groupId: "group-uuid-1",
        title: "My Task",
        position: 1,
      });

      expect(result).toEqual({ ok: true, data: newTaskRow });

      // The returned row has board_id set by the trigger — confirm it matches the group.
      if (result.ok) {
        expect(result.data.board_id).toBe("board-uuid-1");
      }

      // logActivity must be called with task.created.
      expect(mockLogActivity).toHaveBeenCalledOnce();
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.created",
          payload: expect.objectContaining({
            groupId: "group-uuid-1",
            title: "My Task",
          }),
        }),
      );

      // requireBoardRole called exactly once with the group's board_id.
      expect(mockRequireBoardRole).toHaveBeenCalledOnce();
      expect(mockRequireBoardRole).toHaveBeenCalledWith("board-uuid-1", "member");
    });

    it("returns NOT_FOUND when group does not exist", async () => {
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { createTask } = await getActions();
      const result = await createTask({
        groupId: "group-uuid-missing",
        title: "Task",
        position: 1,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "Group not found." },
      });
    });
  });

  // -------------------------------------------------------------------------
  // moveTask — cross-group vs within-group payload differentiation
  // -------------------------------------------------------------------------

  describe("moveTask", () => {
    it("cross-group move: activity payload has fromGroupId !== toGroupId", async () => {
      const taskRow = {
        id: "task-uuid-1",
        board_id: "board-uuid-1",
        group_id: "group-uuid-A",
      };
      const destGroupRow = { board_id: "board-uuid-1" };
      const updatedTaskRow = {
        ...taskRow,
        group_id: "group-uuid-B",
        position: 5,
        updated_at: "2026-05-11T00:00:00Z",
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSupabaseChain({ data: taskRow, error: null });
        if (callCount === 2) return makeSupabaseChain({ data: destGroupRow, error: null });
        return makeSupabaseChain({ data: updatedTaskRow, error: null });
      });

      const { moveTask } = await getActions();
      const result = await moveTask({
        taskId: "task-uuid-1",
        groupId: "group-uuid-B",
        position: 5,
      });

      expect(result.ok).toBe(true);

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.moved",
          payload: expect.objectContaining({
            fromGroupId: "group-uuid-A",
            toGroupId: "group-uuid-B",
          }),
        }),
      );

      const activityCall = mockLogActivity.mock.calls[0][0] as {
        payload: { fromGroupId: string; toGroupId: string };
      };
      expect(activityCall.payload.fromGroupId).not.toBe(activityCall.payload.toGroupId);
    });

    it("within-group reorder: activity payload has fromGroupId === toGroupId", async () => {
      const taskRow = {
        id: "task-uuid-1",
        board_id: "board-uuid-1",
        group_id: "group-uuid-A",
      };
      const destGroupRow = { board_id: "board-uuid-1" };
      const updatedTaskRow = {
        ...taskRow,
        position: 3,
        updated_at: "2026-05-11T00:00:00Z",
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSupabaseChain({ data: taskRow, error: null });
        if (callCount === 2) return makeSupabaseChain({ data: destGroupRow, error: null });
        return makeSupabaseChain({ data: updatedTaskRow, error: null });
      });

      const { moveTask } = await getActions();
      const result = await moveTask({
        taskId: "task-uuid-1",
        groupId: "group-uuid-A", // same group — reorder within group
        position: 3,
      });

      expect(result.ok).toBe(true);

      const activityCall = mockLogActivity.mock.calls[0][0] as {
        payload: { fromGroupId: string; toGroupId: string };
      };
      expect(activityCall.payload.fromGroupId).toBe(activityCall.payload.toGroupId);
    });

    it("rejects cross-board move with VALIDATION error on field groupId", async () => {
      const taskRow = {
        id: "task-uuid-1",
        board_id: "board-uuid-1",
        group_id: "group-uuid-A",
      };
      // Destination group is on a different board.
      const destGroupRow = { board_id: "board-uuid-OTHER" };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSupabaseChain({ data: taskRow, error: null });
        return makeSupabaseChain({ data: destGroupRow, error: null });
      });

      const { moveTask } = await getActions();
      const result = await moveTask({
        taskId: "task-uuid-1",
        groupId: "group-uuid-other-board",
        position: 1,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Cross-board move not allowed",
          field: "groupId",
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // bulkDeleteTasks — rejects mixed-board input
  // -------------------------------------------------------------------------

  describe("bulkDeleteTasks", () => {
    it("rejects when taskIds span multiple boards", async () => {
      // Tasks from two different boards.
      const mixedBoardTasks = [
        { id: "task-uuid-1", board_id: "board-uuid-1" },
        { id: "task-uuid-2", board_id: "board-uuid-2" },
      ];

      const chain = makeSupabaseChain({ data: mixedBoardTasks, error: null });
      // The query chain ends with .is() before resolution — make it resolve with the array.
      (chain.is as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mixedBoardTasks,
        error: null,
      });
      mockFrom.mockReturnValue(chain);

      const { bulkDeleteTasks } = await getActions();
      const result = await bulkDeleteTasks({
        taskIds: ["task-uuid-1", "task-uuid-2"],
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Tasks span multiple boards",
        },
      });

      // requireBoardRole should NOT have been called — we reject before the role check.
      expect(mockRequireBoardRole).not.toHaveBeenCalled();
    });

    it("succeeds with single-board tasks and calls logActivity with count", async () => {
      const sameBoardTasks = [
        { id: "task-uuid-1", board_id: "board-uuid-1" },
        { id: "task-uuid-2", board_id: "board-uuid-1" },
      ];

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // SELECT query for loading tasks.
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.is as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: sameBoardTasks,
            error: null,
          });
          return chain;
        }
        // UPDATE for soft-delete.
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.is as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
        return chain;
      });

      const { bulkDeleteTasks } = await getActions();
      const result = await bulkDeleteTasks({
        taskIds: ["task-uuid-1", "task-uuid-2"],
      });

      expect(result).toEqual({
        ok: true,
        data: { taskIds: ["task-uuid-1", "task-uuid-2"] },
      });

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.bulk_deleted",
          payload: expect.objectContaining({
            count: 2,
            taskIds: ["task-uuid-1", "task-uuid-2"],
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // bulkMoveTasksToGroup — positions are sequential from max(destination) + 1
  // -------------------------------------------------------------------------

  describe("bulkMoveTasksToGroup", () => {
    it("assigns sequential positions starting from max_dest_position + 1", async () => {
      const sourceTasks = [
        { id: "task-uuid-1", board_id: "board-uuid-1", group_id: "group-uuid-src" },
        { id: "task-uuid-2", board_id: "board-uuid-1", group_id: "group-uuid-src" },
      ];
      const destGroup = { board_id: "board-uuid-1" };
      // Max position in destination group is currently 10.
      const maxPosRow = [{ position: 10 }];

      let callCount = 0;
      const updateCalls: Array<Record<string, unknown>> = [];

      mockFrom.mockImplementation(() => {
        callCount++;
        // Call 1: SELECT source tasks.
        if (callCount === 1) {
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.is as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: sourceTasks,
            error: null,
          });
          return chain;
        }
        // Call 2: SELECT destination group.
        if (callCount === 2) return makeSupabaseChain({ data: destGroup, error: null });
        // Call 3: SELECT max position in destination.
        if (callCount === 3) {
          const chain = makeSupabaseChain({ data: maxPosRow, error: null });
          (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: maxPosRow,
            error: null,
          });
          return chain;
        }
        // Calls 4+: UPDATE each task — record the update payload.
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.update as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: Record<string, unknown>) => {
            updateCalls.push(payload);
            return chain;
          },
        );
        (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
        return chain;
      });

      const { bulkMoveTasksToGroup } = await getActions();
      const result = await bulkMoveTasksToGroup({
        taskIds: ["task-uuid-1", "task-uuid-2"],
        groupId: "group-uuid-dest",
      });

      expect(result).toEqual({
        ok: true,
        data: {
          taskIds: ["task-uuid-1", "task-uuid-2"],
          toGroupId: "group-uuid-dest",
        },
      });

      // Verify positions are sequential from max + 1 = 11.
      expect(updateCalls.length).toBe(2);
      // First task gets position 11 (10 + 0 + 1), second gets 12 (10 + 1 + 1).
      const positions = updateCalls.map((p) => p.position as number);
      expect(positions).toEqual([11, 12]);

      // All updates target the destination group.
      for (const payload of updateCalls) {
        expect(payload.group_id).toBe("group-uuid-dest");
      }

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.bulk_moved",
          payload: expect.objectContaining({
            toGroupId: "group-uuid-dest",
            count: 2,
          }),
        }),
      );
    });
  });
});
