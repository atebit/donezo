"use client";

/**
 * TimelineView — main Gantt-style view container.
 *
 * Layout (left→right):
 *   [Sticky TimelineHeader (top)] | [Virtualized rows body] | [TimelineUnscheduled rail]
 *
 * Data:
 *   - Tasks from the board store, filtered/sorted through Epic-11 helpers.
 *   - Timeline column config from view.config.timeline.
 *
 * The today line (1px vertical, --color-primary) is absolutely positioned
 * inside the canvas area and scrolls with the content.
 *
 * Weekend shading (day/week scales) is rendered per-row inside TimelineRow.
 *
 * Row virtualization is handled by @tanstack/react-virtual.
 */

import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { setCellValue } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import { TimelineColumnPicker } from "@/components/board/timeline/TimelineColumnPicker";
import { LABEL_COL_WIDTH, TimelineHeader } from "@/components/board/timeline/TimelineHeader";
import { ROW_HEIGHT, TimelineRow } from "@/components/board/timeline/TimelineRow";
import { TimelineScaleSwitcher } from "@/components/board/timeline/TimelineScaleSwitcher";
import { TimelineUnscheduled } from "@/components/board/timeline/TimelineUnscheduled";
import {
  addDays,
  dateToX,
  defaultOriginDate,
  type Scale,
  todayUTC,
  visibleRange,
  xToDate,
} from "@/components/board/timeline/timeline-math";
import { useBoardView } from "@/hooks/use-board-view";
import { applyFilterTree } from "@/lib/filtering/apply-filter-tree";
import { applySearch } from "@/lib/filtering/apply-search";
import { applySort } from "@/lib/filtering/apply-sort";
import { useBoardStore } from "@/stores/board-store";

/** Extra days rendered beyond the visible range to allow smooth scrolling. */
const CANVAS_PADDING_DAYS = 60;

