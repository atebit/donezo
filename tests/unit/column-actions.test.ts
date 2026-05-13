import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions.ts
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written here so the epic 15 executor can wire them without changes.
 *
 * Approach:
 * - Mock `lib/supabase/server` so no real Supabase client is constructed.
 * - Mock `lib/authorization` so `requireBoardRole` can be controlled per test.
 * - Mock `lib/activity` so `logActivity` calls can be asserted / counted.
 * - Mock `lib/cells/registry` so getCellDef can be controlled without Stage 3.
 * - All DB interactions go through the mock Supabase builder chain.
 */

// ---------------------------------------------------------------------------
// Shared mock infrastructure
// ---------------------------------------------------------------------------

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/activity", () => ({ logActivity: mockLogActivity }));

const mockRequireBoardRole = vi.fn().mockResolvedValue("admin");
vi.mock("../../lib/authorization", () => ({
  requireBoardRole: mockRequireBoardRole,
  requireWorkspaceRole: vi.fn().mockResolvedValue("owner"),
}));

// Mock cell registry to avoid accessing NOT_IMPLEMENTED proxy stubs.
const mockFromRow = vi.fn().mockReturnValue("old-value");
const mockToRow = vi.fn().mockReturnValue({
  text_value: "new-value",
  number_value: null,
  boolean_value: null,
  date_value: null,
  date_end_value: null,
  label_id: null,
  json_value: null,
});
const mockConvertFn = vi.fn().mockReturnValue("converted");
const mockGetCellDef = vi.fn().mockReturnValue({
  fromRow: mockFromRow,
  toRow: mockToRow,
  convertTo: {
    number: mockConvertFn,
  },
});
vi.mock("../../lib/cells/registry", () => ({ getCellDef: mockGetCellDef }));

// Mock seed-labels to keep tests focused on action logic.
vi.mock("../../lib/cells/seed-labels", () => ({
  SEED_LABELS: {
    status: [
      { name: "Working on it", color: "#fdab3d", position: 1 },
      { name: "Done", color: "#00c875", position: 2 },
      { name: "Stuck", color: "#e2445c", position: 3 },
    ],
    priority: [
      { name: "Critical", color: "#333333", position: 1 },
      { name: "High", color: "#e2445c", position: 2 },
    ],
  },
}));

/** Minimal chainable Supabase mock. */
function makeSupabaseChain(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
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
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/columns/actions");
}

// ---------------------------------------------------------------------------
// describe.skip — all test cases
// ---------------------------------------------------------------------------

