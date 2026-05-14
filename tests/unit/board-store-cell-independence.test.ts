/**
 * board-store-cell-independence.test.ts
 *
 * Regression tests for Slice F — "Same-type-columns independence bug" (Epic 16).
 *
 * Root cause: `hydrate()` was not receiving `columns` or `labels` from
 * `BoardDataProvider`, leaving `store.columns = []` and
 * `store.labelsByColumn = new Map()` after every page load.
 *
 * These tests verify:
 *   1. `hydrate()` correctly populates `columns` and `labelsByColumn` from
 *      the passed arrays.
 *   2. Two status columns on the same row have independent cell values in
 *      the store (keyed by `${task_id}:${column_id}`).
 *   3. `applyCellUpsert` for column A does not affect column B's cell.
 *   4. `applyLabelUpsert` / `applyLabelDelete` correctly scope to their
 *      column_id — updating one column's label list does not affect another.
 *   5. Hydration with two status columns produces a `labelsByColumn` Map
 *      keyed by each distinct column_id (not by type).
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../../lib/supabase/types";
import { useBoardStore } from "../../stores/board-store";

type Group = Database["public"]["Tables"]["group"]["Row"];
type Task = Database["public"]["Tables"]["task"]["Row"];
type Cell = Database["public"]["Tables"]["cell"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];
type Label = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-1",
    board_id: "board-1",
    name: "Group One",
    color: "#c4c4c4",
    position: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    board_id: "board-1",
    group_id: "group-1",
    title: "Task One",
    position: 1,
    created_by: null,
    updated_by: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "col-1",
    board_id: "board-1",
    name: "Status",
    type: "status",
    position: 2,
    settings: {},
    icon: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCell(overrides: Partial<Cell> = {}): Cell {
  return {
    task_id: "task-1",
    board_id: "board-1",
    column_id: "col-1",
    text_value: null,
    boolean_value: null,
    date_value: null,
    date_end_value: null,
    json_value: null,
    label_id: null,
    number_value: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    updated_by: null,
    ...overrides,
  };
}

function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    column_id: "col-1",
    name: "Done",
    color: "#00c875",
    position: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("board-store: same-type column independence (Epic 16 / Slice F)", () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
    useBoardStore.setState({ collapsedByBoard: {} });
  });

  // -------------------------------------------------------------------------
  // hydrate: columns + labels are populated
  // -------------------------------------------------------------------------

  describe("hydrate()", () => {
    it("populates store.columns from the passed columns array", () => {
      const colA = makeColumn({ id: "col-status-a", name: "Status A", position: 2 });
      const colB = makeColumn({ id: "col-status-b", name: "Status B", position: 3 });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [makeTask()],
        cells: [],
        columns: [colA, colB],
        labels: [],
      });

      const { columns } = useBoardStore.getState();
      expect(columns).toHaveLength(2);
      expect(columns.map((c) => c.id)).toEqual(["col-status-a", "col-status-b"]);
    });

    it("populates labelsByColumn keyed by column_id (not by type)", () => {
      const colA = makeColumn({ id: "col-status-a", type: "status", position: 2 });
      const colB = makeColumn({ id: "col-status-b", type: "status", position: 3 });

      const labelA1 = makeLabel({
        id: "lbl-a-done",
        column_id: "col-status-a",
        name: "Done A",
        position: 1,
      });
      const labelA2 = makeLabel({
        id: "lbl-a-stuck",
        column_id: "col-status-a",
        name: "Stuck A",
        position: 2,
      });
      const labelB1 = makeLabel({
        id: "lbl-b-done",
        column_id: "col-status-b",
        name: "Done B",
        position: 1,
      });
      const labelB2 = makeLabel({
        id: "lbl-b-prog",
        column_id: "col-status-b",
        name: "In Progress B",
        position: 2,
      });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [makeTask()],
        cells: [],
        columns: [colA, colB],
        labels: [labelA1, labelA2, labelB1, labelB2],
      });

      const { labelsByColumn } = useBoardStore.getState();

      // Each column has its own independent label set
      const labelsA = labelsByColumn.get("col-status-a") ?? [];
      const labelsB = labelsByColumn.get("col-status-b") ?? [];

      expect(labelsA).toHaveLength(2);
      expect(labelsB).toHaveLength(2);

      // Labels are sorted by position within each column
      expect(labelsA[0]?.id).toBe("lbl-a-done");
      expect(labelsA[1]?.id).toBe("lbl-a-stuck");
      expect(labelsB[0]?.id).toBe("lbl-b-done");
      expect(labelsB[1]?.id).toBe("lbl-b-prog");

      // Column A's labels do NOT appear in column B's list and vice-versa
      expect(labelsB.some((l) => l.id === "lbl-a-done")).toBe(false);
      expect(labelsA.some((l) => l.id === "lbl-b-done")).toBe(false);
    });

    it("cells are keyed by task_id:column_id — two same-type columns are independent", () => {
      const task1 = makeTask({ id: "task-1" });
      const colA = makeColumn({ id: "col-status-a", type: "status", position: 2 });
      const colB = makeColumn({ id: "col-status-b", type: "status", position: 3 });

      // task-1/colA is set to "Done A"; task-1/colB is unset
      const cellA = makeCell({
        task_id: "task-1",
        column_id: "col-status-a",
        label_id: "lbl-a-done",
        updated_at: "2024-01-01T01:00:00Z",
      });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [task1],
        cells: [cellA],
        columns: [colA, colB],
        labels: [],
      });

      const { cells } = useBoardStore.getState();

      // task-1/colA has the label
      expect(cells.get("task-1:col-status-a")?.label_id).toBe("lbl-a-done");
      // task-1/colB is absent (no cell row was provided)
      expect(cells.get("task-1:col-status-b")).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // applyCellUpsert: independence between two same-type columns
  // -------------------------------------------------------------------------

  describe("applyCellUpsert()", () => {
    it("setting colA's cell does not affect colB's cell on the same task", () => {
      const task1 = makeTask({ id: "task-1" });
      const colA = makeColumn({ id: "col-status-a", type: "status", position: 2 });
      const colB = makeColumn({ id: "col-status-b", type: "status", position: 3 });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [task1],
        cells: [],
        columns: [colA, colB],
        labels: [],
      });

      // Simulate setting colA to "Done"
      useBoardStore.getState().applyCellUpsert(
        makeCell({
          task_id: "task-1",
          column_id: "col-status-a",
          label_id: "lbl-a-done",
          updated_at: "2024-01-01T02:00:00Z",
        }),
      );

      const { cells } = useBoardStore.getState();

      // colA is set
      expect(cells.get("task-1:col-status-a")?.label_id).toBe("lbl-a-done");
      // colB is untouched — must still be absent
      expect(cells.get("task-1:col-status-b")).toBeUndefined();
    });

    it("setting colB does not disturb an already-set colA", () => {
      const task1 = makeTask({ id: "task-1" });
      const colA = makeColumn({ id: "col-status-a", type: "status", position: 2 });
      const colB = makeColumn({ id: "col-status-b", type: "status", position: 3 });

      // Seed: colA already has a value
      const cellA = makeCell({
        task_id: "task-1",
        column_id: "col-status-a",
        label_id: "lbl-a-done",
        updated_at: "2024-01-01T01:00:00Z",
      });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [task1],
        cells: [cellA],
        columns: [colA, colB],
        labels: [],
      });

      // Now set colB to a different label
      useBoardStore.getState().applyCellUpsert(
        makeCell({
          task_id: "task-1",
          column_id: "col-status-b",
          label_id: "lbl-b-prog",
          updated_at: "2024-01-01T02:00:00Z",
        }),
      );

      const { cells } = useBoardStore.getState();

      // colA remains unchanged
      expect(cells.get("task-1:col-status-a")?.label_id).toBe("lbl-a-done");
      // colB has the new value
      expect(cells.get("task-1:col-status-b")?.label_id).toBe("lbl-b-prog");
    });

    it("clearing colA (label_id=null) does not clear colB", () => {
      const task1 = makeTask({ id: "task-1" });
      const colA = makeColumn({ id: "col-status-a", type: "status", position: 2 });
      const colB = makeColumn({ id: "col-status-b", type: "status", position: 3 });

      // Seed: both columns are set
      const cellA = makeCell({
        task_id: "task-1",
        column_id: "col-status-a",
        label_id: "lbl-a-done",
        updated_at: "2024-01-01T01:00:00Z",
      });
      const cellB = makeCell({
        task_id: "task-1",
        column_id: "col-status-b",
        label_id: "lbl-b-prog",
        updated_at: "2024-01-01T01:00:00Z",
      });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [task1],
        cells: [cellA, cellB],
        columns: [colA, colB],
        labels: [],
      });

      // Clear colA (user clicked "Clear" in the status editor)
      useBoardStore.getState().applyCellUpsert(
        makeCell({
          task_id: "task-1",
          column_id: "col-status-a",
          label_id: null,
          updated_at: "2024-01-01T02:00:00Z",
        }),
      );

      const { cells } = useBoardStore.getState();

      // colA is cleared
      expect(cells.get("task-1:col-status-a")?.label_id).toBeNull();
      // colB retains its value
      expect(cells.get("task-1:col-status-b")?.label_id).toBe("lbl-b-prog");
    });
  });

  // -------------------------------------------------------------------------
  // applyLabelUpsert: scoped to column_id
  // -------------------------------------------------------------------------

  describe("applyLabelUpsert()", () => {
    it("adding a label to colA does not add it to colB", () => {
      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [makeTask()],
        cells: [],
        columns: [
          makeColumn({ id: "col-status-a", type: "status" }),
          makeColumn({ id: "col-status-b", type: "status", position: 3 }),
        ],
        labels: [
          makeLabel({ id: "lbl-a-done", column_id: "col-status-a", name: "Done", position: 1 }),
        ],
      });

      // Add a new label to colB
      useBoardStore.getState().applyLabelUpsert(
        makeLabel({
          id: "lbl-b-new",
          column_id: "col-status-b",
          name: "Pending",
          position: 1,
          updated_at: "2024-01-01T02:00:00Z",
        }),
      );

      const { labelsByColumn } = useBoardStore.getState();

      // colA still has only its original label
      expect(labelsByColumn.get("col-status-a")).toHaveLength(1);
      expect(labelsByColumn.get("col-status-a")?.[0]?.id).toBe("lbl-a-done");

      // colB now has its new label
      expect(labelsByColumn.get("col-status-b")).toHaveLength(1);
      expect(labelsByColumn.get("col-status-b")?.[0]?.id).toBe("lbl-b-new");
    });
  });

  // -------------------------------------------------------------------------
  // applyLabelDelete: removes only the target label
  // -------------------------------------------------------------------------

  describe("applyLabelDelete()", () => {
    it("deleting a label from colA does not affect colB", () => {
      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [makeTask()],
        cells: [],
        columns: [
          makeColumn({ id: "col-status-a", type: "status" }),
          makeColumn({ id: "col-status-b", type: "status", position: 3 }),
        ],
        labels: [
          makeLabel({ id: "lbl-a-done", column_id: "col-status-a", name: "Done A", position: 1 }),
          makeLabel({ id: "lbl-b-done", column_id: "col-status-b", name: "Done B", position: 1 }),
        ],
      });

      useBoardStore.getState().applyLabelDelete("lbl-a-done");

      const { labelsByColumn } = useBoardStore.getState();

      // colA's label was deleted
      expect(labelsByColumn.get("col-status-a") ?? []).toHaveLength(0);

      // colB is untouched
      expect(labelsByColumn.get("col-status-b")).toHaveLength(1);
      expect(labelsByColumn.get("col-status-b")?.[0]?.id).toBe("lbl-b-done");
    });
  });

  // -------------------------------------------------------------------------
  // Multi-task: independence across multiple tasks with two same-type columns
  // -------------------------------------------------------------------------

  describe("multi-task independence", () => {
    it("setting colA on task1 does not affect colA on task2 or colB on task1/task2", () => {
      const task1 = makeTask({ id: "task-1" });
      const task2 = makeTask({ id: "task-2", position: 2 });
      const colA = makeColumn({ id: "col-status-a", type: "status", position: 2 });
      const colB = makeColumn({ id: "col-status-b", type: "status", position: 3 });

      useBoardStore.getState().hydrate({
        boardId: "board-1",
        groups: [makeGroup()],
        tasks: [task1, task2],
        cells: [],
        columns: [colA, colB],
        labels: [],
      });

      // Set colA on task-1 only
      useBoardStore.getState().applyCellUpsert(
        makeCell({
          task_id: "task-1",
          column_id: "col-status-a",
          label_id: "lbl-done",
          updated_at: "2024-01-01T02:00:00Z",
        }),
      );

      const { cells } = useBoardStore.getState();

      expect(cells.get("task-1:col-status-a")?.label_id).toBe("lbl-done");
      expect(cells.get("task-1:col-status-b")).toBeUndefined();
      expect(cells.get("task-2:col-status-a")).toBeUndefined();
      expect(cells.get("task-2:col-status-b")).toBeUndefined();
    });
  });
});
