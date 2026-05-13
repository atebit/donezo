"use client";

/**
 * TimelineView — top-level Gantt chart view component.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────┬──────────┐
 *   │  [TimelineColumnPicker] [TimelineScaleSwitcher] │          │
 *   ├────────────────────────────────────────────────┤Unsched.  │
 *   │  [TimelineHeader] (sticky time axis)            │ Panel    │
 *   ├────────────────────────────────────────────────┤          │
 *   │  Virtualized row list (TanStack Virtual)        │          │
 *   │  Each row: sticky label + bar slot              │          │
 *   └────────────────────────────────────────────────┴──────────┘
 *
 * Data flow:
 *   - Reads tasks + cells from `useBoardStore` (with `useShallow`).
 *   - Reads `view.config.timeline` from `useBoardView`.
 *   - Bar drag/resize → `setCellValue` server action.
 *   - Scale change → `applyDraft({ timeline: { scale } })`.
 *   - Unscheduled drop → `setCellValue` with computed start+end.
 *
 * Virtualization uses `@tanstack/react-virtual` for the row list.
 * The today line is a 1px CSS overlay positioned at the current date's X.
 * Weekend shading is applied per-row inside `<TimelineRow />`.
 *
 * Epic 12, Slice D — D.2.
 */

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { setCellValue } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import type { Task } from "@/components/board/table/types";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";
import { TimelineColumnPicker } from "./TimelineColumnPicker";
import { TimelineHeader } from "./TimelineHeader";
import { LABEL_COL_WIDTH, ROW_HEIGHT, TimelineRow } from "./TimelineRow";
import { TimelineScaleSwitcher } from "./TimelineScaleSwitcher";
import { TimelineUnscheduled } from "./TimelineUnscheduled";
import {
  dateToX,
  defaultOriginDate,
  headerDates,
  pxPerDay,
  type Scale,
  xToDate,
} from "./timeline-math";

// ---------------------------------------------------------------------------
// Bar colour — placeholder; colourBy will be wired in a followup
// ---------------------------------------------------------------------------
const DEFAULT_BAR_COLOR = "var(--color-primary)";

// ---------------------------------------------------------------------------
// Default duration for dropped unscheduled tasks (in days)
// ---------------------------------------------------------------------------
function defaultDuration(scale: Scale): number {
  return scale === "day" || scale === "week" ? 1 : 7;
}

// ---------------------------------------------------------------------------
// TimelineView
// ---------------------------------------------------------------------------

