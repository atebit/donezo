"use client";

/**
 * TimelineBar — absolutely-positioned draggable/resizable Gantt bar.
 *
 * Three interaction regions:
 *   - Left edge handle (8px):  pointer drag → moves `start` only (resize left).
 *   - Right edge handle (8px): pointer drag → moves `end` only (resize right).
 *   - Body (middle area):      dnd-kit drag → moves both `start` and `end`
 *                              by the same delta (preserving duration).
 *
 * On drag/resize end, the new dates are snapped to day boundaries via `xToDate`
 * and dispatched via `onDateChange({ start, end })`.
 *
 * Click-without-drag (pointer moved < 4 px total) opens the task drawer via
 * `onOpenTask`.
 *
 * Accessibility: `role="gridcell"`, title attribute for screen readers.
 *
 * Epic 12, Slice D — D.4.
 */

import { useDraggable } from "@dnd-kit/core";
import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { dateToX, pxPerDay, type Scale, xToDate } from "./timeline-math";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineBarProps {
  taskId: string;
  taskTitle: string;
  /** ISO date strings (yyyy-MM-dd). */
  startDate: string;
  endDate: string;
  /** The x-offset of the row origin relative to the container left edge. */
  originDate: string;
  scale: Scale;
  containerWidthPx: number;
  /** Called when a drag or resize completes with the new dates. */
  onDateChange: (taskId: string, start: string, end: string) => void;
  /** Called on a click-without-drag (open task drawer). */
  onOpenTask: (taskId: string) => void;
  /** Background colour for the bar (CSS colour string). */
  color?: string;
}

// ---------------------------------------------------------------------------
// DRAG_ID format — "timeline-bar:{taskId}"
// ---------------------------------------------------------------------------
function makeDragId(taskId: string): string {
  return `timeline-bar:${taskId}`;
}

// ---------------------------------------------------------------------------
// TimelineBar
// ---------------------------------------------------------------------------

