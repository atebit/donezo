"use client";

/**
 * KanbanLane — renders a single kanban lane with header, virtualized card list,
 * and an empty-state "+ Add task" affordance.
 *
 * Visual contract (component-system §7.1):
 *   - Header: 44px tall, white text on lane colour; top-left + top-right radius 8px.
 *   - Lane width: 280px min-width.
 *   - Card list: virtualized via @tanstack/react-virtual when taskIds.length > 50.
 *   - Empty state: <EmptyLaneAddTask />.
 *
 * dnd-kit integration:
 *   - Lane body is a `useDroppable` target keyed on `lane.id`.
 *   - Cards inside are wrapped in `<SortableContext>` for within-lane reorder.
 *   - When `sortingDisabled=true`, the sort-handle is hidden; reorder drop is still
 *     registered but ignored by <KanbanBoard>'s `onDragEnd` handler.
 */

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { EmptyLaneAddTask } from "@/components/board/kanban/EmptyLaneAddTask";
import { KanbanCardItem } from "@/components/board/kanban/KanbanCardItem";
import type { Lane } from "@/components/board/kanban/lane-bucketing";
import type { CardStyle } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

/** Cards rendered directly (no virtualizer) when the count is below this threshold. */
const VIRTUALIZE_THRESHOLD = 50;

/** Estimated height of a single card (px) for the virtualizer's size estimator. */
const ESTIMATED_CARD_HEIGHT = 80;

interface KanbanLaneProps {
  lane: Lane;
  groupId: string;
  groupByColumnId: string;
  cardStyle: CardStyle | undefined;
  sortingDisabled: boolean;
  onCardClick: (taskId: string) => void;
}

export function KanbanLane({
  lane,
  groupId,
  groupByColumnId,
  cardStyle,
  sortingDisabled,
  onCardClick,
}: KanbanLaneProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: lane.id });
  const scrollRef = useRef<HTMLDivElement>(null);

  const tasks = useBoardStore(useShallow((s) => s.tasks));

  // Resolve Task objects from taskIds in lane order.
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const laneTasks = lane.taskIds
    .map((id) => taskMap.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  // @tanstack/react-virtual — only activate when the task count exceeds the threshold.
  const shouldVirtualize = lane.taskIds.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? laneTasks.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 5,
  });

  // Lane header colour — use lane.color if available, otherwise a neutral.
  const headerBg = lane.color ?? "var(--color-surface-hover)";
  // Determine if text should be white or dark based on a rough luminance heuristic.
  // For simplicity, always use white text (the spec says "white text on lane colour").
  const headerTextColor = "#ffffff";

  return (
    <div
      className="flex flex-col shrink-0 rounded-lg border border-[color:var(--color-border)]"
      style={{
        minWidth: 260,
        width: 260,
        // Lane bg must be --color-surface-rail (#F6F7FB) per component-system §7.1.
        backgroundColor: "var(--color-surface-rail, #F6F7FB)",
        boxShadow: isOver ? "0 0 0 2px var(--color-primary)" : undefined,
      }}
    >
      {/* Lane header */}
      <div
        className="flex items-center justify-between px-3 shrink-0 rounded-t-lg"
        style={{
          height: 44,
          backgroundColor: headerBg,
          color: headerTextColor,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        }}
      >
        <span className="font-semibold text-sm truncate">{lane.title}</span>
        <span className="text-xs font-normal ml-2 shrink-0" aria-hidden="true">
          {lane.taskIds.length}
        </span>
        {/* Visually hidden accessible count */}
        <span className="sr-only">{lane.taskIds.length} tasks</span>
      </div>

      {/* Card list area */}
      <div
        ref={(el) => {
          // Attach both the droppable ref and the scroll ref.
          setDroppableRef(el);
          if (el) (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="flex-1 overflow-y-auto p-2"
        style={{
          // max-height 410px per component-system §7.1 visual contract.
          maxHeight: "410px",
          minHeight: 80,
        }}
      >
        <SortableContext items={lane.taskIds} strategy={verticalListSortingStrategy}>
          {shouldVirtualize ? (
            /* Virtualized rendering */
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((vItem) => {
                const task = laneTasks[vItem.index];
                if (!task) return null;
                return (
                  <div
                    key={`${lane.id}:${task.id}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${vItem.size}px`,
                      transform: `translateY(${vItem.start}px)`,
                    }}
                  >
                    <KanbanCardItem
                      task={task}
                      cardStyle={cardStyle}
                      sortingDisabled={sortingDisabled}
                      laneId={lane.id}
                      onClick={onCardClick}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            /* Direct rendering (< VIRTUALIZE_THRESHOLD tasks) */
            laneTasks.map((task) => (
              <KanbanCardItem
                key={`${lane.id}:${task.id}`}
                task={task}
                cardStyle={cardStyle}
                sortingDisabled={sortingDisabled}
                laneId={lane.id}
                onClick={onCardClick}
              />
            ))
          )}
        </SortableContext>

        {/* Empty lane affordance */}
        {laneTasks.length === 0 && (
          <EmptyLaneAddTask
            groupId={groupId}
            groupByColumnId={groupByColumnId}
            dropValue={lane.dropValue}
          />
        )}
      </div>
    </div>
  );
}
