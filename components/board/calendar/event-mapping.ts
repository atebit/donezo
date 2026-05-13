/**
 * event-mapping.ts — pure function: tasks + cells + dateColumnId → react-big-calendar events.
 *
 * Column type rules (per spec C.3):
 *   - `date`: produces allDay=true events with start===end. resizable=false.
 *   - `timeline`: produces allDay=true events with start + end from the cell's
 *     date_value / date_end_value pair. resizable=true.
 *   - Cells with a null date → NOT emitted here; they go in the OffCalendarPanel.
 *
 * The returned `CalendarEvent` type is what CalendarView passes to <Calendar />.
 */

import type { Cell, Column, Task } from "@/components/board/table/types";

/** A single react-big-calendar event derived from a task cell. */
export interface CalendarEvent {
  /** Unique react-big-calendar id (task.id — one event per task). */
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  /** Whether this event can be resized (only timeline columns). */
  resizable: boolean;
  /** Back-reference to the source task. */
  taskId: string;
}

/**
 * Map tasks to calendar events driven by a chosen date or timeline column.
 *
 * @param tasks     — the filtered, sorted task list from the store.
 * @param cellsByKey — Map keyed `${task_id}:${column_id}`.
 * @param column    — the chosen date or timeline column.
 * @returns         — events for tasks that have a date value; off-calendar
 *                    tasks are excluded (caller reads them separately).
 */
export function mapTasksToEvents(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
): CalendarEvent[] {
  const isTimeline = column.type === "timeline";
  const events: CalendarEvent[] = [];

  for (const task of tasks) {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    if (!cell) continue;

    if (isTimeline) {
      // timeline columns: date_value = start, date_end_value = end.
      const startStr = cell.date_value;
      const endStr = cell.date_end_value;
      if (!startStr) continue; // no start → off calendar

      const start = new Date(startStr);
      const end = endStr ? new Date(endStr) : start;

      events.push({
        id: task.id,
        title: task.title,
        start,
        end,
        allDay: true,
        resizable: true,
        taskId: task.id,
      });
    } else {
      // date column: single-day event.
      const dateStr = cell.date_value;
      if (!dateStr) continue;

      const day = new Date(dateStr);

      events.push({
        id: task.id,
        title: task.title,
        start: day,
        end: day,
        allDay: true,
        resizable: false,
        taskId: task.id,
      });
    }
  }

  return events;
}

/**
 * Return tasks whose date cell is null/missing for the given column.
 * These appear in the OffCalendarPanel.
 */
export function getOffCalendarTasks(
  tasks: Task[],
  cellsByKey: Map<string, Cell>,
  column: Column,
): Task[] {
  const isTimeline = column.type === "timeline";

  return tasks.filter((task) => {
    const cell = cellsByKey.get(`${task.id}:${column.id}`);
    if (!cell) return true; // no cell → off calendar
    if (isTimeline) return !cell.date_value;
    return !cell.date_value;
  });
}
