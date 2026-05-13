"use client";

/**
 * TimelineBar — draggable bar within a TimelineRow.
 *
 * Three drag regions:
 *   - Left handle (8px wide): drag updates `start` only.
 *   - Body (between handles): drag moves both start+end, preserving duration.
 *   - Right handle (8px wide): drag updates `end` only.
 *
 * On drag-end, snaps to the nearest day and calls:
 *   setCellValue({ taskId, columnId, value: { start, end } })
 *
 * Click-without-drag opens the task drawer via onClick prop.
 *
 * Uses pointer events for direct drag control (lighter than a full dnd-kit
 * drag-and-drop since we only need horizontal 1D drag with pixel math).
 */

import { useCallback, useRef, useState } from "react";
import type { Scale } from "@/components/board/timeline/timeline-math";
import { dateToX, pxPerDay, xToDate } from "@/components/board/timeline/timeline-math";

const HANDLE_WIDTH = 8; // px — width of each edge drag handle
const DRAG_THRESHOLD = 3; // px — minimum movement to count as a drag (not a click)

interface TimelineBarProps {
  taskId: string;
  columnId: string;
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
  originDate: string;
  scale: Scale;
  canvasWidth: number;
  color?: string; // background color token or hex
  onDragEnd: (taskId: string, columnId: string, newStart: string, newEnd: string) => void;
  onOpen: (taskId: string) => void;
}

type DragMode = "body" | "left" | "right";

interface DragState {
  mode: DragMode;
  startX: number; // pointer X when drag began
  origStart: string; // original start date
  origEnd: string; // original end date
  hasMoved: boolean;
}

export function TimelineBar({
  taskId,
  columnId,
  start,
  end,
  originDate,
  scale,
  canvasWidth,
  color,
  onDragEnd,
  onOpen,
}: TimelineBarProps) {
  const [localStart, setLocalStart] = useState(start);
  const [localEnd, setLocalEnd] = useState(end);
  const dragRef = useRef<DragState | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Sync external start/end when not dragging
  const isDragging = dragRef.current !== null;
  const displayStart = isDragging ? localStart : start;
  const displayEnd = isDragging ? localEnd : end;

  const ppd = pxPerDay(scale, canvasWidth);
  const leftPx = dateToX(displayStart, originDate, scale, canvasWidth);
  const rightPx = dateToX(displayEnd, originDate, scale, canvasWidth);
  // +1 day width for the end date (inclusive)
  const widthPx = Math.max(rightPx - leftPx + ppd, HANDLE_WIDTH * 2 + 4);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, mode: DragMode) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        origStart: start,
        origEnd: end,
        hasMoved: false,
      };
      setLocalStart(start);
      setLocalEnd(end);
    },
    [start, end],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragRef.current;
      if (!ds) return;

      const dx = e.clientX - ds.startX;
      if (Math.abs(dx) >= DRAG_THRESHOLD) {
        ds.hasMoved = true;
      }
      if (!ds.hasMoved) return;

      const origStartX = dateToX(ds.origStart, originDate, scale, canvasWidth);
      const origEndX = dateToX(ds.origEnd, originDate, scale, canvasWidth);

      if (ds.mode === "body") {
        // Move both start and end by same delta
        const newStartX = origStartX + dx;
        const newEndX = origEndX + dx;
        setLocalStart(xToDate(newStartX, originDate, scale, canvasWidth));
        setLocalEnd(xToDate(newEndX, originDate, scale, canvasWidth));
      } else if (ds.mode === "left") {
        // Only update start; clamp so start <= end
        const newStartX = origStartX + dx;
        const snapped = xToDate(newStartX, originDate, scale, canvasWidth);
        if (snapped <= ds.origEnd) {
          setLocalStart(snapped);
        }
      } else {
        // Only update end; clamp so end >= start
        const newEndX = origEndX + dx;
        const snapped = xToDate(newEndX, originDate, scale, canvasWidth);
        if (snapped >= ds.origStart) {
          setLocalEnd(snapped);
        }
      }
    },
    [originDate, scale, canvasWidth],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragRef.current;
      if (!ds) return;
      dragRef.current = null;

      if (!ds.hasMoved) {
        // It was a click, not a drag
        onOpen(taskId);
        return;
      }

      // Finalize the drag — localStart/localEnd are already snapped
      onDragEnd(taskId, columnId, localStart, localEnd);
      // Reset to external after notifying parent (parent will update via store)
      setLocalStart(start);
      setLocalEnd(end);
    },
    [taskId, columnId, localStart, localEnd, start, end, onDragEnd, onOpen],
  );

  const barBg = color ?? "var(--color-primary)";

  return (
    // biome-ignore lint/a11y/useSemanticElements: contains nested interactive handles — nesting <button> inside <button> is invalid HTML; keyboard access provided via tabIndex + onKeyDown
    <div
      ref={barRef}
      data-testid="timeline-bar"
      className="absolute top-1/2 -translate-y-1/2 h-7 rounded select-none"
      style={{
        left: leftPx,
        width: widthPx,
        backgroundColor: barBg,
        opacity: 0.85,
        cursor: isDragging && dragRef.current?.mode === "body" ? "grabbing" : "grab",
        zIndex: 10,
      }}
      role="button"
      tabIndex={0}
      aria-label={`Task bar: ${displayStart} to ${displayEnd}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(taskId);
        }
      }}
    >
      {/* Left edge handle */}
      <div
        className="absolute left-0 top-0 bottom-0 rounded-l"
        style={{
          width: HANDLE_WIDTH,
          cursor: "ew-resize",
          zIndex: 2,
          backgroundColor: "rgba(0,0,0,0.15)",
        }}
        onPointerDown={(e) => handlePointerDown(e, "left")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-hidden="true"
      />

      {/* Body (center drag region) */}
      <div
        className="absolute inset-0"
        style={{
          left: HANDLE_WIDTH,
          right: HANDLE_WIDTH,
        }}
        onPointerDown={(e) => handlePointerDown(e, "body")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-hidden="true"
      />

      {/* Right edge handle */}
      <div
        className="absolute right-0 top-0 bottom-0 rounded-r"
        style={{
          width: HANDLE_WIDTH,
          cursor: "ew-resize",
          zIndex: 2,
          backgroundColor: "rgba(0,0,0,0.15)",
        }}
        onPointerDown={(e) => handlePointerDown(e, "right")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-hidden="true"
      />
    </div>
  );
}