export function TimelineView() {
  const { board, workspaceSlug } = useBoard();
  const { effective, applyDraft, save } = useBoardView();

  const { tasks, cells } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
    })),
  );

  // ---------------------------------------------------------------------------
  // Derive config from the active view
  // ---------------------------------------------------------------------------
  const timelineConfig = effective.timeline;
  const timelineColumnId = timelineConfig?.timelineColumnId ?? null;
  const scale = (timelineConfig?.scale ?? "week") as Scale;

  // ---------------------------------------------------------------------------
  // Container ref + measured width
  // ---------------------------------------------------------------------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(960);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidthPx(entry.contentRect.width - LABEL_COL_WIDTH);
    });
    ro.observe(el);
    // Initial measurement.
    setContainerWidthPx(el.clientWidth - LABEL_COL_WIDTH);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // Separate scheduled vs unscheduled tasks
  // ---------------------------------------------------------------------------
  const { scheduledTasks, unscheduledTasks } = useMemo(() => {
    if (!timelineColumnId) {
      return { scheduledTasks: [], unscheduledTasks: tasks };
    }
    const scheduled: Task[] = [];
    const unscheduled: Task[] = [];

    for (const task of tasks) {
      const cell = cells.get(`${task.id}:${timelineColumnId}`);
      if (cell?.date_value) {
        scheduled.push(task);
      } else {
        unscheduled.push(task);
      }
    }
    return { scheduledTasks: scheduled, unscheduledTasks: unscheduled };
  }, [tasks, cells, timelineColumnId]);

  // ---------------------------------------------------------------------------
  // Origin date — derived from the earliest scheduled task
  // ---------------------------------------------------------------------------
  const originDate = useMemo(() => {
    if (!timelineColumnId) {
      return format(startOfDay(new Date()), "yyyy-MM-dd");
    }
    const startDates = scheduledTasks
      .map((t) => cells.get(`${t.id}:${timelineColumnId}`)?.date_value)
      .filter((d): d is string => Boolean(d));
    return defaultOriginDate(startDates, scale, containerWidthPx);
  }, [scheduledTasks, cells, timelineColumnId, scale, containerWidthPx]);

  // ---------------------------------------------------------------------------
  // Header dates
  // ---------------------------------------------------------------------------
  const dates = useMemo(
    () => headerDates(scale, originDate, containerWidthPx),
    [scale, originDate, containerWidthPx],
  );

  // ---------------------------------------------------------------------------
  // Today line X position
  // ---------------------------------------------------------------------------
  const todayX = useMemo(() => {
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    return dateToX(today, originDate, scale, containerWidthPx);
  }, [originDate, scale, containerWidthPx]);

  // ---------------------------------------------------------------------------
  // Virtualizer
  // ---------------------------------------------------------------------------
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: scheduledTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ---------------------------------------------------------------------------
  // Sync horizontal scroll → header
  // ---------------------------------------------------------------------------
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setScrollLeft(e.currentTarget.scrollLeft);
  }

  // ---------------------------------------------------------------------------
  // Scale change — persist to view config
  // ---------------------------------------------------------------------------
  function handleScaleChange(next: Scale) {
    applyDraft({
      timeline: {
        timelineColumnId: timelineColumnId,
        scale: next,
        colorBy: timelineConfig?.colorBy ?? { kind: "none" },
      },
    });
    // Persist immediately (don't wait for the debounce to flush).
    save().catch(() => {
      // save() failing is non-critical — the draft is still in memory.
    });
  }

  // ---------------------------------------------------------------------------
  // Bar drag end (body drag — moves both start+end)
  // ---------------------------------------------------------------------------
  const handleBarDragEnd = useCallback(
    async (taskId: string, deltaPx: number) => {
      if (!timelineColumnId) return;
      const cell = cells.get(`${taskId}:${timelineColumnId}`);
      if (!cell?.date_value) return;

      const oldStart = cell.date_value;
      const oldEnd = cell.date_end_value ?? oldStart;

      const startX = dateToX(oldStart, originDate, scale, containerWidthPx);
      const endX = dateToX(oldEnd, originDate, scale, containerWidthPx);

      const newStart = xToDate(startX + deltaPx, originDate, scale, containerWidthPx);
      const newEnd = xToDate(endX + deltaPx, originDate, scale, containerWidthPx);

      const result = await setCellValue({
        taskId,
        columnId: timelineColumnId,
        value: { start: newStart, end: newEnd },
      });
      if (!("id" in result)) {
        toast.error("Failed to update task dates");
      }
    },
    [cells, timelineColumnId, originDate, scale, containerWidthPx],
  );

  // ---------------------------------------------------------------------------
  // Bar resize end (edge handles call onDateChange directly)
  // ---------------------------------------------------------------------------
  const handleDateChange = useCallback(
    async (taskId: string, start: string, end: string) => {
      if (!timelineColumnId) return;
      const result = await setCellValue({
        taskId,
        columnId: timelineColumnId,
        value: { start, end },
      });
      if (!("id" in result)) {
        toast.error("Failed to update task dates");
      }
    },
    [timelineColumnId],
  );

  // ---------------------------------------------------------------------------
  // Open task drawer
  // ---------------------------------------------------------------------------
  const handleOpenTask = useCallback(
    (taskId: string) => {
      const url = `/w/${workspaceSlug}/b/${board.id}/t/${taskId}`;
      window.history.pushState(null, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    [workspaceSlug, board.id],
  );

  // ---------------------------------------------------------------------------
  // dnd-kit for bar body drag and unscheduled drop
  // ---------------------------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [draggingInfo, setDraggingInfo] = useState<{
    type: "bar" | "unscheduled";
    taskId: string;
    startX?: number;
  } | null>(null);

  async function handleDndEnd(event: DragEndEvent) {
    const { active, delta } = event;
    const activeId = String(active.id);

    if (activeId.startsWith("timeline-bar:")) {
      const taskId = activeId.replace("timeline-bar:", "");
      if (delta.x !== 0) {
        await handleBarDragEnd(taskId, delta.x);
      }
    } else if (activeId.startsWith("unscheduled:")) {
      const taskId = activeId.replace("unscheduled:", "");
      if (!timelineColumnId) return;

      // Compute drop position: find the x of the drop inside the bar area.
      // `event.over` will be the row-droppable if we add those; for now we
      // compute position from the initial pointer position + delta.
      const ppd = pxPerDay(scale, containerWidthPx);
      // delta.x is the move from pointer-down position.
      // We use delta.x relative to the bar area origin.
      const dropX = (draggingInfo?.startX ?? 0) + delta.x;
      const dropDate = xToDate(dropX, originDate, scale, containerWidthPx);
      const dur = defaultDuration(scale);

      // Compute end date (add dur days).
      const endDate = xToDate(
        dateToX(dropDate, originDate, scale, containerWidthPx) + dur * ppd,
        originDate,
        scale,
        containerWidthPx,
      );

      const result = await setCellValue({
        taskId,
        columnId: timelineColumnId,
        value: { start: dropDate, end: endDate },
      });
      if (!("id" in result)) {
        toast.error("Failed to schedule task");
      }
    }
    setDraggingInfo(null);
  }

  // ---------------------------------------------------------------------------
  // Empty state — no column picked
  // ---------------------------------------------------------------------------
  if (!timelineColumnId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <TimelineColumnPicker />
          <TimelineScaleSwitcher scale={scale} onChange={handleScaleChange} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-xs">
            <p className="text-sm text-[color:var(--color-fg-muted)] mb-3">
              Pick a timeline column to render bars
            </p>
            <TimelineColumnPicker />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const totalBarWidth = dates.length * pxPerDay(scale, containerWidthPx);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDndEnd}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ---- Toolbar ---- */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] shrink-0">
          <TimelineColumnPicker />
          <div className="flex-1" />
          <TimelineScaleSwitcher scale={scale} onChange={handleScaleChange} />
        </div>

        {/* ---- Main body ---- */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* ---- Scrollable timeline area ---- */}
          <div
            ref={containerRef}
            className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden relative"
          >
            {/* Sticky header */}
            <TimelineHeader
              scale={scale}
              dates={dates}
              containerWidthPx={containerWidthPx}
              scrollLeft={scrollLeft}
            />

            {/* Virtualised rows */}
            <div ref={parentRef} className="flex-1 overflow-auto relative" onScroll={handleScroll}>
              {/* Today line — full-height overlay floating above all rows */}
              {todayX !== null && todayX >= 0 && todayX <= totalBarWidth && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: LABEL_COL_WIDTH + todayX - scrollLeft,
                    top: 0,
                    width: 2,
                    height: "100%",
                    backgroundColor: "var(--color-primary)",
                    zIndex: 5,
                    pointerEvents: "none",
                    opacity: 0.85,
                  }}
                />
              )}

              {/* Virtual list container */}
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: LABEL_COL_WIDTH + totalBarWidth,
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const task = scheduledTasks[virtualRow.index];
                  if (!task) return null;

                  const cell = cells.get(`${task.id}:${timelineColumnId}`);
                  const startDate = cell?.date_value ?? null;
                  const endDate = cell?.date_end_value ?? startDate;

                  return (
                    <TimelineRow
                      key={task.id}
                      task={task}
                      dates={dates}
                      originDate={originDate}
                      scale={scale}
                      containerWidthPx={containerWidthPx}
                      startDate={startDate}
                      endDate={endDate}
                      todayX={todayX}
                      onDateChange={handleDateChange}
                      onOpenTask={handleOpenTask}
                      top={virtualRow.start}
                      color={DEFAULT_BAR_COLOR}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* ---- Right rail: unscheduled panel ---- */}
          <TimelineUnscheduled tasks={unscheduledTasks} />
        </div>
      </div>

      {/* DragOverlay — ghosted card while dragging */}
      <DragOverlay>
        {draggingInfo?.type === "unscheduled" &&
          (() => {
            const task = tasks.find((t) => t.id === draggingInfo.taskId);
            if (!task) return null;
            return (
              <div
                className="px-2 py-1.5 rounded bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-md text-xs text-[color:var(--color-fg)] select-none opacity-90"
                style={{ minWidth: 120, maxWidth: 200 }}
              >
                {task.title}
              </div>
            );
          })()}
      </DragOverlay>
    </DndContext>
  );
}
