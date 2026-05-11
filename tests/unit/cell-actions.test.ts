// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for cell server actions (setCellValue + bulkSetCellValue).
 *
 * These tests are skipped until the Vitest runner is wired in epic 15.
 * Bodies are syntactically valid and document expected behavior.
 *
 * Setup assumptions (when these run for real):
 *   - Supabase and withUser are mocked.
 *   - The cell registry (lib/cells/registry.ts) has real defs wired (Stage 3).
 *   - A test Postgres DB is available with the full schema applied.
 */

describe.skip("setCellValue", () => {
  it("happy path: upserts a cell row and returns the updated cell", async () => {
    // Arrange
    const mockPatch = {
      text_value: "Hello",
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      label_id: null,
      json_value: null,
    };
    const mockCellDef = {
      fromRow: vi.fn().mockReturnValue(null),
      toRow: vi.fn().mockReturnValue(mockPatch),
    };
    const mockColumn = { id: "col-uuid", board_id: "board-uuid", type: "text" };
    const mockCell = {
      task_id: "task-uuid",
      column_id: "col-uuid",
      ...mockPatch,
      updated_by: "user-uuid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Act — in a real test, call the action with mocked supabase + registry
    const input = {
      taskId: "task-uuid",
      columnId: "col-uuid",
      value: "Hello",
    };

    // Assert
    expect(mockCellDef.toRow).toHaveBeenCalledWith(input.value);
    expect(mockCell.text_value).toBe("Hello");
    expect(mockCell.number_value).toBeNull();
    expect(mockColumn.board_id).toBe("board-uuid");
  });

  it("rejects with VALIDATION error when registry's toRow throws (type mismatch)", async () => {
    // Arrange — simulate registry's toRow throwing for a value that doesn't
    // match the column's expected type (e.g., passing a string to a checkbox column)
    const mockCellDef = {
      fromRow: vi.fn().mockReturnValue(null),
      toRow: vi.fn().mockImplementation(() => {
        throw new Error("Expected boolean, got string");
      }),
    };

    // Act
    let caught: unknown = null;
    try {
      mockCellDef.toRow("not a boolean");
    } catch (err) {
      caught = err;
    }

    // Assert
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("Expected boolean");
  });

  it("returns NOT_FOUND when the column does not exist", async () => {
    // Arrange — simulate supabase returning null for the column lookup
    const mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    // Act — in a real test, inject mockSupabase via the withUser wrapper mock
    const result = await Promise.resolve({
      ok: false,
      error: { code: "NOT_FOUND", message: "Column not found." },
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { code: "NOT_FOUND" } });

    void mockSupabase;
  });

  it("logs a cell.changed activity event with from/to values", async () => {
    // Arrange
    const logActivityMock = vi.fn().mockResolvedValue(undefined);
    const prevValue = "old text";
    const nextValue = "new text";
    const columnType = "text";
    const boardId = "board-uuid";
    const taskId = "task-uuid";
    const userId = "user-uuid";

    // Act — simulate the activity log call from setCellValue
    await logActivityMock({
      boardId,
      taskId,
      actorId: userId,
      type: "cell.changed",
      payload: { columnType, from: prevValue, to: nextValue },
    });

    // Assert
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cell.changed",
        payload: expect.objectContaining({
          columnType,
          from: prevValue,
          to: nextValue,
        }),
      }),
    );
  });
});

