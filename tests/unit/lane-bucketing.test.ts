// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * lane-bucketing.test.ts — unit tests for the kanban lane bucketing pure function.
 *
 * Covers all four groupable column types:
 *   - status (label-based)
 *   - priority (label-based)
 *   - person (workspace-member-based, multi-assignee)
 *   - checkbox (boolean)
 *
 * Each section exercises:
 *   1. Happy-path bucketing in correct order.
 *   2. Tasks with null/empty cell values → Unassigned / Unchecked.
 *   3. Edge cases (multi-assignee, all-null, etc.).
 */

import { bucketTasksIntoLanes } from "@/components/board/kanban/lane-bucketing";
import type { Cell, Column, Task } from "@/components/board/table/types";
import type { WorkspaceMemberWithProfile } from "@/lib/board/load-board-snapshot";
import type { Database } from "@/lib/supabase/types";

type Label = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// Test-data factory helpers
// ---------------------------------------------------------------------------

let _idSeq = 0;
function nextId(): string {
  _idSeq += 1;
  return `00000000-0000-4000-a000-${String(_idSeq).padStart(12, "0")}`;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId(),
    board_id: "board-1",
    group_id: "group-1",
    title: "Task",
    position: 1,
    created_by: "user-1",
    updated_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  } as Task;
}

function makeColumn(type: string, id = nextId()): Column {
  return {
    id,
    board_id: "board-1",
    name: type,
    type,
    position: 1,
    settings: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as Column;
}

function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: nextId(),
    column_id: "col-1",
    name: "Label",
    color: "#888",
    position: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Label;
}

function makeCellsByKey(
  entries: Array<[taskId: string, colId: string, patch: Partial<Cell>]>,
): Map<string, Cell> {
  const map = new Map<string, Cell>();
  for (const [taskId, colId, patch] of entries) {
    const cell: Cell = {
      id: nextId(),
      task_id: taskId,
      column_id: colId,
      board_id: "board-1",
      text_value: null,
      number_value: null,
      boolean_value: null,
      date_value: null,
      date_end_value: null,
      json_value: null,
      label_id: null,
      updated_by: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...patch,
    } as Cell;
    map.set(`${taskId}:${colId}`, cell);
  }
  return map;
}

function makeMember(
  overrides: Partial<WorkspaceMemberWithProfile> = {},
): WorkspaceMemberWithProfile {
  return {
    user_id: nextId(),
    display_name: "Member",
    email: "member@example.com",
    avatar_url: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// status / priority bucketing
// ---------------------------------------------------------------------------

describe("bucketTasksIntoLanes — status / priority", () => {
  const colId = nextId();
  const col = makeColumn("status", colId);

  const lblA = makeLabel({ column_id: colId, name: "To Do", color: "#aaa", position: 1 });
  const lblB = makeLabel({ column_id: colId, name: "In Progress", color: "#bbb", position: 2 });
  const lblC = makeLabel({ column_id: colId, name: "Done", color: "#ccc", position: 3 });

  const labels = [lblA, lblB, lblC];
  const labelsByColumn = new Map([[colId, labels]]);

  it("buckets tasks into correct label lanes in label.position order", () => {
    const t1 = makeTask({ position: 1 });
    const t2 = makeTask({ position: 2 });
    const t3 = makeTask({ position: 3 });

    const cellsByKey = makeCellsByKey([
      [t1.id, colId, { label_id: lblA.id }],
      [t2.id, colId, { label_id: lblB.id }],
      [t3.id, colId, { label_id: lblC.id }],
    ]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1, t2, t3],
      cellsByKey,
      columns: [col],
      labelsByColumn,
      members: [],
    });

    expect(lanes).toHaveLength(4); // 3 labels + Unassigned
    expect(lanes[0].id).toBe(lblA.id);
    expect(lanes[0].taskIds).toEqual([t1.id]);
    expect(lanes[1].id).toBe(lblB.id);
    expect(lanes[1].taskIds).toEqual([t2.id]);
    expect(lanes[2].id).toBe(lblC.id);
    expect(lanes[2].taskIds).toEqual([t3.id]);
  });

  it("places tasks with null label_id into the Unassigned lane (last)", () => {
    const t1 = makeTask({ position: 1 }); // no cell → null
    const t2 = makeTask({ position: 2 });

    const cellsByKey = makeCellsByKey([[t2.id, colId, { label_id: lblA.id }]]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1, t2],
      cellsByKey,
      columns: [col],
      labelsByColumn,
      members: [],
    });

    const unassigned = lanes.find((l) => l.id === "unassigned");
    expect(unassigned).toBeDefined();
    expect(unassigned?.taskIds).toContain(t1.id);
    // Last lane
    expect(lanes[lanes.length - 1].id).toBe("unassigned");
  });

  it("includes the label color in the lane", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([[t1.id, colId, { label_id: lblA.id }]]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn,
      members: [],
    });

    const lane = lanes.find((l) => l.id === lblA.id);
    expect(lane?.color).toBe("#aaa");
  });

  it("sets dropValue to { labelId } for a label lane and { labelId: null } for unassigned", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([[t1.id, colId, { label_id: lblB.id }]]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn,
      members: [],
    });

    const lbLane = lanes.find((l) => l.id === lblB.id);
    expect(lbLane?.dropValue).toEqual({ labelId: lblB.id });

    const unassigned = lanes.find((l) => l.id === "unassigned");
    expect(unassigned?.dropValue).toEqual({ labelId: null });
  });
});

// ---------------------------------------------------------------------------
// person bucketing
// ---------------------------------------------------------------------------

