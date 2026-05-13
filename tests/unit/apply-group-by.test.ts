import { describe, expect, it } from "vitest";
import type { Cell, Column, Task } from "@/components/board/table/types";
import { applyGroupBy } from "@/lib/filtering/apply-group-by";
import type { Database } from "@/lib/supabase/types";
import type { GroupBy } from "@/lib/views/config-schema";

type Group = Database["public"]["Tables"]["group"]["Row"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-1",
    board_id: "board-1",
    name: "Group One",
    color: "blue",
    position: 1,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

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
    id: "col-status-1",
    board_id: "board-1",
    name: "Status",
    type: "status",
    position: 1,
    icon: null,
    settings: { labels: [] },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCell(taskId: string, columnId: string, labelId: string | null): Cell {
  return {
    id: `${taskId}:${columnId}`,
    task_id: taskId,
    column_id: columnId,
    text_value: null,
    number_value: null,
    boolean_value: null,
    date_value: null,
    date_end_value: null,
    label_id: labelId,
    json_value: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyGroupBy", () => {
  it("native grouping returns one bucket per structural group, in position order", () => {
    const g1 = makeGroup({ id: "g1", position: 1, name: "Group 1" });
    const g2 = makeGroup({ id: "g2", position: 2, name: "Group 2" });
    const t1 = makeTask({ id: "t1", group_id: "g1" });
    const t2 = makeTask({ id: "t2", group_id: "g2" });
    const t3 = makeTask({ id: "t3", group_id: "g1" });

    const groupBy: GroupBy = { kind: "native" };
    const result = applyGroupBy([t1, t2, t3], new Map(), [], groupBy, [g1, g2]);

    expect(result).toHaveLength(2);
    expect(result[0]?.key).toBe("g1");
    expect(result[0]?.tasks.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(result[1]?.key).toBe("g2");
    expect(result[1]?.tasks.map((t) => t.id)).toEqual(["t2"]);
  });

  it("undefined groupBy returns native buckets", () => {
    const g1 = makeGroup({ id: "g1", name: "G1" });
    const t1 = makeTask({ id: "t1", group_id: "g1" });

    const result = applyGroupBy([t1], new Map(), [], undefined, [g1]);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe("g1");
  });

  it("column-based grouping by status — buckets by labelId, sorted by label.position", () => {
    const labelId1 = "label-aaa-0001";
    const labelId2 = "label-aaa-0002";
    const col = makeColumn({
      id: "00000000-0000-0000-0000-000000000001",
      type: "status",
      settings: {
        labels: [
          { id: labelId1, name: "Done", color: "green", position: 0 },
          { id: labelId2, name: "In Progress", color: "blue", position: 1 },
        ],
      },
    });

    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const t3 = makeTask({ id: "t3" }); // no label

    const cells = new Map<string, Cell>([
      [`t1:${col.id}`, makeCell("t1", col.id, labelId1)],
      [`t2:${col.id}`, makeCell("t2", col.id, labelId2)],
      // t3 has no cell → uncategorized
    ]);

    const groupBy: GroupBy = { kind: "column", columnId: col.id };
    const result = applyGroupBy([t1, t2, t3], cells, [col], groupBy, []);

    expect(result.length).toBeGreaterThanOrEqual(2);

    const doneB = result.find((b) => b.key === `label:${labelId1}`);
    expect(doneB).toBeDefined();
    expect(doneB?.label).toBe("Done");
    expect(doneB?.tasks.map((t) => t.id)).toContain("t1");

    const inProgressB = result.find((b) => b.key === `label:${labelId2}`);
    expect(inProgressB).toBeDefined();
    expect(inProgressB?.tasks.map((t) => t.id)).toContain("t2");

    // Uncategorized is last.
    const uncatB = result[result.length - 1];
    expect(uncatB?.key).toBe("none");
    expect(uncatB?.tasks.map((t) => t.id)).toContain("t3");
  });

  it("checkbox column — two buckets: Checked and Unchecked", () => {
    const col = makeColumn({
      id: "00000000-0000-0000-0000-000000000002",
      type: "checkbox",
      settings: {},
    });

    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });
    const t3 = makeTask({ id: "t3" });

    const cells = new Map<string, Cell>([
      [
        `t1:${col.id}`,
        {
          ...makeCell("t1", col.id, null),
          boolean_value: true,
        },
      ],
      [
        `t2:${col.id}`,
        {
          ...makeCell("t2", col.id, null),
          boolean_value: false,
        },
      ],
      // t3 has no cell → boolean_value is null → treated as unchecked
    ]);

    const groupBy: GroupBy = { kind: "column", columnId: col.id };
    const result = applyGroupBy([t1, t2, t3], cells, [col], groupBy, []);

    const checkedB = result.find((b) => b.key === "checkbox:true");
    expect(checkedB).toBeDefined();
    expect(checkedB?.tasks.map((t) => t.id)).toContain("t1");

    const uncheckedB = result.find((b) => b.key === "checkbox:false");
    expect(uncheckedB).toBeDefined();
    const uncheckedIds = uncheckedB?.tasks.map((t) => t.id) ?? [];
    expect(uncheckedIds).toContain("t2");
    expect(uncheckedIds).toContain("t3");
  });

  it("unknown column id falls back to a single 'All tasks' bucket", () => {
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });

    const groupBy: GroupBy = {
      kind: "column",
      columnId: "00000000-0000-0000-0000-000000000099", // unknown
    };

    const result = applyGroupBy([t1, t2], new Map(), [], groupBy, []);
    expect(result).toHaveLength(1);
    expect(result[0]?.key).toBe("all");
    expect(result[0]?.tasks).toHaveLength(2);
  });

  it("native buckets preserve task order within each group", () => {
    const g1 = makeGroup({ id: "g1", position: 1 });
    const t1 = makeTask({ id: "t1", group_id: "g1", position: 1 });
    const t2 = makeTask({ id: "t2", group_id: "g1", position: 2 });
    const t3 = makeTask({ id: "t3", group_id: "g1", position: 3 });

    const result = applyGroupBy([t3, t1, t2], new Map(), [], undefined, [g1]);
    // Tasks are not re-sorted in applyGroupBy; the caller sorts before calling.
    expect(result[0]?.tasks.map((t) => t.id)).toEqual(["t3", "t1", "t2"]);
  });

  it("groups are sorted by position in native mode", () => {
    const g1 = makeGroup({ id: "g1", position: 2, name: "Second" });
    const g2 = makeGroup({ id: "g2", position: 1, name: "First" });
    const t1 = makeTask({ id: "t1", group_id: "g1" });
    const t2 = makeTask({ id: "t2", group_id: "g2" });

    const result = applyGroupBy([t1, t2], new Map(), [], undefined, [g1, g2]);
    expect(result[0]?.key).toBe("g2"); // position 1 first
    expect(result[1]?.key).toBe("g1"); // position 2 second
  });
});
