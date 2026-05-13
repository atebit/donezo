"use client";

/**
 * OffCalendarPanel — right-side panel listing tasks without a date value.
 *
 * Each task is rendered as a compact <TaskCard />. The card is draggable into
 * the calendar via dnd-kit's useDraggable — dropping it on a day cell sets the
 * date cell via setCellValue (handled by CalendarView's onDragEnd).
 *
 * Slice C — C.6.
 */

import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { TaskCard } from "@/components/board/shared/TaskCard";
import { useBoardView } from "@/hooks/use-board-view";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "@/stores/board-store";
import type { Task } from "@/components/board/table/types";

function DraggableTaskCard({ task }: { task: Task }) {
  const { effective } = useBoardView();
  const { cells, columns } = useBoardStore(
    useShallow((s) => ({ cells: s.cells, columns: s.columns })),
  );

  const cardStyle = effective.calendar?.cardStyle;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `off-calendar:${task.id}`,
    data: { taskId: task.id, source: "off-calendar" },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="mb-1"
    >
      <TaskCard
        task={task}
        cellsByKey={cells}
        columns={columns}
        cardStyle={cardStyle}
        // Cast through unknown to satisfy TaskCard's Record<string,unknown> props.
        // DraggableAttributes has specific keys, not an index signature.
        dragAttributes={attributes as unknown as Record<string, unknown>}
        dragListeners={listeners as unknown as Record<string, unknown>}
      />
    </div>
  );
}

interface OffCalendarPanelProps {
  /** Tasks that lack a date cell for the active date column. */
  tasks: Task[];
}

export function OffCalendarPanel({ tasks }: OffCalendarPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="flex flex-col border-l border-[color:var(--color-border)] bg-[color:var(--color-surface-rail)] w-48 min-w-[12rem] max-w-[12rem] overflow-hidden"
      aria-label="Unscheduled tasks"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[color:var(--color-fg-subtle)] uppercase tracking-wide hover:bg-[color:var(--color-surface-hover)] transition-colors"
        aria-expanded={!collapsed}
      >
        <span>Unscheduled ({tasks.length})</span>
        <span aria-hidden>{collapsed ? "▶" : "▼"}</span>
      </button>

      {/* Task list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto p-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-[color:var(--color-fg-subtle)] text-center py-4">
              All tasks scheduled
            </p>
          ) : (
            tasks.map((task) => <DraggableTaskCard key={task.id} task={task} />)
          )}
        </div>
      )}
    </aside>
  );
}
