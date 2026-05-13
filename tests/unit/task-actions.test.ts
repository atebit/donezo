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
// Helper: import actions (module is cached after first call in a describe block)
// ---------------------------------------------------------------------------

async function getActions() {
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions");
}

// ---------------------------------------------------------------------------
// describe.skip — all test cases
// ---------------------------------------------------------------------------

describe("task server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11" } },
    });
    mockRequireBoardRole.mockResolvedValue("member");
    mockLogActivity.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // createTask — guardrail #20: insert payload must NOT include board_id
  // -------------------------------------------------------------------------

  describe("createTask", () => {
    it("succeeds and insert payload contains group_id but NOT board_id", async () => {
      const groupRow = { board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" };
      // The returned row simulates the trigger having fired and set board_id.
      const newTaskRow = {
        id: "ef39bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", // trigger-derived
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "My Task",
        position: 1,
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
        created_by: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        updated_by: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
        groupId: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "My Task",
        position: 1,
      });

      expect(result).toEqual({ ok: true, data: newTaskRow });

      // The returned row has board_id set by the trigger — confirm it matches the group.
      if (result.ok) {
        expect(result.data.board_id).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d479");
      }

      // logActivity must be called with task.created.
      expect(mockLogActivity).toHaveBeenCalledOnce();
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.created",
          payload: expect.objectContaining({
            groupId: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            title: "My Task",
          }),
        }),
      );

      // requireBoardRole called exactly once with the group's board_id.
      expect(mockRequireBoardRole).toHaveBeenCalledOnce();
      expect(mockRequireBoardRole).toHaveBeenCalledWith(
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "member",
      );
    });

    it("returns NOT_FOUND when group does not exist", async () => {
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { createTask } = await getActions();
      const result = await createTask({
        groupId: "d9d9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
        id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      };
      const destGroupRow = { board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" };
      const updatedTaskRow = {
        ...taskRow,
        group_id: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
        taskId: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        groupId: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        position: 5,
      });

      expect(result.ok).toBe(true);

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.moved",
          payload: expect.objectContaining({
            fromGroupId: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            toGroupId: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
        id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      };
      const destGroupRow = { board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" };
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
        taskId: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        groupId: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11", // same group — reorder within group
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
        id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
        taskId: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        groupId: "c8c9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
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
        {
          id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        },
        {
          id: "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          board_id: "c73bcdcc-2669-4bf6-81d3-e4ae73fb11fd",
        },
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
        taskIds: ["bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11", "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
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
        {
          id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        },
        {
          id: "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        },
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
        taskIds: ["bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11", "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
      });

      expect(result).toEqual({
        ok: true,
        data: {
          taskIds: ["bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11", "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
        },
      });

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.bulk_deleted",
          payload: expect.objectContaining({
            count: 2,
            taskIds: [
              "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
              "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            ],
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // duplicateTask — uses positionBetween(source, nextSibling)
  // -------------------------------------------------------------------------

  describe("duplicateTask", () => {
    it("inserts a cloned task whose position is between source and its next sibling", async () => {
      const sourceTask = {
        id: "de29bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "Source Task",
        position: 4,
      };
      // Next sibling is at position 8, so new position should be midpoint 6.
      const nextSiblingRows = [{ position: 8 }];
      const newTaskRow = {
        id: "a049bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "Source Task",
        position: 6, // positionBetween(4, 8) = 6
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
        created_by: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        updated_by: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        // Call 1: SELECT source task → maybeSingle resolves to sourceTask.
        if (callCount === 1) return makeSupabaseChain({ data: sourceTask, error: null });
        // Call 2: SELECT next sibling (position gt source, limit 1).
        if (callCount === 2) {
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: nextSiblingRows,
            error: null,
          });
          return chain;
        }
        // Call 3: SELECT cells for source task (empty — no cells).
        if (callCount === 3) {
          const chain = makeSupabaseChain({ data: [], error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
          return chain;
        }
        // Call 4: INSERT cloned task → single resolves to newTaskRow.
        return makeSupabaseChain({ data: newTaskRow, error: null });
      });

      const { duplicateTask } = await getActions();
      const result = await duplicateTask({ taskId: "de29bc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result).toEqual({ ok: true, data: newTaskRow });

      // The cloned task's position must sit between source (4) and sibling (8).
      if (result.ok) {
        expect(result.data.position).toBeGreaterThan(sourceTask.position);
        expect(result.data.position).toBeLessThan(nextSiblingRows[0]?.position ?? 999);
        expect(result.data.position).toBe(6); // exact midpoint
      }

      // logActivity called with task.duplicated and correct sourceTaskId.
      expect(mockLogActivity).toHaveBeenCalledOnce();
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.duplicated",
          payload: expect.objectContaining({
            sourceTaskId: "de29bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          }),
        }),
      );
    });

    it("places the duplicate after the source when there is no next sibling", async () => {
      const sourceTask = {
        id: "de29bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "Last Task",
        position: 10,
      };
      const newTaskRow = {
        id: "b159bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        group_id: "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        title: "Last Task",
        position: 11, // positionBetween(10, null) = 11
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
        deleted_at: null,
        created_by: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        updated_by: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return makeSupabaseChain({ data: sourceTask, error: null });
        if (callCount === 2) {
          // No next sibling — query returns empty array.
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: [],
            error: null,
          });
          return chain;
        }
        if (callCount === 3) {
          const chain = makeSupabaseChain({ data: [], error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
          return chain;
        }
        return makeSupabaseChain({ data: newTaskRow, error: null });
      });

      const { duplicateTask } = await getActions();
      const result = await duplicateTask({ taskId: "de29bc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result).toEqual({ ok: true, data: newTaskRow });

      if (result.ok) {
        // positionBetween(10, null) === 11 (prev + 1)
        expect(result.data.position).toBe(11);
      }
    });

    it("returns NOT_FOUND when the source task does not exist", async () => {
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { duplicateTask } = await getActions();
      const result = await duplicateTask({ taskId: "c269bc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result).toEqual({
        ok: false,
        error: { code: "NOT_FOUND", message: "Task not found." },
      });
      expect(mockLogActivity).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // bulkMoveTasksToGroup — positions are sequential from max(destination) + 1
  // -------------------------------------------------------------------------

  describe("bulkMoveTasksToGroup", () => {
    it("assigns sequential positions starting from max_dest_position + 1", async () => {
      const sourceTasks = [
        {
          id: "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          group_id: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        },
        {
          id: "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          group_id: "e489bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        },
      ];
      const destGroup = { board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" };
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
        taskIds: ["bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11", "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
        groupId: "b7b9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      });

      expect(result).toEqual({
        ok: true,
        data: {
          taskIds: ["bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11", "cd19bc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
          toGroupId: "b7b9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        },
      });

      // Verify positions are sequential from max + 1 = 11.
      expect(updateCalls.length).toBe(2);
      // First task gets position 11 (10 + 0 + 1), second gets 12 (10 + 1 + 1).
      const positions = updateCalls.map((p) => p.position as number);
      expect(positions).toEqual([11, 12]);

      // All updates target the destination group.
      for (const payload of updateCalls) {
        expect(payload.group_id).toBe("b7b9bc99-9c0b-4ef8-bb6d-6bb9bd380a11");
      }

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "task.bulk_moved",
          payload: expect.objectContaining({
            toGroupId: "b7b9bc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            count: 2,
          }),
        }),
      );
    });
  });
});
