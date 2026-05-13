"use client";

/**
 * TimelineUnscheduled — right-side panel showing tasks without start+end dates.
 *
 * Each task is displayed as a small draggable card. Dropping a card onto a row
 * in the timeline body creates a { start, end } range at the drop day, using a
 * default duration of 1 day (day/week scales) or 7 days (month+ scales).
 *
 * v1 implementation: The panel is collapsible and shows up to the first 200
 * unscheduled tasks. The drag-to-row behavior is implemented via a simple
 * onDrop callback exposed by TimelineView.
 *
 * Note: Full dnd-kit overlay-based row drop is an enhancement; v1 uses a simple
 * drag-handle with a custom droppable zone on the canvas via HTML5 drag events.
 */

import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useCallback, useState } from "react";
import type { Task } from "@/components/board/table/types";
import type { Scale } from "@/components/board/timeline/timeline-math";

const MAX_SHOWN = 200;

interface TimelineUnscheduledProps {
  tasks: Task[];
  scale: Scale;
  onSchedule: (taskId: string, start: string, end: string) => void;
}

export function TimelineUnscheduled({
  tasks,
  scale,
  onSchedule: _onSchedule,
}: TimelineUnscheduledProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const shown = tasks.slice(0, MAX_SHOWN);
  const overflow = tasks.length - MAX_SHOWN;

  // Default duration based on scale
  const defaultDuration = scale === "day" || scale === "week" ? 1 : 7;

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, taskId: string) => {
      e.dataTransfer.setData("application/x-timeline-unscheduled-taskid", taskId);
      e.dataTransfer.setData("application/x-default-duration", String(defaultDuration));
      setDraggingId(taskId);
    },
    [defaultDuration],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  if (collapsed) {
    return (
      <section
        className="flex flex-col items-center border-l border-[color:var(--color-border)] bg-[color:var(--color-surface)] w-8 shrink-0"
        aria-label="Unscheduled tasks panel (collapsed)"
      >
        <button
          type="button"
          className="mt-2 p-1 rounded hover:bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)]"
          onClick={() => setCollapsed(false)}
          aria-label="Expand unscheduled panel"
          title="Show unscheduled tasks"
        >
          <ChevronLeft size={14} />
        </button>
      </section>
    );
  }

  return (
    <section
      className="flex flex-col border-l border-[color:var(--color-border)] bg-[color:var(--color-surface)] w-52 shrink-0 overflow-hidden"
      aria-label="Unscheduled tasks"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--color-border)] shrink-0">
        <span className="text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wide">
          Unscheduled
          {tasks.length > 0 && (
            <span className="ml-1 text-[color:var(--color-primary)]">({tasks.length})</span>
          )}
        </span>
        <button
          type="button"
          className="p-1 rounded hover:bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)]"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse unscheduled panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Task list */}
      <ul className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 list-none m-0">
        {shown.length === 0 && (
          <li className="text-xs text-[color:var(--color-fg-muted)] text-center py-4">
            All tasks are scheduled.
          </li>
        )}

        {shown.map((task) => (
          <li
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragEnd={handleDragEnd}
            className={[
              "flex items-center gap-1 px-2 py-1 rounded border text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] cursor-grab select-none transition-opacity",
              "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]",
              draggingId === task.id ? "opacity-40" : "opacity-100",
            ].join(" ")}
            title={`Drag to schedule: ${task.title}`}
          >
            <GripVertical
              size={12}
              className="shrink-0 text-[color:var(--color-fg-muted)]"
              aria-hidden
            />
            <span className="truncate">{task.title}</span>
          </li>
        ))}

        {overflow > 0 && (
          <li className="text-xs text-[color:var(--color-fg-muted)] text-center py-2">
            +{overflow} more tasks not shown
          </li>
        )}
      </ul>
    </section>
  );
}