describe("bucketTasksIntoLanes — person", () => {
  const colId = nextId();
  const col = makeColumn("person", colId);

  const memberAlice = makeMember({ display_name: "Alice", email: "alice@x.com" });
  const memberBob = makeMember({ display_name: "Bob", email: "bob@x.com" });
  const memberZara = makeMember({ display_name: "Zara", email: "zara@x.com" });

  const members = [memberZara, memberAlice, memberBob]; // intentionally unsorted

  it("sorts member lanes alphabetically by display_name with Unassigned last", () => {
    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members,
    });

    expect(lanes).toHaveLength(4); // Alice, Bob, Zara, Unassigned
    expect(lanes[0].title).toBe("Alice");
    expect(lanes[1].title).toBe("Bob");
    expect(lanes[2].title).toBe("Zara");
    expect(lanes[3].id).toBe("unassigned");
  });

  it("places single-assignee tasks in the correct member lane", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([
      [t1.id, colId, { json_value: { userIds: [memberBob.user_id] } }],
    ]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn: new Map(),
      members: [memberAlice, memberBob],
    });

    const bobLane = lanes.find((l) => l.id === memberBob.user_id);
    expect(bobLane?.taskIds).toContain(t1.id);

    const aliceLane = lanes.find((l) => l.id === memberAlice.user_id);
    expect(aliceLane?.taskIds).not.toContain(t1.id);
  });

  it("places multi-assignee tasks in ALL assigned member lanes", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([
      [t1.id, colId, { json_value: { userIds: [memberAlice.user_id, memberBob.user_id] } }],
    ]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn: new Map(),
      members: [memberAlice, memberBob],
    });

    const aliceLane = lanes.find((l) => l.id === memberAlice.user_id);
    const bobLane = lanes.find((l) => l.id === memberBob.user_id);
    expect(aliceLane?.taskIds).toContain(t1.id);
    expect(bobLane?.taskIds).toContain(t1.id);
  });

  it("places tasks with no assignees in the Unassigned lane", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([[t1.id, colId, { json_value: { userIds: [] } }]]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn: new Map(),
      members: [memberAlice],
    });

    const unassigned = lanes.find((l) => l.id === "unassigned");
    expect(unassigned?.taskIds).toContain(t1.id);
  });

  it("places tasks with no cell at all in the Unassigned lane", () => {
    const t1 = makeTask({ position: 1 });

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [memberAlice],
    });

    const unassigned = lanes.find((l) => l.id === "unassigned");
    expect(unassigned?.taskIds).toContain(t1.id);
  });

  it("sets dropValue to { userIds: [memberId] } for member lanes and { userIds: [] } for unassigned", () => {
    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [memberAlice],
    });

    const aliceLane = lanes.find((l) => l.id === memberAlice.user_id);
    expect(aliceLane?.dropValue).toEqual({ userIds: [memberAlice.user_id] });

    const unassigned = lanes.find((l) => l.id === "unassigned");
    expect(unassigned?.dropValue).toEqual({ userIds: [] });
  });
});

// ---------------------------------------------------------------------------
// checkbox bucketing
// ---------------------------------------------------------------------------

describe("bucketTasksIntoLanes — checkbox", () => {
  const colId = nextId();
  const col = makeColumn("checkbox", colId);

  it("produces exactly two lanes: Unchecked then Checked", () => {
    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes).toHaveLength(2);
    expect(lanes[0].id).toBe("unchecked");
    expect(lanes[1].id).toBe("checked");
  });

  it("places tasks with boolean_value=true in Checked", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([[t1.id, colId, { boolean_value: true }]]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes[1].id).toBe("checked");
    expect(lanes[1].taskIds).toContain(t1.id);
    expect(lanes[0].taskIds).not.toContain(t1.id);
  });

  it("places tasks with boolean_value=false in Unchecked", () => {
    const t1 = makeTask({ position: 1 });
    const cellsByKey = makeCellsByKey([[t1.id, colId, { boolean_value: false }]]);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey,
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes[0].id).toBe("unchecked");
    expect(lanes[0].taskIds).toContain(t1.id);
  });

  it("places tasks with null boolean_value (no cell) in Unchecked", () => {
    const t1 = makeTask({ position: 1 });

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [t1],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes[0].id).toBe("unchecked");
    expect(lanes[0].taskIds).toContain(t1.id);
  });

  it("sets dropValue=true for Checked and dropValue=false for Unchecked", () => {
    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes[0].dropValue).toBe(false);
    expect(lanes[1].dropValue).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("bucketTasksIntoLanes — edge cases", () => {
  it("returns empty lanes array when the column is not found", () => {
    const lanes = bucketTasksIntoLanes({
      groupByColumnId: "non-existent-col-id",
      tasks: [makeTask()],
      cellsByKey: new Map(),
      columns: [],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes).toHaveLength(0);
  });

  it("returns empty lanes array for unsupported column types", () => {
    const colId = nextId();
    const col = makeColumn("text", colId); // "text" is not a groupable type

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [makeTask()],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    expect(lanes).toHaveLength(0);
  });

  it("handles an empty task list gracefully (all lanes have taskIds=[])", () => {
    const colId = nextId();
    const col = makeColumn("checkbox", colId);

    const lanes = bucketTasksIntoLanes({
      groupByColumnId: colId,
      tasks: [],
      cellsByKey: new Map(),
      columns: [col],
      labelsByColumn: new Map(),
      members: [],
    });

    for (const lane of lanes) {
      expect(lane.taskIds).toHaveLength(0);
    }
  });
});