describe("column server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11" } },
    });
    mockRequireBoardRole.mockResolvedValue("admin");
    mockLogActivity.mockResolvedValue(undefined);
    mockGetCellDef.mockReturnValue({
      fromRow: mockFromRow,
      toRow: mockToRow,
      convertTo: { number: mockConvertFn },
    });
  });

  // -------------------------------------------------------------------------
  // createColumn — status with default labels
  // -------------------------------------------------------------------------

  describe("createColumn", () => {
    it("inserts a status column and seeds default labels", async () => {
      const newColumn = {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Status",
        type: "status",
        position: 1,
        settings: {},
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
      };
      const seededLabels = [
        {
          id: "lbl-1",
          column_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          name: "Working on it",
          color: "#fdab3d",
          position: 1,
          created_at: "2026-05-11T00:00:00Z",
          updated_at: "2026-05-11T00:00:00Z",
        },
        {
          id: "lbl-2",
          column_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          name: "Done",
          color: "#00c875",
          position: 2,
          created_at: "2026-05-11T00:00:00Z",
          updated_at: "2026-05-11T00:00:00Z",
        },
        {
          id: "lbl-3",
          column_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          name: "Stuck",
          color: "#e2445c",
          position: 3,
          created_at: "2026-05-11T00:00:00Z",
          updated_at: "2026-05-11T00:00:00Z",
        },
      ];

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        // Call 1: INSERT column → single resolves to newColumn.
        if (callIdx === 1) return makeSupabaseChain({ data: newColumn, error: null });
        // Call 2: INSERT labels → resolves to seededLabels array.
        const chain = makeSupabaseChain({ data: seededLabels, error: null });
        (chain.select as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: seededLabels,
          error: null,
        });
        return chain;
      });

      const { createColumn } = await getActions();
      const result = await createColumn({
        boardId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Status",
        type: "status",
        position: 1,
        settings: {},
      });

      expect(result).toEqual({ ok: true, data: { column: newColumn, labels: seededLabels } });

      expect(mockRequireBoardRole).toHaveBeenCalledWith(
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "admin",
      );
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "column.created",
          payload: expect.objectContaining({ name: "Status", type: "status" }),
        }),
      );
    });

    it("inserts a text column without seeding any labels", async () => {
      const newColumn = {
        id: "d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Notes",
        type: "text",
        position: 2,
        settings: {},
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
      };

      mockFrom.mockReturnValue(makeSupabaseChain({ data: newColumn, error: null }));

      const { createColumn } = await getActions();
      const result = await createColumn({
        boardId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Notes",
        type: "text",
        position: 2,
        settings: {},
      });

      expect(result).toEqual({ ok: true, data: { column: newColumn, labels: [] } });
      // Label insert should NOT have been called (text type has no seed labels).
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // renameColumn
  // -------------------------------------------------------------------------

  describe("renameColumn", () => {
    it("updates column name and logs activity with from/to payload", async () => {
      const existingColumn = {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Old Name",
      };
      const updatedColumn = {
        ...existingColumn,
        name: "New Name",
        type: "text",
        position: 1,
        settings: {},
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
      };

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return makeSupabaseChain({ data: existingColumn, error: null });
        return makeSupabaseChain({ data: updatedColumn, error: null });
      });

      const { renameColumn } = await getActions();
      const result = await renameColumn({
        columnId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "New Name",
      });

      expect(result).toEqual({ ok: true, data: updatedColumn });
      expect(mockRequireBoardRole).toHaveBeenCalledWith(
        "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "admin",
      );
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "column.renamed",
          payload: expect.objectContaining({ from: "Old Name", to: "New Name" }),
        }),
      );
    });

    it("rejects when name is empty (Zod validation)", async () => {
      mockFrom.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

      const { renameColumn } = await getActions();
      const result = await renameColumn({
        columnId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION");
      }
    });
  });

  // -------------------------------------------------------------------------
  // deleteColumn — cascade deletes cells
  // -------------------------------------------------------------------------

  describe("deleteColumn", () => {
    it("hard-deletes the column and returns deletedColumnId + affectedCellCount", async () => {
      const column = {
        id: "a5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "To Delete",
        type: "text",
      };

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        // Call 1: fetch column for auth.
        if (callIdx === 1) return makeSupabaseChain({ data: column, error: null });
        // Call 2: count cells before delete.
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 5, error: null });
          return chain;
        }
        // Call 3: DELETE column → FK cascade removes cells.
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
        return chain;
      });

      const { deleteColumn } = await getActions();
      const result = await deleteColumn({ columnId: "a5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.deletedColumnId).toBe("a5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
        // affectedCellCount may be 0 or 5 depending on mock resolution; just verify it's present.
        expect(typeof result.data.affectedCellCount).toBe("number");
      }

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "column.deleted",
          payload: expect.objectContaining({
            columnId: "a5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            name: "To Delete",
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // duplicateColumn — copies labels but NOT cell values
  // -------------------------------------------------------------------------

  describe("duplicateColumn", () => {
    it("copies the column and its labels, but does not copy cell values", async () => {
      const sourceColumn = {
        id: "e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Priority",
        type: "priority",
        position: 2,
        settings: {},
      };
      const sourceLabels = [
        { name: "Critical", color: "#333333", position: 1 },
        { name: "High", color: "#e2445c", position: 2 },
      ];
      const newColumn = {
        id: "f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Priority copy",
        type: "priority",
        position: 2.5,
        settings: {},
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
      };
      const newLabels = [
        { id: "lbl-new-1", name: "Critical", color: "#333333", position: 1 },
        { id: "lbl-new-2", name: "High", color: "#e2445c", position: 2 },
      ];

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        // Call 1: fetch source column.
        if (callIdx === 1) return makeSupabaseChain({ data: sourceColumn, error: null });
        // Call 2: fetch labels for source column.
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: sourceLabels, error: null });
          (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: sourceLabels,
            error: null,
          });
          return chain;
        }
        // Call 3: INSERT new column.
        if (callIdx === 3) return makeSupabaseChain({ data: newColumn, error: null });
        // Call 4: INSERT new labels.
        const chain = makeSupabaseChain({ data: newLabels, error: null });
        (chain.select as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: newLabels,
          error: null,
        });
        return chain;
      });

      const { duplicateColumn } = await getActions();
      const result = await duplicateColumn({ columnId: "e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.column.id).toBe("f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
        // Labels should be present (copied from source).
        expect(Array.isArray(result.data.labels)).toBe(true);
      }

      // The action must NOT have fetched or written any cell rows.
      // We verify by checking the `cell` table was never called.
      const allFromCalls = mockFrom.mock.calls.map((c: [string]) => c[0]);
      expect(allFromCalls).not.toContain("cell");

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "column.duplicated",
          payload: expect.objectContaining({
            sourceColumnId: "e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            newColumnId: "f4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // changeColumnType — happy path + lossy refusal without confirm
  // -------------------------------------------------------------------------

  describe("changeColumnType", () => {
    it("converts cell values and updates column type on happy path (text → number)", async () => {
      const sourceColumn = {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Price",
        type: "text",
      };
      const updatedColumn = { ...sourceColumn, type: "number" };
      const cells = [
        {
          task_id: "task-1",
          column_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          text_value: "42",
          number_value: null,
          boolean_value: null,
          date_value: null,
          date_end_value: null,
          label_id: null,
          json_value: null,
          updated_by: null,
          created_at: "2026-05-11T00:00:00Z",
          updated_at: "2026-05-11T00:00:00Z",
        },
      ];

      // convertTo.number returns the plain function (not lossy).
      mockGetCellDef.mockReturnValue({
        fromRow: mockFromRow,
        toRow: mockToRow,
        convertTo: { number: mockConvertFn }, // plain function = not lossy
      });

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return makeSupabaseChain({ data: sourceColumn, error: null });
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: cells, error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: cells, error: null });
          return chain;
        }
        if (callIdx === 3) return makeSupabaseChain({ data: updatedColumn, error: null });
        // Cell updates.
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
        return chain;
      });

      const { changeColumnType } = await getActions();
      const result = await changeColumnType({
        columnId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        newType: "number",
        confirmDataLoss: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.column.type).toBe("number");
      }

      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "column.type_changed",
          payload: expect.objectContaining({ from: "text", to: "number" }),
        }),
      );
    });

    it("returns CONFIRMATION_REQUIRED when conversion is lossy and confirmDataLoss is false", async () => {
      const sourceColumn = {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Status",
        type: "text",
      };

      // convertTo.status returns a { fn, lossy: true } object (Stage 3 shape).
      mockGetCellDef.mockReturnValue({
        fromRow: mockFromRow,
        toRow: mockToRow,
        convertTo: {
          status: { fn: mockConvertFn, lossy: true },
        },
      });

      mockFrom.mockReturnValue(makeSupabaseChain({ data: sourceColumn, error: null }));

      const { changeColumnType } = await getActions();
      const result = await changeColumnType({
        columnId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        newType: "status",
        confirmDataLoss: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONFIRMATION_REQUIRED");
      }
    });

    it("proceeds with lossy conversion when confirmDataLoss is true", async () => {
      const sourceColumn = {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Status",
        type: "text",
      };
      const updatedColumn = { ...sourceColumn, type: "status" };

      mockGetCellDef.mockReturnValue({
        fromRow: mockFromRow,
        toRow: mockToRow,
        convertTo: {
          status: { fn: mockConvertFn, lossy: true },
        },
      });

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return makeSupabaseChain({ data: sourceColumn, error: null });
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: [], error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [], error: null });
          return chain;
        }
        return makeSupabaseChain({ data: updatedColumn, error: null });
      });

      const { changeColumnType } = await getActions();
      const result = await changeColumnType({
        columnId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        newType: "status",
        confirmDataLoss: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.column.type).toBe("status");
      }
    });

    it("returns VALIDATION error when no conversion is defined for the type pair", async () => {
      const sourceColumn = {
        id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Checkbox",
        type: "checkbox",
      };

      // convertTo has no entry for "timeline".
      mockGetCellDef.mockReturnValue({
        fromRow: mockFromRow,
        toRow: mockToRow,
        convertTo: {},
      });

      mockFrom.mockReturnValue(makeSupabaseChain({ data: sourceColumn, error: null }));

      const { changeColumnType } = await getActions();
      const result = await changeColumnType({
        columnId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        newType: "timeline",
        confirmDataLoss: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION");
        expect(result.error.message).toMatch(/no conversion/i);
      }
    });
  });

  // -------------------------------------------------------------------------
  // duplicateColumn — labels carry column_id of the NEW column (F1 fix)
  // -------------------------------------------------------------------------

  describe("duplicateColumn (extended — label column_id verification)", () => {
    it("returned labels each carry column_id set to the new column's id", async () => {
      const sourceColumn = {
        id: "e9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Status copy test",
        type: "status",
        position: 3,
        settings: {},
      };
      const sourceLabels = [{ name: "Done", color: "#00c875", position: 1 }];
      const newColumn = {
        id: "d8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Status copy test copy",
        type: "status",
        position: 3.5,
        settings: {},
        created_at: "2026-05-11T00:00:00Z",
        updated_at: "2026-05-11T00:00:00Z",
      };
      const newLabels = [
        {
          id: "lbl-copy-1",
          column_id: "d8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          name: "Done",
          color: "#00c875",
          position: 1,
        },
      ];

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return makeSupabaseChain({ data: sourceColumn, error: null });
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: sourceLabels, error: null });
          (chain.order as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: sourceLabels,
            error: null,
          });
          return chain;
        }
        if (callIdx === 3) return makeSupabaseChain({ data: newColumn, error: null });
        const chain = makeSupabaseChain({ data: newLabels, error: null });
        (chain.select as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: newLabels,
          error: null,
        });
        return chain;
      });

      const { duplicateColumn } = await getActions();
      const result = await duplicateColumn({ columnId: "e9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Every returned label must have column_id equal to the new column's id.
        expect(
          result.data.labels.every(
            (l: { column_id: string }) => l.column_id === "d8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          ),
        ).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // deleteColumn — affectedCellCount reflects FK-cascaded deletion
  // -------------------------------------------------------------------------

  describe("deleteColumn (extended — affectedCellCount precision)", () => {
    it("affectedCellCount matches the number of cells that existed before delete", async () => {
      const column = {
        id: "c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Cascade Delete",
        type: "text",
      };
      const CELL_COUNT = 7;

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return makeSupabaseChain({ data: column, error: null });
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
            count: CELL_COUNT,
            error: null,
          });
          return chain;
        }
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
        return chain;
      });

      const { deleteColumn } = await getActions();
      const result = await deleteColumn({ columnId: "c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // The action must report how many cells were cascade-deleted.
        expect(result.data.affectedCellCount).toBe(CELL_COUNT);
      }
    });

    it("affectedCellCount is 0 when no cells existed for the column", async () => {
      const column = {
        id: "b6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        board_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        name: "Empty Column",
        type: "text",
      };

      let callIdx = 0;
      mockFrom.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return makeSupabaseChain({ data: column, error: null });
        if (callIdx === 2) {
          const chain = makeSupabaseChain({ data: null, error: null });
          (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
            count: 0,
            error: null,
          });
          return chain;
        }
        const chain = makeSupabaseChain({ data: null, error: null });
        (chain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });
        return chain;
      });

      const { deleteColumn } = await getActions();
      const result = await deleteColumn({ columnId: "b6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.affectedCellCount).toBe(0);
      }
    });
  });
});
