"use client";

/**
 * BoardCardList — mobile card list for all tasks on a board.
 *
 * Groups tasks by group, rendering group headers and task cards.
 * Empty state: <EmptyState /> when there are no tasks at all.
 *
 * dnd-kit wiring:
 *   - Each task card is wrapped in a useSortable wrapper in reorderMode.
 *   - Groups use SortableContext for per-group vertical ordering.
 *   - DnD is gated on `reorderMode` — when false, sortable is disabled.
 *
 * Long-press detection:
 *   - A 250ms pointer-down timer on each card sets reorderMode = true.
 *   - The timer is cleared on pointerup / pointermove (>5px).
 */

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Group, Task } from "@/components/board/table/types";
import { EmptyState } from "@/components/shared/empty-states/EmptyState";
import { IconLayoutList } from "@/lib/icons";
import { useBoardStore } from "@/stores/board-store";
import { ReorderModeToggle } from "../shared/ReorderModeToggle";
import { BoardCard } from "./BoardCard";

// ---------------------------------------------------------------------------
// SortableCard — dnd-kit sortable wrapper for a single card
// ---------------------------------------------------------------------------

interface SortableCardProps {
  task: Task;
}

function SortableCard({ task }: SortableCardProps) {
  const reorderMode = useBoardStore((s) => s.reorderMode);
  const setReorderMode = useBoardStore((s) => s.setReorderMode);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { kind: "task", groupId: task.group_id },
    disabled: !reorderMode,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
    ...(isDragging ? { opacity: 0.5 } : {}),
  };

  // Long-press detection: 250ms hold on the card enters reorder mode.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reorderMode) return; // already in reorder mode
      startPos.current = { x: e.clientX, y: e.clientY };
      longPressTimer.current = setTimeout(() => {
        setReorderMode(true);
      }, 250);
    },
    [reorderMode, setReorderMode],
  );

  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    startPos.current = null;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!longPressTimer.current || !startPos.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 5 || dy > 5) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      data-testid="sortable-card"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerCancel={onPointerUp}
    >
      <BoardCard
        task={task}
        dragHandleListeners={listeners}
        dragHandleAttributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupSection — renders a group header + its task cards
// ---------------------------------------------------------------------------

interface GroupSectionProps {
  group: Group;
  tasks: Task[];
}

function GroupSection({ group, tasks }: GroupSectionProps) {
  const taskIds = tasks.map((t) => t.id);

  return (
    <section aria-label={`Group: ${group.name}`}>
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-[color:var(--color-surface)] z-10">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color ?? "var(--color-fg-muted)" }}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-[color:var(--color-fg)]">{group.name}</h3>
        <span className="text-xs text-[color:var(--color-fg-muted)] ml-1">{tasks.length}</span>
      </div>

      {/* Task cards */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 px-3 pb-3">
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

// ---------------------------------------------------------------------------
// BoardCardList
// ---------------------------------------------------------------------------

export function BoardCardList() {
  const { groups, tasks, reorderMode } = useBoardStore(
    useShallow((s) => ({
      groups: s.groups,
      tasks: s.tasks,
      reorderMode: s.reorderMode,
    })),
  );
  const t = useTranslations("empty.noTasks");

  const totalTasks = tasks.length;

  if (totalTasks === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <EmptyState icon={IconLayoutList} title={t("title")} description={t("description")} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col flex-1 overflow-y-auto overscroll-contain"
      data-testid="board-card-list"
    >
      {/* Reorder mode indicator + exit button */}
      {reorderMode && (
        <div className="sticky top-0 z-20 flex justify-end px-3 py-2 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)]">
          <ReorderModeToggle />
        </div>
      )}

      {groups.map((group) => {
        const groupTasks = tasks
          .filter((t) => t.group_id === group.id)
          .sort((a, b) => a.position - b.position);
        return <GroupSection key={group.id} group={group} tasks={groupTasks} />;
      })}
    </div>
  );
}
