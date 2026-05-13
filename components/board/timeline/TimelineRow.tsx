"use client";

/**
 * TimelineRow — a single task row in the Timeline view.
 *
 * Layout:
 *   [Label column 200px][Canvas column (remaining width)]
 *
 * The canvas column is position:relative and contains:
 *   - Weekend shading overlays (day/week scales only)
 *   - The <TimelineBar /> absolutely positioned at the correct x offset
 *
 * The today line is rendered in TimelineView (shared sibling), not here.
 */

import { memo } from "react";
import type { Cell, Column, Task } from "@/components/board/table/types";
import { TimelineBar } from "@/components/board/timeline/TimelineBar";
import { LABEL_COL_WIDTH } from "@/components/board/timeline/TimelineHeader";
import {
  dateToX,
  daysInRange,
  isWeekend,
  pxPerDay,
  type Scale,
} from "@/components/board/timeline/timeline-math";

const ROW_HEIGHT = 40; // px — keep in sync with virtualizer estimateSize

interface TimelineRowProps {
  task: Task;
  cells: Map<string, Cell>;
  columns: Column[];
  timelineColumnId: string;
  originDate: string;
  scale: Scale;
  canvasWidth: number;
  rangeStart: string;
  rangeEnd: string;
  onBarDragEnd: (taskId: string, columnId: string, newStart: string, newEnd: string) => void;
  onTaskOpen: (taskId: string) => void;
}

function WeekendShading({
  rangeStart,
  rangeEnd,
  originDate,
  scale,
  canvasWidth,
}: {
  rangeStart: string;
  rangeEnd: string;
  originDate: string;
  scale: Scale;
  canvasWidth: number;
}) {
  // Only shade in day/week scales
  if (scale !== "day" && scale !== "week") return null;

  const days = daysInRange(rangeStart, rangeEnd);
  const ppd = pxPerDay(scale, canvasWidth);

  return (
    <>
      {days
        .filter((d) => isWeekend(d))
        .map((d) => {
          const x = dateToX(d, originDate, scale, canvasWidth);
          return (
            <div
              key={d}
              className="absolute inset-y-0"
              style={{
                left: x,
                width: ppd,
                backgroundColor: "var(--color-surface-hover)",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            />
          );
        })}
    </>
  );
}

export const TimelineRow = memo(function TimelineRow({
  task,
  cells,
  timelineColumnId,
  originDate,
  scale,
  canvasWidth,
  rangeStart,
  rangeEnd,
  onBarDragEnd,
  onTaskOpen,
}: TimelineRowProps) {
  const cellKey = `${task.id}:${timelineColumnId}`;
  const cell = cells.get(cellKey);

  // Resolve start/end from the timeline cell
  const timelineValue =
    cell?.date_value && cell?.date_end_value
      ? { start: cell.date_value, end: cell.date_end_value }
      : null;

  return (
    <div
      className="flex border-b border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-hover)]"
      style={{ height: ROW_HEIGHT }}
    >
      {/* Label column */}
      <div
        className="shrink-0 flex items-center px-3 border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm text-[color:var(--color-fg)] truncate"
        style={{ width: LABEL_COL_WIDTH }}
        title={task.title}
      >
        <button
          type="button"
          className="truncate text-left hover:underline"
          onClick={() => onTaskOpen(task.id)}
        >
          {task.title}
        </button>
      </div>

      {/* Canvas column */}
      <div className="relative flex-1 overflow-visible" style={{ width: canvasWidth }}>
        {/* Weekend shading */}
        <WeekendShading
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          originDate={originDate}
          scale={scale}
          canvasWidth={canvasWidth}
        />

        {/* Bar — only render when the task has timeline values */}
        {timelineValue && (
          <TimelineBar
            taskId={task.id}
            columnId={timelineColumnId}
            start={timelineValue.start}
            end={timelineValue.end}
            originDate={originDate}
            scale={scale}
            canvasWidth={canvasWidth}
            onDragEnd={onBarDragEnd}
            onOpen={onTaskOpen}
          />
        )}
      </div>
    </div>
  );
});

export { ROW_HEIGHT };
