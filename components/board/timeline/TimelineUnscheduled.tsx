"use client";

/**
 * TimelineUnscheduled — collapsible right-side panel listing tasks that have
 * no start+end date set on the active timeline column.
 *
 * Each unscheduled task is rendered as a small draggable card (dnd-kit
 * `useDraggable`). When dropped onto a `<TimelineRow />` bar area, the parent
 * `<TimelineView />` handles the drop by creating a `{ start, end }` value at
 * the drop position with a default duration of:
 *   - 1 day  for day/week scales
 *   - 7 days for month+ scales
 *
 * The droppable id for each bar area is: `row-drop:{taskId}:{isoDate}` — built
 * by the parent's drag-end handler, not here.
 *
 * The unscheduled card's dnd-kit id: `unscheduled:{taskId}`.
 *
 * Epic 12, Slice D — D.6.
 */

import { useDraggable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useState } from "react";
import type { Task } from "@/components/board/table/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 200; // px (collapsed: 32px)
const COLLAPSED_WIDTH = 32; // px

// ---------------------------------------------------------------------------
// UnscheduledCard — a single draggable task chip
// ---------------------------------------------------------------------------

function UnscheduledCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled:${task.id}`,
    data: { type: "unscheduled", taskId: task.id },
  });

  return (
    <div
      ref={setNodeRef}
      data-unscheduled-id={task.id}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded",
        "bg-[color:var(--color-surface)] border border-[color:var(--color-border)]",
        "shadow-[var(--shadow-card)] cursor-grab active:cursor-grabbing select-none",
        "hover:border-[color:var(--color-border-strong)] transition-colors",
      )}
      title={`Unscheduled task: ${task.title}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical
        size={12}
        className="text-[color:var(--color-fg-muted)] shrink-0"
        aria-hidden="true"
      />
      <span className="text-xs text-[color:var(--color-fg)] truncate flex-1">{task.title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineUnscheduled
// ---------------------------------------------------------------------------

interface TimelineUnscheduledProps {
  tasks: Task[];
}

export function TimelineUnscheduled({ tasks }: TimelineUnscheduledProps) {
  const [collapsed, setCollapsed] = useState(false);

  const panelWidth = collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH;

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 border-l border-[color:var(--color-border)]",
        "bg-[color:var(--color-surface)] transition-all duration-200",
        "overflow-hidden",
      )}
      style={{ width: panelWidth }}
      aria-label="Unscheduled tasks panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-[color:var(--color-border)] shrink-0">
        {!collapsed && (
          <span className="text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wide truncate">
            Unscheduled ({tasks.length})
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded shrink-0",
            "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]",
            "hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
          )}
          aria-label={collapsed ? "Expand unscheduled panel" : "Collapse unscheduled panel"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Task list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {tasks.length === 0 ? (
            <p className="text-xs text-[color:var(--color-fg-muted)] italic text-center py-4">
              All tasks scheduled
            </p>
          ) : (
            tasks.map((task) => <UnscheduledCard key={task.id} task={task} />)
          )}
        </div>
      )}
    </aside>
  );
}