export function TimelineBar({
  taskId,
  taskTitle,
  startDate,
  endDate,
  originDate,
  scale,
  containerWidthPx,
  onDateChange,
  onOpenTask,
  color = "var(--color-primary)",
}: TimelineBarProps) {
  // Compute position from dates.
  const x = dateToX(startDate, originDate, scale, containerWidthPx);
  const endX = dateToX(endDate, originDate, scale, containerWidthPx);
  const ppd = pxPerDay(scale, containerWidthPx);
  // Minimum bar width: 1 day
  const width = Math.max(ppd, endX - x);

  // ---------------------------------------------------------------------------
  // dnd-kit for body drag
  // ---------------------------------------------------------------------------
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: makeDragId(taskId),
    data: {
      type: "timeline-bar",
      taskId,
      startDate,
      endDate,
      originDate,
      scale,
      containerWidthPx,
    },
  });

  // While dragging, dnd-kit's transform gives us the delta in px.
  const dragDeltaX = transform?.x ?? 0;

  // ---------------------------------------------------------------------------
  // Pointer-based edge resize (left handle)
  // ---------------------------------------------------------------------------
  const leftResizeRef = useRef<{ startX: number; startDate: string } | null>(null);
  const [leftDelta, setLeftDelta] = useState(0);
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const handleLeftPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      leftResizeRef.current = { startX: e.clientX, startDate };
      setIsResizingLeft(true);
    },
    [startDate],
  );

  const handleLeftPointerMove = useCallback((e: React.PointerEvent) => {
    if (!leftResizeRef.current) return;
    const delta = e.clientX - leftResizeRef.current.startX;
    setLeftDelta(delta);
  }, []);

  const handleLeftPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!leftResizeRef.current) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const delta = e.clientX - leftResizeRef.current.startX;
      // Convert px delta → new start date (snap to day).
      const newStartX = x + delta;
      const newStart = xToDate(newStartX, originDate, scale, containerWidthPx);
      // Clamp: start must not exceed end.
      const clampedStart = newStart <= endDate ? newStart : endDate;
      onDateChange(taskId, clampedStart, endDate);
      leftResizeRef.current = null;
      setLeftDelta(0);
      setIsResizingLeft(false);
    },
    [taskId, x, originDate, scale, containerWidthPx, endDate, onDateChange],
  );

  // ---------------------------------------------------------------------------
  // Pointer-based edge resize (right handle)
  // ---------------------------------------------------------------------------
  const rightResizeRef = useRef<{ startX: number; endDate: string } | null>(null);
  const [rightDelta, setRightDelta] = useState(0);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const handleRightPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      rightResizeRef.current = { startX: e.clientX, endDate };
      setIsResizingRight(true);
    },
    [endDate],
  );

  const handleRightPointerMove = useCallback((e: React.PointerEvent) => {
    if (!rightResizeRef.current) return;
    const delta = e.clientX - rightResizeRef.current.startX;
    setRightDelta(delta);
  }, []);

  const handleRightPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!rightResizeRef.current) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const delta = e.clientX - rightResizeRef.current.startX;
      // Convert px delta → new end date (snap to day).
      const newEndX = endX + delta;
      const newEnd = xToDate(newEndX, originDate, scale, containerWidthPx);
      // Clamp: end must not precede start.
      const clampedEnd = newEnd >= startDate ? newEnd : startDate;
      onDateChange(taskId, startDate, clampedEnd);
      rightResizeRef.current = null;
      setRightDelta(0);
      setIsResizingRight(false);
    },
    [taskId, endX, originDate, scale, containerWidthPx, startDate, onDateChange],
  );

  // ---------------------------------------------------------------------------
  // Click-without-drag detection (body area)
  // ---------------------------------------------------------------------------
  const clickOriginRef = useRef<{ x: number; y: number } | null>(null);

  function handleBodyPointerDown(e: React.PointerEvent) {
    clickOriginRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleBodyClick(e: React.MouseEvent) {
    // If dnd-kit started a drag, it will have cleared transform.
    // We check by seeing if the pointer barely moved.
    if (!clickOriginRef.current) return;
    const dx = Math.abs(e.clientX - clickOriginRef.current.x);
    const dy = Math.abs(e.clientY - clickOriginRef.current.y);
    if (dx < 4 && dy < 4) {
      onOpenTask(taskId);
    }
    clickOriginRef.current = null;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Compute visual position including live drag deltas.
  const visualX = x + (isDragging ? dragDeltaX : 0) + (isResizingLeft ? leftDelta : 0);
  const visualWidth = width - (isResizingLeft ? leftDelta : 0) + (isResizingRight ? rightDelta : 0);
  const clampedWidth = Math.max(ppd, visualWidth);

  const HANDLE_W = 8;

  return (
    <div
      title={`${taskTitle}: ${startDate} to ${endDate}`}
      data-task-id={taskId}
      data-bar="true"
      style={{
        position: "absolute",
        left: visualX,
        width: clampedWidth,
        top: 6,
        height: "calc(100% - 12px)",
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : 1,
      }}
    >
      {/* Left resize handle */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: HANDLE_W,
          height: "100%",
          cursor: "ew-resize",
          zIndex: 2,
          borderRadius: "4px 0 0 4px",
          backgroundColor: "rgba(0,0,0,0.15)",
        }}
        onPointerDown={handleLeftPointerDown}
        onPointerMove={handleLeftPointerMove}
        onPointerUp={handleLeftPointerUp}
      />

      {/* Bar body — dnd-kit's useDraggable injects role="button" and tabIndex=0 via attributes spread */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: role + tabIndex injected by dnd-kit's useDraggable attributes spread */}
      <div
        ref={setNodeRef}
        className={cn(
          "absolute inset-0 rounded flex items-center overflow-hidden select-none",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
          "focus-visible:outline-[color:var(--color-primary)]",
        )}
        style={{
          left: HANDLE_W,
          right: HANDLE_W,
          backgroundColor: color,
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onPointerDown={handleBodyPointerDown}
        onClick={handleBodyClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenTask(taskId);
          }
        }}
        {...attributes}
        {...listeners}
      >
        <span
          className="px-2 text-[11px] font-medium text-white truncate leading-none"
          aria-hidden="true"
        >
          {taskTitle}
        </span>
      </div>

      {/* Right resize handle */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: HANDLE_W,
          height: "100%",
          cursor: "ew-resize",
          zIndex: 2,
          borderRadius: "0 4px 4px 0",
          backgroundColor: "rgba(0,0,0,0.15)",
        }}
        onPointerDown={handleRightPointerDown}
        onPointerMove={handleRightPointerMove}
        onPointerUp={handleRightPointerUp}
      />
    </div>
  );
}
