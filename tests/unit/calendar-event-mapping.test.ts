/**
 * calendar-event-mapping.test.ts — unit tests for event-mapping.ts.
 *
 * Covers (per spec C.7):
 *   - date column: produces allDay=true, start===end, resizable=false.
 *   - timeline column: produces allDay=true, start/end from cell values, resizable=true.
 *   - null / empty cell → excluded from events, included in off-calendar list.
 *   - Multiple tasks with mixed null/non-null cells.
 *   - timeline with only start (no end) → end defaults to start.
 *
 * Slice C — Epic 12.
 */

// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import {
  getOffCalendarTasks,
  mapTasksToEvents,
} from "@/components/board/calendar/event-mapping";
import type { Cell, Column, Task } from "@/components/board/table/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTask(id: string, title = "Task"): Task {
  return {
    id,
    title,
    position: 1,
    board_id: "board-1",
    group_id: "group-1",
    created_by: "user-1",
    updated_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  } as unknown as Task;
}

function makeCell(
  taskId: string,
  columnId: string,
  dateValue: string | null,
  dateEndValue?: string | null,
): Cell {
  return {
    id: `${taskId}:${columnId}`,
    task_id: taskId,
    column_id: columnId,
    board_id: "board-1",
    date_value: dateValue,
    date_end_value: dateEndValue ?? null,
    text_value: null,
    number_value: null,
    boolean_value: null,
    json_value: null,
    label_id: null,
    updated_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Cell;
}

function makeDateColumn(id = "col-date"): Column {
  return {
    id,
    board_id: "board-1",
    name: "Due date",
    type: "date",
    position: 1,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Column;
}

function makeTimelineColumn(id = "col-timeline"): Column {
  return {
    id,
    board_id: "board-1",
    name: "Sprint",
    type: "timeline",
    position: 2,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Column;
}

function buildCellMap(cells: Cell[]): Map<string, Cell> {
  const m = new Map<string, Cell>();
  for (const c of cells) {
    m.set(`${c.task_id}:${c.column_id}`, c);
  }
  return m;
}

// ---------------------------------------------------------------------------
// mapTasksToEvents — date column
// ---------------------------------------------------------------------------

describe("mapTasksToEvents — date column", () => {
  const col = makeDateColumn();
  const task1 = makeTask("t1", "Finish report");
  const task2 = makeTask("t2", "Meeting");
  const task3 = makeTask("t3", "No date task");

  const cells = [
    makeCell("t1", col.id, "2026-06-01"),
    makeCell("t2", col.id, "2026-06-15"),
    // task3 has no cell
  ];
  const cellMap = buildCellMap(cells);

  it("produces one event per task that has a date cell", () => {
    const events = mapTasksToEvents([task1, task2, task3], cellMap, col);
    expect(events).toHaveLength(2);
  });

  it("sets allDay=true for date columns", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    expect(events[0]?.allDay).toBe(true);
  });

  it("sets resizable=false for date columns", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    expect(events[0]?.resizable).toBe(false);
  });

  it("sets start and end to the same date for date columns", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    const ev = events[0];
    expect(ev?.start.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(ev?.end.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(ev?.start.getTime()).toBe(ev?.end.getTime());
  });

  it("preserves the task title", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    expect(events[0]?.title).toBe("Finish report");
  });

  it("sets taskId to the task id", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    expect(events[0]?.taskId).toBe("t1");
  });

  it("excludes tasks with no cell", () => {
    const events = mapTasksToEvents([task3], cellMap, col);
    expect(events).toHaveLength(0);
  });

  it("excludes tasks with null date_value", () => {
    const nullCell = makeCell("t3", col.id, null);
    const m = buildCellMap([...cells, nullCell]);
    const events = mapTasksToEvents([task3], m, col);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mapTasksToEvents — timeline column
// ---------------------------------------------------------------------------

describe("mapTasksToEvents — timeline column", () => {
  const col = makeTimelineColumn();
  const task1 = makeTask("t1", "Sprint 1");
  const task2 = makeTask("t2", "No start");
  const task3 = makeTask("t3", "Start only");

  const cells = [
    makeCell("t1", col.id, "2026-06-01", "2026-06-14"),
    makeCell("t2", col.id, null, null),
    makeCell("t3", col.id, "2026-06-20", null), // start only, no end
  ];
  const cellMap = buildCellMap(cells);

  it("produces events for tasks with a start date", () => {
    const events = mapTasksToEvents([task1, task2, task3], cellMap, col);
    expect(events).toHaveLength(2);
  });

  it("sets allDay=true for timeline columns", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    expect(events[0]?.allDay).toBe(true);
  });

  it("sets resizable=true for timeline columns", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    expect(events[0]?.resizable).toBe(true);
  });

  it("maps start and end dates from the cell", () => {
    const events = mapTasksToEvents([task1], cellMap, col);
    const ev = events[0];
    expect(ev?.start.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(ev?.end.toISOString().slice(0, 10)).toBe("2026-06-14");
  });

  it("defaults end to start when date_end_value is null", () => {
    const events = mapTasksToEvents([task3], cellMap, col);
    const ev = events[0];
    expect(ev?.start.toISOString().slice(0, 10)).toBe("2026-06-20");
    expect(ev?.end.toISOString().slice(0, 10)).toBe("2026-06-20");
  });

  it("excludes tasks with null start (date_value)", () => {
    const events = mapTasksToEvents([task2], cellMap, col);
    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getOffCalendarTasks
// ---------------------------------------------------------------------------

describe("getOffCalendarTasks", () => {
  const col = makeDateColumn();
  const task1 = makeTask("t1");
  const task2 = makeTask("t2");
  const task3 = makeTask("t3");

  const cells = [
    makeCell("t1", col.id, "2026-06-01"),
    makeCell("t2", col.id, null), // null date
    // task3 has no cell
  ];
  const cellMap = buildCellMap(cells);

  it("returns tasks with no date cell", () => {
    const off = getOffCalendarTasks([task1, task2, task3], cellMap, col);
    // task2 (null date) and task3 (no cell) are off-calendar
    expect(off.map((t) => t.id).sort()).toEqual(["t2", "t3"].sort());
  });

  it("excludes tasks that have a date cell", () => {
    const off = getOffCalendarTasks([task1], cellMap, col);
    expect(off).toHaveLength(0);
  });

  it("handles timeline columns — off when start is null", () => {
    const tlCol = makeTimelineColumn();
    const tlCells = [
      makeCell("t1", tlCol.id, "2026-06-01", "2026-06-07"),
      makeCell("t2", tlCol.id, null, null),
    ];
    const tlMap = buildCellMap(tlCells);
    const off = getOffCalendarTasks([task1, task2], tlMap, tlCol);
    expect(off).toHaveLength(1);
    expect(off[0]?.id).toBe("t2");
  });
});
