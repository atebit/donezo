import { describe, expect, it } from "vitest";
import type { Cell, Column, Task } from "@/components/board/table/types";
import { applySort } from "@/lib/filtering/apply-sort";
import type { SortKey } from "@/lib/views/config-schema";

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

describe("applySort", () => {
  it("returns a new copy unchanged when sortKeys is empty", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const result = applySort(tasks, new Map(), [], []);
    expect(result).not.toBe(tasks); // new array
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("returns a new copy unchanged when sortKeys is undefined", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const result = applySort(tasks, new Map(), [], undefined);
    expect(result).not.toBe(tasks);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("sorts ascending by a text column", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const t3 = makeTask({ id: "t3" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "charlie")],
      [`t2:${col.id}`, makeCell("t2", col.id, "alpha")],
      [`t3:${col.id}`, makeCell("t3", col.id, "bravo")],
    ]);

    const sortKeys: SortKey[] = [{ columnId: col.id, direction: "asc" }];
    const result = applySort([t1, t2, t3], cells, [col], sortKeys);
    expect(result.map((t) => t.id)).toEqual(["t2", "t3", "t1"]);
  });

  it("sorts descending by a text column", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const t3 = makeTask({ id: "t3" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "charlie")],
      [`t2:${col.id}`, makeCell("t2", col.id, "alpha")],
      [`t3:${col.id}`, makeCell("t3", col.id, "bravo")],
    ]);

    const sortKeys: SortKey[] = [{ columnId: col.id, direction: "desc" }];
    const result = applySort([t1, t2, t3], cells, [col], sortKeys);
    expect(result.map((t) => t.id)).toEqual(["t1", "t3", "t2"]);
  });

  it("multi-key sort: second key used when first key is tied", () => {
    const col1 = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const col2 = makeColumn({ id: "00000000-0000-0000-0000-000000000002" });
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const t3 = makeTask({ id: "t3" });
    const cells = new Map<string, Cell>([
      [`t1:${col1.id}`, makeCell("t1", col1.id, "alpha")],
      [`t2:${col1.id}`, makeCell("t2", col1.id, "alpha")],
      [`t3:${col1.id}`, makeCell("t3", col1.id, "bravo")],
      [`t1:${col2.id}`, makeCell("t1", col2.id, "z")],
      [`t2:${col2.id}`, makeCell("t2", col2.id, "a")],
      [`t3:${col2.id}`, makeCell("t3", col2.id, "m")],
    ]);

    const sortKeys: SortKey[] = [
      { columnId: col1.id, direction: "asc" },
      { columnId: col2.id, direction: "asc" },
    ];

    const result = applySort([t1, t2, t3], cells, [col1, col2], sortKeys);
    // col1: alpha=t1,t2 (tied), bravo=t3 → order: t2 (a), t1 (z), t3 (m)
    expect(result.map((t) => t.id)).toEqual(["t2", "t1", "t3"]);
  });

  it("unknown column id in sort key is skipped", () => {
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });

    const sortKeys: SortKey[] = [
      { columnId: "00000000-0000-0000-0000-000000000099", direction: "asc" }, // unknown
    ];

    // Should fall through to original order.
    const result = applySort([t1, t2], new Map(), [], sortKeys);
    expect(result.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("is stable — preserves original order for equal values", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1", position: 1 });
    const t2 = makeTask({ id: "t2", position: 2 });
    const t3 = makeTask({ id: "t3", position: 3 });
    // All three have the same value.
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "same")],
      [`t2:${col.id}`, makeCell("t2", col.id, "same")],
      [`t3:${col.id}`, makeCell("t3", col.id, "same")],
    ]);

    const sortKeys: SortKey[] = [{ columnId: col.id, direction: "asc" }];
    const result = applySort([t1, t2, t3], cells, [col], sortKeys);
    // All equal → original order preserved.
    expect(result.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("null values are sorted consistently (null typically sorts last via compare)", () => {
    const col = makeColumn({ id: "00000000-0000-0000-0000-000000000001" });
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "alpha")],
      // t2 has no cell — null value
    ]);

    const sortKeys: SortKey[] = [{ columnId: col.id, direction: "asc" }];
    // Should not throw; null handled by def.compare.
    expect(() => applySort([t1, t2], cells, [col], sortKeys)).not.toThrow();
  });
});
