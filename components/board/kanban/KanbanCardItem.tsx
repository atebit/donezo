"use client";

/**
 * KanbanCardItem — sortable wrapper around <TaskCard />.
 *
 * Uses dnd-kit `useSortable` so cards can be reordered within a lane (when
 * `sortKeys.length === 0`) and dragged between lanes (always).
 *
 * Drag handle is placed in the top-right corner of the card chrome.
 * The drag handle does NOT propagate clicks to the card itself so that
 * clicking the handle to drag doesn't also open the task drawer.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useShallow } from "zustand/react/shallow";
import { TaskCard } from "@/components/board/shared/TaskCard";
import type { Task } from "@/components/board/table/types";
import type { CardStyle } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

interface KanbanCardItemProps {
  task: Task;
  cardStyle: CardStyle | undefined;
  sortingDisabled: boolean;
  /** Composed React key prefix — `${laneId}:${task.id}` for multi-person lanes. */
  laneId: string;
  onClick: (taskId: string) => void;
}

export function KanbanCardItem({
  task,
  cardStyle,
  sortingDisabled,
  laneId: _laneId,
  onClick,
}: KanbanCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: sortingDisabled,
    data: { type: "card", taskId: task.id },
  });

  const { cellsByKey, columns } = useBoardStore(
    useShallow((s) => ({
      cellsByKey: s.cells,
      columns: s.columns,
    })),
  );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
  };

  // dnd-kit attributes + listeners are typed with specific interfaces but are
  // compatible with Record<string, unknown> at runtime. We cast through `unknown`
  // since the index signature is missing on DraggableAttributes / SyntheticListenerMap.
  const dndAttributes = attributes as unknown as Record<string, unknown>;
  const dndListeners = listeners as unknown as Record<string, unknown>;

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      {/* Drag handle — positioned top-right, only when sorting is enabled */}
      {!sortingDisabled && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="absolute top-1 right-1 z-10 p-1 cursor-grab active:cursor-grabbing text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] rounded"
          // Spread dnd-kit drag attributes / listeners on the handle button.
          // biome-ignore lint/suspicious/noExplicitAny: dnd-kit listeners are untyped at JSX spread site
          {...(attributes as any)}
          // biome-ignore lint/suspicious/noExplicitAny: dnd-kit listeners are untyped at JSX spread site
          {...(listeners as any)}
          onClick={(e) => {
            // Prevent the handle click from bubbling to the card's onClick.
            e.stopPropagation();
          }}
        >
          {/* Grip icon — two rows of dots */}
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="3" r="1.5" />
            <circle cx="9" cy="3" r="1.5" />
            <circle cx="3" cy="7" r="1.5" />
            <circle cx="9" cy="7" r="1.5" />
            <circle cx="3" cy="11" r="1.5" />
            <circle cx="9" cy="11" r="1.5" />
          </svg>
        </button>
      )}

      <TaskCard
        task={task}
        cellsByKey={cellsByKey}
        columns={columns}
        cardStyle={cardStyle}
        onClick={onClick}
        // When sorting is disabled, spread drag attrs/listeners on the whole card.
        // Conditional spread avoids passing `undefined` as an explicit prop value,
        // which exactOptionalPropertyTypes rejects.
        {...(sortingDisabled ? { dragAttributes: dndAttributes, dragListeners: dndListeners } : {})}
      />
    </div>
  );
}
