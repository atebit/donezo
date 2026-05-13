"use client";

/**
 * CalendarView — the top-level calendar kind component.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┬───────────┐
 *   │  [CalendarDateColumnPicker] [CardStyle]   │           │
 *   │──────────────────────────────────────────│ Off-Cal   │
 *   │                                           │ Panel     │
 *   │           <Calendar />                    │  (12rem)  │
 *   │                                           │           │
 *   └──────────────────────────────────────────┴───────────┘
 *
 * DnD strategy (spec C.4):
 *   - The calendar is wrapped in dnd-kit's <DndContext>.
 *   - Day cells are droppable: a custom dayPropGetter injects `data-date={iso}`
 *     on the cell. The DroppableDayOverlay component registers each day as a
 *     dnd-kit droppable keyed on the ISO date string.
 *   - On drag-end, setCellValue updates the date cell.
 *
 * CSS: `react-big-calendar/lib/css/react-big-calendar.css` is imported here
 * (the client component boundary — NOT the RSC page.tsx).
 *
 * Slice C — C.2.
 */

import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar.css";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DateCellWrapperProps, EventProps, View } from "react-big-calendar";
import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { Calendar } from "react-big-calendar";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { setCellValue } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import { createTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { TaskCard } from "@/components/board/shared/TaskCard";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";
import { CalendarDateColumnPicker } from "./CalendarDateColumnPicker";
import { calendarLocalizer } from "./calendar-localizer";
import { type CalendarEvent, getOffCalendarTasks, mapTasksToEvents } from "./event-mapping";
import { OffCalendarPanel } from "./OffCalendarPanel";

// ---------------------------------------------------------------------------
// DroppableDayOverlay — transparent overlay on each day cell so dnd-kit can
// intercept drops. The droppable id is the ISO date string.
// ---------------------------------------------------------------------------

function DroppableDayOverlay({ date }: { date: Date }) {
  const iso = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  return (
    <div
      ref={setNodeRef}
      data-date={iso}
      data-drop-active={isOver ? "true" : undefined}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export function CalendarView() {
  const { board, workspaceSlug } = useBoard();
  const { effective, applyDraft } = useBoardView();

  const { tasks, cells, columns, groups } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
      groups: s.groups,
    })),
  );

  const calendarConfig = effective.calendar;
  const dateColumnId = calendarConfig?.dateColumnId ?? null;
  // Our schema uses "month"|"week"|"day"|"agenda"; RBC also supports "work_week"
  // but we don't expose it in config. Cast is safe.
  const calendarView = (calendarConfig?.viewMode ?? "month") as View;

  // Find the active date column.
  const dateColumn = useMemo(
    () => (dateColumnId ? columns.find((c) => c.id === dateColumnId) ?? null : null),
    [columns, dateColumnId],
  );

  // Derive events — memoised (spec risk note #8).
  const events = useMemo<CalendarEvent[]>(() => {
    if (!dateColumn) return [];
    return mapTasksToEvents(tasks, cells, dateColumn);
  }, [tasks, cells, dateColumn]);

  // Derive off-calendar tasks.
  const offCalendarTasks = useMemo(() => {
    if (!dateColumn) return tasks;
    return getOffCalendarTasks(tasks, cells, dateColumn);
  }, [tasks, cells, dateColumn]);

  // First live group for quick-create (spec C.5).
  const firstGroupId = useMemo(
    () => groups.find((g) => !g.deleted_at)?.id ?? null,
    [groups],
  );

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ---------------------------------------------------------------------------
  // Parse a dnd-kit active id to the underlying taskId.
  // Formats: `task-${taskId}` or `off-calendar:${taskId}`.
  // ---------------------------------------------------------------------------
  function parseTaskId(activeId: string): string | null {
    if (activeId.startsWith("task-")) return activeId.slice(5);
    if (activeId.startsWith("off-calendar:")) return activeId.slice(13);
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    const tid = parseTaskId(String(e.active.id));
    setDraggingTaskId(tid);
  }

  // ---------------------------------------------------------------------------
  // Drag end — reschedule a task by updating its date cell.
  // ---------------------------------------------------------------------------
  async function handleDragEnd(e: DragEndEvent) {
    setDraggingTaskId(null);

    const overIsoDate = e.over?.id as string | undefined;
    if (!overIsoDate || !dateColumnId) return;

    const taskId = parseTaskId(String(e.active.id));
    if (!taskId) return;

    const col = columns.find((c) => c.id === dateColumnId);
    if (!col) return;

    const isTimeline = col.type === "timeline";

    if (isTimeline) {
      const cellKey = `${taskId}:${dateColumnId}`;
      const existingCell = cells.get(cellKey);
      const existingStart = existingCell?.date_value ? new Date(existingCell.date_value) : null;
      const existingEnd = existingCell?.date_end_value ? new Date(existingCell.date_end_value) : null;

      const newStart = overIsoDate;
      let newEnd = overIsoDate;

      if (existingStart && existingEnd) {
        const duration = existingEnd.getTime() - existingStart.getTime();
        const newEndDate = new Date(new Date(overIsoDate).getTime() + duration);
        newEnd = format(newEndDate, "yyyy-MM-dd");
      }

      const result = await setCellValue({
        taskId,
        columnId: dateColumnId,
        value: { start: newStart, end: newEnd },
      });
      if (!("id" in result)) {
        toast.error("Failed to reschedule task");
      }
    } else {
      const result = await setCellValue({
        taskId,
        columnId: dateColumnId,
        value: { date: overIsoDate },
      });
      if (!("id" in result)) {
        toast.error("Failed to reschedule task");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Quick-create on slot click (spec C.5).
  // ---------------------------------------------------------------------------
  const handleSelectSlot = useCallback(
    async (slot: { start: Date; end: Date; action: string }) => {
      if (!firstGroupId || !dateColumnId) return;
      if (slot.action !== "click" && slot.action !== "select") return;

      const isoDate = format(slot.start, "yyyy-MM-dd");
      const lastTask = tasks[tasks.length - 1];
      const position = (lastTask?.position ?? 0) + 1;

      const taskResult = await createTask({
        groupId: firstGroupId,
        title: "New task",
        position,
      });

      if (!("id" in taskResult)) {
        toast.error("Failed to create task");
        return;
      }

      const newTaskId = (taskResult as { id: string }).id;

      const cellResult = await setCellValue({
        taskId: newTaskId,
        columnId: dateColumnId,
        value: { date: isoDate },
      });

      if (!("id" in cellResult)) {
        toast.error("Failed to set task date");
        return;
      }

      toast.success(`Task created on ${isoDate}`);
    },
    [firstGroupId, dateColumnId, tasks],
  );

  // ---------------------------------------------------------------------------
  // Click an event — open task drawer via the @modal intercept route.
  // ---------------------------------------------------------------------------
  const handleSelectEvent = useCallback(
    (event: CalendarEvent) => {
      const url = `/w/${workspaceSlug}/b/${board.id}/t/${event.taskId}`;
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [workspaceSlug, board.id],
  );

  // ---------------------------------------------------------------------------
  // View mode changes (month / week / day / agenda).
  // ---------------------------------------------------------------------------
  const handleViewChange = useCallback(
    (view: View) => {
      // Only persist our supported view modes (not "work_week").
      const supported = ["month", "week", "day", "agenda"] as const;
      type SupportedView = (typeof supported)[number];
      if (!supported.includes(view as SupportedView)) return;

      applyDraft({
        calendar: {
          dateColumnId: effective.calendar?.dateColumnId ?? null,
          viewMode: view as SupportedView,
        },
      });
    },
    [applyDraft, effective.calendar],
  );

  // ---------------------------------------------------------------------------
  // Custom dateCellWrapper — mounts a DroppableDayOverlay on each day cell.
  // The type must match react-big-calendar's DateCellWrapperProps.
  // ---------------------------------------------------------------------------
  const DateCellWrapper = useCallback(
    ({ children, value }: DateCellWrapperProps) => (
      <div style={{ position: "relative", flex: 1 }}>
        <DroppableDayOverlay date={value} />
        {children}
      </div>
    ),
    [],
  );

  // ---------------------------------------------------------------------------
  // Custom event component — renders a <TaskCard /> for each calendar event.
  // We derive cardStyle from calendar.cardStyle (per-kind), falling back to
  // the view-level cardStyle if available (dispatch plan Q27: top-level key).
  // Since ViewConfig does NOT have a top-level cardStyle key (only per-kind),
  // we use calendar.cardStyle only.
  // ---------------------------------------------------------------------------
  const cardStyle = effective.calendar?.cardStyle;

  const EventComponent = useCallback(
    ({ event }: EventProps<CalendarEvent>) => {
      const task = tasks.find((t) => t.id === event.taskId);
      if (!task) return null;

      return (
        <div
          data-task-id={event.taskId}
          style={{ opacity: draggingTaskId === event.taskId ? 0.3 : 1 }}
        >
          <TaskCard
            task={task}
            cellsByKey={cells}
            columns={columns}
            cardStyle={cardStyle}
            onClick={() => handleSelectEvent(event)}
          />
        </div>
      );
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: stable handler refs; deep dep on tasks/cells needs useShallow
    [tasks, cells, columns, cardStyle, draggingTaskId, handleSelectEvent],
  );

  // ---------------------------------------------------------------------------
  // Empty state — no date column picked.
  // ---------------------------------------------------------------------------
  if (!dateColumnId || !dateColumn) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <CalendarDateColumnPicker />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[color:var(--color-fg-subtle)] text-center max-w-xs">
            Pick a date column to show your tasks on a calendar.
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render — calendar with dnd-kit overlay.
  // ---------------------------------------------------------------------------
  const draggingTask = draggingTaskId ? tasks.find((t) => t.id === draggingTaskId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Top toolbar slot */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <CalendarDateColumnPicker />
        </div>

        {/* Main area + right rail */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Calendar */}
          <div className="flex-1 min-w-0 overflow-auto p-3">
            <Calendar<CalendarEvent>
              localizer={calendarLocalizer}
              events={events}
              view={calendarView}
              onView={handleViewChange}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              selectable
              components={{
                event: EventComponent,
                dateCellWrapper: DateCellWrapper,
              }}
              style={{ height: "100%", minHeight: 500 }}
            />
          </div>

          {/* Right rail — off-calendar panel */}
          <OffCalendarPanel tasks={offCalendarTasks} />
        </div>
      </div>

      {/* DragOverlay — shown while dragging */}
      <DragOverlay>
        {draggingTask ? (
          <div style={{ width: 220, opacity: 0.9, transform: "rotate(2deg)" }}>
            <TaskCard
              task={draggingTask}
              cellsByKey={cells}
              columns={columns}
              cardStyle={cardStyle}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