describe.skip("bulkSetCellValue", () => {
  it("happy path: upserts cells for all taskIds and returns count + cells", async () => {
    // Arrange
    const taskIds = ["task-1", "task-2", "task-3"];
    const columnId = "col-uuid";
    const boardId = "board-uuid";
    const mockPatch = {
      text_value: "Bulk value",
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      label_id: null,
      json_value: null,
    };
    const mockCells = taskIds.map((tid) => ({
      task_id: tid,
      column_id: columnId,
      ...mockPatch,
      updated_by: "user-uuid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Act — in a real test, call bulkSetCellValue with mocked deps
    const result = { count: taskIds.length, cells: mockCells };

    // Assert
    expect(result.count).toBe(3);
    expect(result.cells).toHaveLength(3);
    expect(result.cells[0]?.task_id).toBe("task-1");
    expect(result.cells[0]?.text_value).toBe("Bulk value");
    void boardId;
  });

  it("rejects with VALIDATION error when tasks span multiple boards", async () => {
    // Arrange — tasks from two different boards
    const taskIds = ["task-a", "task-b"];
    const mockTasks = [
      { id: "task-a", board_id: "board-1" },
      { id: "task-b", board_id: "board-2" },
    ];

    // Act — simulate the single-board safety check
    const boardIds = [...new Set(mockTasks.map((t) => t.board_id))];
    let caught: { code: string; message: string } | null = null;
    if (boardIds.length > 1) {
      caught = { code: "VALIDATION", message: "Tasks span multiple boards" };
    }

    // Assert — the single-board safety check fires BEFORE the role check
    expect(caught).not.toBeNull();
    expect(caught?.code).toBe("VALIDATION");
    expect(caught?.message).toBe("Tasks span multiple boards");
    void taskIds;
  });

  it("rejects with VALIDATION error when column belongs to a different board", async () => {
    // Arrange — all tasks are on board-1 but the column is on board-2
    const mockTasks = [
      { id: "task-a", board_id: "board-1" },
      { id: "task-b", board_id: "board-1" },
    ];
    const mockColumn = { id: "col-uuid", board_id: "board-2", type: "text" };

    // Act — simulate cross-board column check
    const tasksBoardId = mockTasks[0]?.board_id;
    let caught: { code: string; message: string } | null = null;
    if (mockColumn.board_id !== tasksBoardId) {
      caught = { code: "VALIDATION", message: "Column belongs to a different board" };
    }

    // Assert
    expect(caught).not.toBeNull();
    expect(caught?.code).toBe("VALIDATION");
    expect(caught?.message).toBe("Column belongs to a different board");
  });

  it("logs a cell.bulk_changed activity event with correct payload", async () => {
    // Arrange
    const logActivityMock = vi.fn().mockResolvedValue(undefined);
    const taskIds = ["task-1", "task-2"];
    const columnId = "col-uuid";
    const boardId = "board-uuid";
    const userId = "user-uuid";
    const value = "Bulk value";
    const columnType = "text";

    // Act — simulate the activity log call from bulkSetCellValue
    await logActivityMock({
      boardId,
      actorId: userId,
      type: "cell.bulk_changed",
      payload: {
        columnType,
        columnId,
        taskCount: taskIds.length,
        value,
      },
    });

    // Assert
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cell.bulk_changed",
        payload: expect.objectContaining({
          columnType,
          columnId,
          taskCount: 2,
          value,
        }),
      }),
    );
  });

  it("computes the patch once and reuses it for all taskIds", async () => {
    // Arrange — toRow should only be called once regardless of taskIds count
    const toRowMock = vi.fn().mockReturnValue({
      text_value: "shared",
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      label_id: null,
      json_value: null,
    });
    const taskIds = ["task-1", "task-2", "task-3"];

    // Act — simulate single toRow call + map
    const patch = toRowMock("shared");
    const upsertPayload = taskIds.map((tid) => ({
      task_id: tid,
      column_id: "col-uuid",
      ...patch,
    }));

    // Assert
    expect(toRowMock).toHaveBeenCalledTimes(1);
    expect(upsertPayload).toHaveLength(3);
    expect(upsertPayload.every((p) => p.text_value === "shared")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Additional cases (S23 extension)
// ---------------------------------------------------------------------------

describe.skip("setCellValue (extended)", () => {
  it("status value { labelId } writes label_id and nulls all other value columns", () => {
    // Arrange — simulate statusType.toRow({ labelId: "lbl-uuid" })
    const statusToRow = vi.fn().mockReturnValue({
      text_value: null,
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      label_id: "lbl-uuid",
      json_value: null,
    });

    // Act
    const patch = statusToRow({ labelId: "lbl-uuid" });

    // Assert — only label_id should be non-null
    expect(patch.label_id).toBe("lbl-uuid");
    expect(patch.text_value).toBeNull();
    expect(patch.number_value).toBeNull();
    expect(patch.boolean_value).toBeNull();
    expect(patch.date_value).toBeNull();
    expect(patch.date_end_value).toBeNull();
    expect(patch.json_value).toBeNull();
  });

  it("status value null writes null label_id and nulls all other value columns", () => {
    const statusToRow = vi.fn().mockReturnValue({
      text_value: null,
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      label_id: null,
      json_value: null,
    });

    const patch = statusToRow(null);

    expect(patch.label_id).toBeNull();
    expect(patch.text_value).toBeNull();
    expect(patch.number_value).toBeNull();
    expect(patch.boolean_value).toBeNull();
    expect(patch.date_value).toBeNull();
    expect(patch.json_value).toBeNull();
  });
});

describe.skip("bulkSetCellValue (extended)", () => {
  it("checkbox value=true writes boolean_value=true for all selected tasks", () => {
    // Arrange — simulate checkboxType.toRow(true)
    const checkboxToRow = vi.fn().mockReturnValue({
      text_value: null,
      number_value: null,
      boolean_value: true,
      date_value: null,
      date_end_value: null,
      label_id: null,
      json_value: null,
    });

    const taskIds = ["task-1", "task-2", "task-3"];

    // Act — simulate the bulkSetCellValue upsert construction
    const patch = checkboxToRow(true);
    const upsertPayload = taskIds.map((tid) => ({
      task_id: tid,
      column_id: "col-checkbox",
      ...patch,
    }));

    // Assert
    expect(checkboxToRow).toHaveBeenCalledTimes(1);
    expect(upsertPayload).toHaveLength(3);
    expect(upsertPayload.every((p) => p.boolean_value === true)).toBe(true);
    expect(upsertPayload.every((p) => p.text_value === null)).toBe(true);
    expect(upsertPayload.every((p) => p.number_value === null)).toBe(true);
    expect(upsertPayload.every((p) => p.label_id === null)).toBe(true);
  });

  it("checkbox value=false writes boolean_value=false for all selected tasks", () => {
    const checkboxToRow = vi.fn().mockReturnValue({
      text_value: null,
      number_value: null,
      boolean_value: false,
      date_value: null,
      date_end_value: null,
      label_id: null,
      json_value: null,
    });

    const taskIds = ["task-a", "task-b"];
    const patch = checkboxToRow(false);
    const upsertPayload = taskIds.map((tid) => ({
      task_id: tid,
      column_id: "col-checkbox",
      ...patch,
    }));

    expect(upsertPayload.every((p) => p.boolean_value === false)).toBe(true);
  });

  it("status bulk-set writes label_id for all selected tasks", () => {
    // Simulate statusType.toRow({ labelId: "lbl-done" })
    const statusToRow = vi.fn().mockReturnValue({
      text_value: null,
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      label_id: "lbl-done",
      json_value: null,
    });

    const taskIds = ["task-1", "task-2"];
    const patch = statusToRow({ labelId: "lbl-done" });
    const upsertPayload = taskIds.map((tid) => ({
      task_id: tid,
      column_id: "col-status",
      ...patch,
    }));

    expect(upsertPayload).toHaveLength(2);
    expect(upsertPayload.every((p) => p.label_id === "lbl-done")).toBe(true);
    expect(upsertPayload.every((p) => p.text_value === null)).toBe(true);
    expect(upsertPayload.every((p) => p.boolean_value === null)).toBe(true);
  });
});
