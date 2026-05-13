/**
 * Unit tests for widget-data.ts pure aggregation helpers.
 *
 * Epic 12, Slice E.
 * Uses vitest (node environment — no browser/React required).
 */

// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

import {
  aggregateForWidget,
  bucketValuesByColumn,
  extractColumnValues,
  timeSeriesBuckets,
} from "@/components/board/dashboard/widget-data";
import type { Database } from "@/lib/supabase/types";

type Task = Database["public"]["Tables"]["task"]["Row"];
type Cell = Database["public"]["Tables"]["cell"]["Row"];
type Column = Database["public"]["Tables"]["column"]["Row"];
type Label = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    board_id: "board-1",
    group_id: "group-1",
    title: `Task ${id}`,
    position: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    created_by: "user-1",
    updated_by: "user-1",
    ...overrides,
  };
}

function makeCell(taskId: string, columnId: string, overrides: Partial<Cell> = {}): Cell {
  return {
    id: `${taskId}:${columnId}`,
    task_id: taskId,
    column_id: columnId,
    board_id: "board-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    text_value: null,
    number_value: null,
    boolean_value: null,
    date_value: null,
    date_end_value: null,
    label_id: null,
    json_value: null,
    ...overrides,
  };
}

function makeColumn(id: string, type: string, overrides: Partial<Column> = {}): Column {
  return {
    id,
    board_id: "board-1",
    name: `Column ${id}`,
    type,
    position: 0,
    settings: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeLabel(
  id: string,
  columnId: string,
  name: string,
  color: string,
  position: number,
): Label {
  return {
    id,
    column_id: columnId,
    name,
    color,
    position,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// bucketValuesByColumn tests
// ---------------------------------------------------------------------------

describe("bucketValuesByColumn", () => {
  it("returns a single 'None' bucket when column doesn't exist", () => {
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>();
    const columns: Column[] = [];
    const labelsByColumn = new Map<string, Label[]>();

    const result = bucketValuesByColumn(tasks, cells, columns, labelsByColumn, "nonexistent");
    expect(result).toHaveLength(1);
    expect(result[0]?.bucketKey).toBe("none");
    expect(result[0]?.tasks).toHaveLength(2);
  });

  it("buckets status cells by label id with correct label names", () => {
    const colId = "col-status";
    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
    const labelA = makeLabel("label-a", colId, "Done", "#00c875", 0);
    const labelB = makeLabel("label-b", colId, "In Progress", "#fdab3d", 1);

    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { label_id: "label-a" })],
      [`t2:${colId}`, makeCell("t2", colId, { label_id: "label-b" })],
      // t3 has no cell → "None"
    ]);
    const columns = [makeColumn(colId, "status")];
    const labelsByColumn = new Map([[colId, [labelA, labelB]]]);

    const result = bucketValuesByColumn(tasks, cells, columns, labelsByColumn, colId);

    // Should have Done, In Progress, None
    const doneGroup = result.find((g) => g.bucketKey === "label-a");
    const inProgressGroup = result.find((g) => g.bucketKey === "label-b");
    const noneGroup = result.find((g) => g.bucketKey === "__none__");

    expect(doneGroup?.bucketLabel).toBe("Done");
    expect(doneGroup?.bucketColor).toBe("#00c875");
    expect(doneGroup?.tasks).toHaveLength(1);
    expect(inProgressGroup?.tasks).toHaveLength(1);
    expect(noneGroup?.tasks).toHaveLength(1);
  });

  it("buckets number cells by string-coerced value", () => {
    const colId = "col-number";
    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { number_value: 100 })],
      [`t2:${colId}`, makeCell("t2", colId, { number_value: 100 })],
      [`t3:${colId}`, makeCell("t3", colId, { number_value: 50 })],
    ]);
    const columns = [makeColumn(colId, "number")];
    const labelsByColumn = new Map<string, Label[]>();

    const result = bucketValuesByColumn(tasks, cells, columns, labelsByColumn, colId);

    const bucket100 = result.find((g) => g.bucketKey === "100");
    const bucket50 = result.find((g) => g.bucketKey === "50");

    expect(bucket100?.tasks).toHaveLength(2);
    expect(bucket50?.tasks).toHaveLength(1);
  });

  it("buckets checkbox cells into Checked / Unchecked / None", () => {
    const colId = "col-checkbox";
    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { boolean_value: true })],
      [`t2:${colId}`, makeCell("t2", colId, { boolean_value: false })],
      // t3 has no cell → None
    ]);
    const columns = [makeColumn(colId, "checkbox")];
    const labelsByColumn = new Map<string, Label[]>();

    const result = bucketValuesByColumn(tasks, cells, columns, labelsByColumn, colId);

    expect(result.find((g) => g.bucketKey === "true")?.tasks).toHaveLength(1);
    expect(result.find((g) => g.bucketKey === "false")?.tasks).toHaveLength(1);
    expect(result.find((g) => g.bucketKey === "__none__")?.tasks).toHaveLength(1);
  });

  it("places '__none__' bucket last in sorted output", () => {
    const colId = "col-status";
    const tasks = [makeTask("t1"), makeTask("t2")];
    const labelA = makeLabel("label-a", colId, "Done", "#00c875", 0);

    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { label_id: "label-a" })],
      // t2 has no cell → None
    ]);
    const columns = [makeColumn(colId, "status")];
    const labelsByColumn = new Map([[colId, [labelA]]]);

    const result = bucketValuesByColumn(tasks, cells, columns, labelsByColumn, colId);

    expect(result[result.length - 1]?.bucketKey).toBe("__none__");
  });
});

