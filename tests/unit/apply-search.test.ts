import { describe, expect, it } from "vitest";
import type { Cell, Column, Task } from "@/components/board/table/types";
import { applySearch } from "@/lib/filtering/apply-search";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Test task",
    board_id: "board-1",
    group_id: "group-1",
    position: 1,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
    created_by: null,
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "col-text-1",
    board_id: "board-1",
    name: "Name",
    type: "text",
    position: 1,
    icon: null,
    settings: {},
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCell(taskId: string, columnId: string, textValue: string | null): Cell {
  return {
    id: `${taskId}:${columnId}`,
    task_id: taskId,
    column_id: columnId,
    text_value: textValue,
    number_value: null,
    boolean_value: null,
    date_value: null,
    date_end_value: null,
    label_id: null,
    json_value: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applySearch", () => {
  it("returns input untouched when query is empty string", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const result = applySearch(tasks, new Map(), [], "");
    expect(result).toBe(tasks); // Same reference.
  });

  it("returns empty array when no tasks match", () => {
    const tasks = [makeTask({ id: "t1", title: "Alpha" }), makeTask({ id: "t2", title: "Beta" })];
    const result = applySearch(tasks, new Map(), [], "gamma");
    expect(result).toHaveLength(0);
  });

  it("matches on task title (case-insensitive)", () => {
    const t1 = makeTask({ id: "t1", title: "Hello World" });
    const t2 = makeTask({ id: "t2", title: "Goodbye" });
    const result = applySearch([t1, t2], new Map(), [], "hello");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("t1");
  });

  it("title match is case-insensitive", () => {
    const t1 = makeTask({ id: "t1", title: "HELLO WORLD" });
    const result = applySearch([t1], new Map(), [], "hello world");
    expect(result).toHaveLength(1);
  });

  it("matches on cell text (text column)", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1", title: "no match" });
    const t2 = makeTask({ id: "t2", title: "no match" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "findme")],
      [`t2:${col.id}`, makeCell("t2", col.id, "nothere")],
    ]);

    const result = applySearch([t1, t2], cells, [col], "findme");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("t1");
  });

  it("cell match is case-insensitive", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1", title: "no match" });
    const cells = new Map<string, Cell>([[`t1:${col.id}`, makeCell("t1", col.id, "FINDME")]]);

    const result = applySearch([t1], cells, [col], "findme");
    expect(result).toHaveLength(1);
  });

  it("includes hidden-column cells in search", () => {
    // The function takes all columns regardless of hidden state —
    // caller is responsible for passing all columns, not just visible ones.
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1", title: "no match" });
    const cells = new Map<string, Cell>([[`t1:${col.id}`, makeCell("t1", col.id, "hidden-value")]]);

    const result = applySearch([t1], cells, [col], "hidden-value");
    expect(result).toHaveLength(1);
  });

  it("matches either title or cell (OR semantics)", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1", title: "keyword in title" });
    const t2 = makeTask({ id: "t2", title: "other" });
    const cells = new Map<string, Cell>([
      [`t2:${col.id}`, makeCell("t2", col.id, "keyword in cell")],
    ]);

    const result = applySearch([t1, t2], cells, [col], "keyword");
    expect(result).toHaveLength(2);
  });

  it("handles tasks with no cells gracefully", () => {
    const col = makeColumn();
    const t1 = makeTask({ id: "t1", title: "some task" });
    // No cells for t1.

    const result = applySearch([t1], new Map(), [col], "some");
    expect(result).toHaveLength(1);
  });

  it("partial match works (substring)", () => {
    const t1 = makeTask({ id: "t1", title: "Implementation of feature X" });
    const result = applySearch([t1], new Map(), [], "feature");
    expect(result).toHaveLength(1);
  });
});