export function TimelineView() {
  const { effective } = useBoardView();

  // ---------------------------------------------------------------------------
  // Board store selectors — all multi-field reads use useShallow
  // ---------------------------------------------------------------------------
  const { tasks, cells, columns, sortKeys, inBoardSearch } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
      sortKeys: s.sortKeys,
      inBoardSearch: s.inBoardSearch,
    })),
  );

  // ---------------------------------------------------------------------------
  // Timeline config resolution
  // ---------------------------------------------------------------------------
  const timelineConfig = effective.timeline;
  const timelineColumnId = timelineConfig?.timelineColumnId ?? null;
  const scale = (timelineConfig?.scale ?? "week") as Scale;

  // ---------------------------------------------------------------------------
  // Canvas dimensions
  // ---------------------------------------------------------------------------
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        // Subtract label column width
        const available = entry.contentRect.width - LABEL_COL_WIDTH;
        setContainerWidth(Math.max(available, 100));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Origin date: default to today-shifted so today is visible
  const [originDate, setOriginDate] = useState(() => defaultOriginDate(scale));

  // When scale changes, reset origin
  useEffect(() => {
    setOriginDate(defaultOriginDate(scale));
  }, [scale]);

  // Canvas total width = container + padding to allow scrolling
  const canvasWidth = containerWidth + CANVAS_PADDING_DAYS * (containerWidth / 30);

  // Visible range for weekend shading and header ticks
  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => visibleRange(scale, originDate, canvasWidth),
    [scale, originDate, canvasWidth],
  );

  // ---------------------------------------------------------------------------
  // Derived task list — apply filter / search / sort
  // ---------------------------------------------------------------------------
  const derivedTasks = useMemo(() => {
    let result = tasks.filter((t) => t.deleted_at == null);

    if (effective.filter) {
      result = applyFilterTree(result, cells, columns, effective.filter);
    }

    if (inBoardSearch) {
      result = applySearch(result, cells, columns, inBoardSearch);
    }

    if (sortKeys.length > 0) {
      result = applySort(result, cells, columns, sortKeys);
    }

    return result;
  }, [tasks, cells, columns, effective.filter, inBoardSearch, sortKeys]);

  // Split into scheduled and unscheduled
  const { scheduled, unscheduled } = useMemo(() => {
    if (!timelineColumnId) {
      return { scheduled: derivedTasks, unscheduled: [] };
    }
    const sched: typeof derivedTasks = [];
    const unsched: typeof derivedTasks = [];
    for (const task of derivedTasks) {
      const cell = cells.get(`${task.id}:${timelineColumnId}`);
      if (cell?.date_value && cell?.date_end_value) {
        sched.push(task);
      } else {
        unsched.push(task);
      }
    }
    return { scheduled: sched, unscheduled: unsched };
  }, [derivedTasks, cells, timelineColumnId]);

  // ---------------------------------------------------------------------------
  // Virtualizer — rows
  // ---------------------------------------------------------------------------
  const rowVirtualizer = useVirtualizer({
    count: scheduled.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ---------------------------------------------------------------------------
  // Today line X position
  // ---------------------------------------------------------------------------
  const todayX = useMemo(
    () => dateToX(todayUTC(), originDate, scale, canvasWidth),
    [originDate, scale, canvasWidth],
  );

  // ---------------------------------------------------------------------------
  // Drag callbacks
  // ---------------------------------------------------------------------------
  const handleBarDragEnd = useCallback(
    (taskId: string, columnId: string, newStart: string, newEnd: string) => {
      // Optimistic update happens via store realtime; fire server action
      void setCellValue({ taskId, columnId, value: { start: newStart, end: newEnd } });
    },
    [],
  );

  const handleTaskOpen = useCallback((taskId: string) => {
    // Navigate to task drawer via the existing modal intercept route
    // The route is /w/[workspaceSlug]/b/[boardId]/t/[taskId]
    // We use Next.js router from the window.history to avoid circular imports
    window.history.pushState(
      null,
      "",
      window.location.pathname.replace(
        /\/(table|timeline|kanban|calendar|dashboard|form).*/,
        `/t/${taskId}`,
      ),
    );
    // Trigger popstate so Next.js App Router picks it up
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  // Drag from unscheduled panel — receive drop
  const handleCanvasDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!timelineColumnId) return;

      const taskId = e.dataTransfer.getData("application/x-timeline-unscheduled-taskid");
      const durationStr = e.dataTransfer.getData("application/x-default-duration");
      if (!taskId) return;

      const duration = Number.parseInt(durationStr || "1", 10);

      // Compute the drop X relative to the canvas container
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - LABEL_COL_WIDTH;
      const dropDate = xToDate(x, originDate, scale, canvasWidth);
      const endDate = addDays(dropDate, duration - 1);

      void setCellValue({
        taskId,
        columnId: timelineColumnId,
        value: { start: dropDate, end: endDate },
      });
    },
    [timelineColumnId, scale, canvasWidth, originDate],
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // ---------------------------------------------------------------------------
  // Render — empty state
  // ---------------------------------------------------------------------------
  if (!timelineColumnId) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Toolbar row with scale switcher */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--color-border)] shrink-0">
          <TimelineScaleSwitcher activeScale={scale} />
        </div>
        <div className="flex-1 overflow-auto">
          <TimelineColumnPicker />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — main timeline
  // ---------------------------------------------------------------------------
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Scale switcher toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--color-border)] shrink-0 bg-[color:var(--color-surface)]">
        <span className="text-xs text-[color:var(--color-fg-muted)]">
          {scheduled.length} task{scheduled.length !== 1 ? "s" : ""}
        </span>
        <TimelineScaleSwitcher activeScale={scale} />
      </div>

      {/* Main body: header + rows + unscheduled rail */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel (header + scrollable rows) */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for unscheduled tasks; no keyboard equivalent needed for drag-to-schedule */}
        <div
          ref={scrollContainerRef}
          className="flex flex-col flex-1 min-w-0 overflow-auto"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          {/* Sticky header */}
          <TimelineHeader
            originDate={originDate}
            scale={scale}
            canvasWidth={canvasWidth}
            containerWidth={containerWidth}
          />

          {/* Rows (virtualized) */}
          <div className="relative" style={{ height: totalSize }}>
            {/* Today line — floats over all rows */}
            {todayX >= 0 && todayX <= canvasWidth && (
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{
                  left: LABEL_COL_WIDTH + todayX,
                  width: 1,
                  backgroundColor: "var(--color-primary)",
                }}
                aria-hidden="true"
              />
            )}

            {/* Virtual rows */}
            {virtualItems.map((virtualItem) => {
              const task = scheduled[virtualItem.index];
              if (!task) return null;

              return (
                <div
                  key={task.id}
                  className="absolute left-0 right-0"
                  style={{
                    top: virtualItem.start,
                    height: virtualItem.size,
                  }}
                >
                  <TimelineRow
                    task={task}
                    cells={cells}
                    columns={columns}
                    timelineColumnId={timelineColumnId}
                    originDate={originDate}
                    scale={scale}
                    canvasWidth={canvasWidth}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onBarDragEnd={handleBarDragEnd}
                    onTaskOpen={handleTaskOpen}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right rail — unscheduled tasks */}
        <TimelineUnscheduled
          tasks={unscheduled}
          scale={scale}
          onSchedule={(taskId, start, end) => {
            if (!timelineColumnId) return;
            void setCellValue({ taskId, columnId: timelineColumnId, value: { start, end } });
          }}
        />
      </div>
    </div>
  );
}