// ---------------------------------------------------------------------------
// timeSeriesBuckets tests
// ---------------------------------------------------------------------------

describe("timeSeriesBuckets", () => {
  const colId = "col-date";

  it("groups tasks into day buckets", () => {
    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { date_value: "2024-03-15T00:00:00Z" })],
      [`t2:${colId}`, makeCell("t2", colId, { date_value: "2024-03-15T12:00:00Z" })],
      [`t3:${colId}`, makeCell("t3", colId, { date_value: "2024-03-16T00:00:00Z" })],
    ]);

    const result = timeSeriesBuckets(tasks, cells, colId, "day");

    expect(result).toHaveLength(2);
    expect(result[0]?.dateKey).toBe("2024-03-15");
    expect(result[0]?.tasks).toHaveLength(2);
    expect(result[1]?.dateKey).toBe("2024-03-16");
    expect(result[1]?.tasks).toHaveLength(1);
  });

  it("groups tasks into month buckets", () => {
    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { date_value: "2024-01-05T00:00:00Z" })],
      [`t2:${colId}`, makeCell("t2", colId, { date_value: "2024-01-20T00:00:00Z" })],
      [`t3:${colId}`, makeCell("t3", colId, { date_value: "2024-02-10T00:00:00Z" })],
    ]);

    const result = timeSeriesBuckets(tasks, cells, colId, "month");

    expect(result).toHaveLength(2);
    expect(result[0]?.dateKey).toBe("2024-01");
    expect(result[0]?.tasks).toHaveLength(2);
    expect(result[1]?.dateKey).toBe("2024-02");
    expect(result[1]?.tasks).toHaveLength(1);
  });

  it("groups tasks into week buckets (ISO week)", () => {
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>([
      // 2024-01-08 is week 2
      [`t1:${colId}`, makeCell("t1", colId, { date_value: "2024-01-08T00:00:00Z" })],
      [`t2:${colId}`, makeCell("t2", colId, { date_value: "2024-01-09T00:00:00Z" })],
    ]);

    const result = timeSeriesBuckets(tasks, cells, colId, "week");

    expect(result).toHaveLength(1);
    expect(result[0]?.dateKey).toBe("2024-W02");
    expect(result[0]?.tasks).toHaveLength(2);
  });

  it("appends tasks with no date in a '__no_date__' bucket at the end", () => {
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { date_value: "2024-03-15T00:00:00Z" })],
      // t2 has no cell value → no_date
    ]);

    const result = timeSeriesBuckets(tasks, cells, colId, "day");

    expect(result[result.length - 1]?.dateKey).toBe("__no_date__");
    expect(result[result.length - 1]?.tasks).toHaveLength(1);
  });

  it("returns empty array for all tasks with no dates", () => {
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>();

    const result = timeSeriesBuckets(tasks, cells, colId, "day");

    // Only the __no_date__ bucket.
    expect(result).toHaveLength(1);
    expect(result[0]?.dateKey).toBe("__no_date__");
    expect(result[0]?.tasks).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// aggregateForWidget tests
// ---------------------------------------------------------------------------

describe("aggregateForWidget", () => {
  it("returns count of items", () => {
    const values = [1, 2, 3, null, 5];
    const result = aggregateForWidget(values, "count", "number", {});
    expect(result.display).toBe("5");
    expect(result.numeric).toBe(5);
  });

  it("returns sum of numeric values", () => {
    const values = [10, 20, 70];
    const result = aggregateForWidget(values, "sum", "number", {});
    expect(result.display).toBe("100");
    expect(result.numeric).toBe(100);
  });

  it("returns average of numeric values", () => {
    const values = [10, 20, 30];
    const result = aggregateForWidget(values, "avg", "number", {});
    expect(result.display).toBe("20.00");
    expect(result.numeric).toBe(20);
  });

  it("returns '—' for unsupported aggregation kind on a text column", () => {
    const values = ["hello", "world"];
    // 'sum' is not in textType.aggregations
    const result = aggregateForWidget(values, "sum", "text", {});
    expect(result.display).toBe("—");
    expect(result.numeric).toBeNull();
  });

  it("returns '—' for unknown column type", () => {
    const values = [1, 2, 3];
    // @ts-expect-error intentional unknown type for test
    const result = aggregateForWidget(values, "count", "unknown_type", {});
    expect(result.display).toBe("—");
    expect(result.numeric).toBeNull();
  });

  it("computes min correctly", () => {
    const values = [5, 2, 8, 1, 9];
    const result = aggregateForWidget(values, "min", "number", {});
    expect(result.display).toBe("1");
    expect(result.numeric).toBe(1);
  });

  it("computes max correctly", () => {
    const values = [5, 2, 8, 1, 9];
    const result = aggregateForWidget(values, "max", "number", {});
    expect(result.display).toBe("9");
    expect(result.numeric).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// extractColumnValues tests
// ---------------------------------------------------------------------------

describe("extractColumnValues", () => {
  it("returns empty array for unknown column", () => {
    const tasks = [makeTask("t1")];
    const cells = new Map<string, Cell>();
    const columns: Column[] = [];

    const result = extractColumnValues(tasks, cells, columns, "nonexistent");
    expect(result).toHaveLength(0);
  });

  it("extracts number values from cells", () => {
    const colId = "col-num";
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { number_value: 42 })],
      [`t2:${colId}`, makeCell("t2", colId, { number_value: 100 })],
    ]);
    const columns = [makeColumn(colId, "number")];

    const result = extractColumnValues(tasks, cells, columns, colId);
    expect(result).toEqual([42, 100]);
  });

  it("returns null for tasks with no cell row", () => {
    const colId = "col-num";
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { number_value: 42 })],
      // t2 has no cell
    ]);
    const columns = [makeColumn(colId, "number")];

    const result = extractColumnValues(tasks, cells, columns, colId);
    expect(result).toEqual([42, null]);
  });

  it("extracts text values correctly", () => {
    const colId = "col-text";
    const tasks = [makeTask("t1"), makeTask("t2")];
    const cells = new Map<string, Cell>([
      [`t1:${colId}`, makeCell("t1", colId, { text_value: "hello" })],
      [`t2:${colId}`, makeCell("t2", colId, { text_value: "world" })],
    ]);
    const columns = [makeColumn(colId, "text")];

    const result = extractColumnValues(tasks, cells, columns, colId);
    expect(result).toEqual(["hello", "world"]);
  });
});
