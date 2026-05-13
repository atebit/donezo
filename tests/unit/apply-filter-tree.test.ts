import { describe, expect, it } from "vitest";
import type { Cell, Column, Task } from "@/components/board/table/types";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import type { FilterTree } from "@/lib/views/config-schema";

// ---------------------------------------------------------------------------
// Minimal fixtures
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

function makeCell(taskId: string, columnId: string, textValue: string): Cell {
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

describe("applyFilterTree", () => {
  it("returns input untouched when tree is undefined (passthrough)", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const cells = new Map<string, Cell>();
    const columns: Column[] = [];

    const result = applyFilterTree(tasks, cells, columns, undefined);

    expect(result).toBe(tasks); // Same reference — pure passthrough.
  });

  it("returns empty array when all tasks fail the filter", () => {
    const col = makeColumn();
    const task1 = makeTask({ id: "t1" });
    const task2 = makeTask({ id: "t2" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "hello")],
      [`t2:${col.id}`, makeCell("t2", col.id, "world")],
    ]);

    const tree: FilterTree = {
      kind: "comparison",
      comparison: { columnId: col.id, operator: "equals", operand: "nomatch" },
    };

    const result = applyFilterTree([task1, task2], cells, [col], tree);
    expect(result).toHaveLength(0);
  });

  it("comparison — text equals matches correctly", () => {
    const col = makeColumn();
    const task1 = makeTask({ id: "t1" });
    const task2 = makeTask({ id: "t2" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "hello")],
      [`t2:${col.id}`, makeCell("t2", col.id, "world")],
    ]);

    const tree: FilterTree = {
      kind: "comparison",
      comparison: { columnId: col.id, operator: "equals", operand: "hello" },
    };

    const result = applyFilterTree([task1, task2], cells, [col], tree);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("t1");
  });

  it("comparison — text contains matches correctly", () => {
    const col = makeColumn();
    const task1 = makeTask({ id: "t1" });
    const task2 = makeTask({ id: "t2" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "hello world")],
      [`t2:${col.id}`, makeCell("t2", col.id, "goodbye")],
    ]);

    const tree: FilterTree = {
      kind: "comparison",
      comparison: { columnId: col.id, operator: "contains", operand: "hello" },
    };

    const result = applyFilterTree([task1, task2], cells, [col], tree);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("t1");
  });

  it("and — requires ALL clauses to be true", () => {
    const col1 = makeColumn({ id: "col-a-uuid-0001-000000000000" });
    const col2 = makeColumn({ id: "col-b-uuid-0002-000000000000", name: "Tag" });
    const task1 = makeTask({ id: "t1" });
    const task2 = makeTask({ id: "t2" });
    const cells = new Map<string, Cell>([
      [`t1:${col1.id}`, makeCell("t1", col1.id, "alpha")],
      [`t1:${col2.id}`, makeCell("t1", col2.id, "beta")],
      [`t2:${col1.id}`, makeCell("t2", col1.id, "alpha")],
      [`t2:${col2.id}`, makeCell("t2", col2.id, "gamma")],
    ]);

    const tree: FilterTree = {
      kind: "and",
      clauses: [
        {
          kind: "comparison",
          comparison: { columnId: col1.id, operator: "equals", operand: "alpha" },
        },
        {
          kind: "comparison",
          comparison: { columnId: col2.id, operator: "equals", operand: "beta" },
        },
      ],
    };

    const result = applyFilterTree([task1, task2], cells, [col1, col2], tree);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("t1");
  });

  it("or — requires ANY clause to be true", () => {
    const col = makeColumn();
    const task1 = makeTask({ id: "t1" });
    const task2 = makeTask({ id: "t2" });
    const task3 = makeTask({ id: "t3" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "alpha")],
      [`t2:${col.id}`, makeCell("t2", col.id, "beta")],
      [`t3:${col.id}`, makeCell("t3", col.id, "gamma")],
    ]);

    const tree: FilterTree = {
      kind: "or",
      clauses: [
        {
          kind: "comparison",
          comparison: { columnId: col.id, operator: "equals", operand: "alpha" },
        },
        {
          kind: "comparison",
          comparison: { columnId: col.id, operator: "equals", operand: "beta" },
        },
      ],
    };

    const result = applyFilterTree([task1, task2, task3], cells, [col], tree);
    expect(result).toHaveLength(2);
    const ids = result.map((t) => t.id);
    expect(ids).toContain("t1");
    expect(ids).toContain("t2");
  });

  it("unknown column id in comparison evaluates to true (conservative pass-through)", () => {
    const task1 = makeTask({ id: "t1" });

    const tree: FilterTree = {
      kind: "comparison",
      comparison: {
        // This UUID doesn't match any column.
        columnId: "00000000-0000-0000-0000-000000000000",
        operator: "equals",
        operand: "anything",
      },
    };

    const result = applyFilterTree([task1], new Map(), [], tree);
    // Unknown column — task passes through.
    expect(result).toHaveLength(1);
  });

  it("empty and clause (no clauses) returns all tasks", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const tree: FilterTree = { kind: "and", clauses: [] };

    const result = applyFilterTree(tasks, new Map(), [], tree);
    // Vacuously true AND — all tasks pass.
    expect(result).toHaveLength(2);
  });

  it("nested and/or tree evaluates recursively", () => {
    const col = makeColumn();
    const task1 = makeTask({ id: "t1" });
    const task2 = makeTask({ id: "t2" });
    const task3 = makeTask({ id: "t3" });
    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, "a")],
      [`t2:${col.id}`, makeCell("t2", col.id, "b")],
      [`t3:${col.id}`, makeCell("t3", col.id, "c")],
    ]);

    // (a OR b) AND (a OR c) → only "a" satisfies both.
    const tree: FilterTree = {
      kind: "and",
      clauses: [
        {
          kind: "or",
          clauses: [
            {
              kind: "comparison",
              comparison: { columnId: col.id, operator: "equals", operand: "a" },
            },
            {
              kind: "comparison",
              comparison: { columnId: col.id, operator: "equals", operand: "b" },
            },
          ],
        },
        {
          kind: "or",
          clauses: [
            {
              kind: "comparison",
              comparison: { columnId: col.id, operator: "equals", operand: "a" },
            },
            {
              kind: "comparison",
              comparison: { columnId: col.id, operator: "equals", operand: "c" },
            },
          ],
        },
      ],
    };

    const result = applyFilterTree([task1, task2, task3], cells, [col], tree);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("t1");
  });
});
