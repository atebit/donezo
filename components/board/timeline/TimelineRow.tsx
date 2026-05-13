"use client";

/**
 * TimelineRow — a single row in the virtualized Gantt body.
 *
 * Layout:
 *   ┌────────────────────┬────────────────────────────────────────┐
 *   │  Task name label   │  Absolutely-positioned <TimelineBar /> │
 *   │  (fixed left col)  │  + weekend shading + today line        │
 *   └────────────────────┴────────────────────────────────────────┘
 *
 * The row is `position: relative` so the absolutely-positioned bar and today
 * line sit correctly within it. The fixed left column has a fixed width (200px)
 * and is sticky within the outer scrollable container.
 *
 * Weekend shading is applied as full-height semi-transparent overlays on
 * day/week scales.
 *
 * Epic 12, Slice D.
 */

import type { Task } from "@/components/board/table/types";
import { cn } from "@/lib/utils";
import { TimelineBar } from "./TimelineBar";
import { isWeekend, pxPerDay, type Scale } from "./timeline-math";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ROW_HEIGHT = 40; // px — must match the virtualizer estimate
export const LABEL_COL_WIDTH = 200; // px — sticky left label column

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimelineRowProps {
  task: Task;
  /** ISO date strings (yyyy-MM-dd) for each visible day column. */
  dates: string[];
  /** The date at x=0 in the bar area. */
  originDate: string;
  scale: Scale;
  containerWidthPx: number;
  /** Null when the task has no start/end set. */
  startDate: string | null;
  endDate: string | null;
  /** Pixel offset from today line (used to show/hide today highlight). */
  todayX: number | null;
  onDateChange: (taskId: string, start: string, end: string) => void;
  onOpenTask: (taskId: string) => void;
  /** Row top position (px) from the virtualizer — applied via style. */
  top: number;
  /** Bar colour. */
  color?: string;
}

// ---------------------------------------------------------------------------
// TimelineRow
// ---------------------------------------------------------------------------

export function TimelineRow({
  task,
  dates,
  originDate,
  scale,
  containerWidthPx,
  startDate,
  endDate,
  todayX,
  onDateChange,
  onOpenTask,
  top,
  color,
}: TimelineRowProps) {
  const ppd = pxPerDay(scale, containerWidthPx);
  const totalWidth = dates.length * ppd;
  const showWeekends = scale === "day" || scale === "week";

  return (
    <div
      data-row-id={task.id}
      data-row-title={task.title}
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height: ROW_HEIGHT,
        display: "flex",
      }}
    >
      {/* ---- Left sticky label column ---- */}
      <div
        className={cn(
          "flex items-center px-3 border-r border-b border-[color:var(--color-border)]",
          "bg-[color:var(--color-surface)] z-[2] shrink-0 overflow-hidden",
        )}
        style={{ width: LABEL_COL_WIDTH, position: "sticky", left: 0 }}
      >
        <button
          type="button"
          onClick={() => onOpenTask(task.id)}
          className={cn(
            "truncate text-sm text-[color:var(--color-fg)] text-left w-full",
            "hover:text-[color:var(--color-primary)] transition-colors cursor-pointer",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
          )}
          aria-label={`Open task: ${task.title}`}
        >
          {task.title}
        </button>
      </div>

      {/* ---- Bar area (scrollable, position: relative for absolute children) ---- */}
      <div
        className="relative flex-1 border-b border-[color:var(--color-border)] overflow-visible"
        style={{ minWidth: totalWidth }}
      >
        {/* Weekend shading — full-height overlay per weekend day */}
        {showWeekends &&
          dates.map((d, i) => {
            if (!isWeekend(d)) return null;
            return (
              <div
                key={d}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: i * ppd,
                  top: 0,
                  width: ppd,
                  height: "100%",
                  backgroundColor: "var(--color-surface-hover)",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              />
            );
          })}

        {/* Today line — rendered per-row as a 1px vertical line */}
        {todayX !== null && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: todayX,
              top: 0,
              width: 1,
              height: "100%",
              backgroundColor: "var(--color-primary)",
              zIndex: 3,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Gantt bar — only rendered when start+end are set */}
        {startDate && endDate && (
          <TimelineBar
            taskId={task.id}
            taskTitle={task.title}
            startDate={startDate}
            endDate={endDate}
            originDate={originDate}
            scale={scale}
            containerWidthPx={containerWidthPx}
            onDateChange={onDateChange}
            onOpenTask={onOpenTask}
            {...(color !== undefined ? { color } : {})}
          />
        )}
      </div>
    </div>
  );
}
