"use client";

/**
 * CalendarEventCard — wraps <TaskCard /> for rendering inside react-big-calendar.
 *
 * react-big-calendar passes its own `event` object to the custom component prop.
 * This wrapper extracts the task + cells from the store and delegates rendering
 * to the shared <TaskCard />.
 *
 * Note: This component is not used directly by CalendarView (which inlines the
 * task card for better closure access). It is provided as a standalone export
 * for testing and future use.
 *
 * Slice C — C.2 / C.4.
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { TaskCard } from "@/components/board/shared/TaskCard";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";
import type { CalendarEvent } from "./event-mapping";

interface CalendarEventCardProps {
  /** The event object passed by react-big-calendar's components.event prop. */
  event: CalendarEvent;
  /** Called when the card is clicked to open the task drawer. */
  onOpen: (taskId: string) => void;
  /** dnd-kit drag attributes — cast to Record<string,unknown> by the caller. */
  dragAttributes?: Record<string, unknown>;
  /** dnd-kit drag listeners — cast to Record<string,unknown> by the caller. */
  dragListeners?: Record<string, unknown>;
}

export function CalendarEventCard({
  event,
  onOpen,
  dragAttributes,
  dragListeners,
}: CalendarEventCardProps) {
  const { effective } = useBoardView();
  const { tasks, cells, columns } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
    })),
  );

  const task = useMemo(
    () => tasks.find((t) => t.id === event.taskId),
    [tasks, event.taskId],
  );

  // cardStyle is stored per-kind inside effective.calendar.cardStyle
  const cardStyle = effective.calendar?.cardStyle;

  if (!task) return null;

  return (
    <TaskCard
      task={task}
      cellsByKey={cells}
      columns={columns}
      cardStyle={cardStyle}
      onClick={onOpen}
      {...(dragAttributes !== undefined ? { dragAttributes } : {})}
      {...(dragListeners !== undefined ? { dragListeners } : {})}
    />
  );
}
