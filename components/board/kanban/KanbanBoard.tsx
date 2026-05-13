"use client";

/**
 * KanbanBoard — top-level kanban container.
 *
 * Responsibilities:
 *   - Reads kanban config from the active view (groupByColumnId, cardStyle).
 *   - Computes lanes via `bucketTasksIntoLanes` (memoized on store changes).
 *   - Renders a horizontal-scroll lane container with one <KanbanLane /> per lane.
 *   - Hosts the single <DndContext> that drives both within-lane reorder and
 *     cross-lane drop.
 *   - Shows <KanbanGroupByPicker /> when no groupByColumnId is configured.
 *   - Handles cross-lane drop → setCellValue server action.
 *   - Handles person-column multi-assignee confirm dialog (Q8, risk note #4).
 *
 * dnd-kit strategy:
 *   - A single <DndContext> wraps all lanes.
 *   - Each lane body is a `useDroppable` (id = lane.id); handled in <KanbanLane />.
 *   - Each card is a `useSortable` (id = task.id); handled in <KanbanCardItem />.
 *   - `onDragEnd` dispatches either `moveTask` (within-lane reorder) or
 *     `setCellValue` (cross-lane drop).
 *
 * Cross-lane drop value mapping:
 *   - status / priority:  { labelId: lane.dropValue.labelId }
 *   - person:             { userIds: [memberId] }  (single-user overwrite per Q8)
 *   - checkbox:           true | false | null
 *
 * Multi-assignee confirm (risk note #4):
 *   When dropping a task with >1 current assignees into a person lane, a
 *   confirmation dialog is shown before the destructive overwrite. The user
 *   can confirm (overwrites to single user) or cancel (drag reverts).
 */

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { setCellValue } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions";
import { moveTask } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions";
import { KanbanGroupByPicker } from "@/components/board/kanban/KanbanGroupByPicker";
import { KanbanLane } from "@/components/board/kanban/KanbanLane";
import type { Lane } from "@/components/board/kanban/lane-bucketing";
import { bucketTasksIntoLanes } from "@/components/board/kanban/lane-bucketing";
import { TaskCard } from "@/components/board/shared/TaskCard";
import type { TableData } from "@/components/board/table/types";
import { useBoardView } from "@/hooks/use-board-view";
import { positionBetween } from "@/lib/positions";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Given a task id, find which lane(id) it currently belongs to. */
function findLaneForTask(lanes: Lane[], taskId: string): string | null {
  for (const lane of lanes) {
    if (lane.taskIds.includes(taskId)) return lane.id;
  }
  return null;
}

/** Extract current user ids from a person cell (json_value.userIds). */
function extractUserIds(cellsByKey: Map<string, unknown>, taskId: string, colId: string): string[] {
  const cell = cellsByKey.get(`${taskId}:${colId}`) as { json_value?: unknown } | undefined;
  if (!cell?.json_value) return [];
  const json = cell.json_value as { userIds?: unknown };
  if (!Array.isArray(json.userIds)) return [];
  return json.userIds.filter((id): id is string => typeof id === "string");
}

// ---------------------------------------------------------------------------
// Multi-assignee confirm dialog (Base UI / native fallback)
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  open: boolean;
  taskTitle: string;
  laneName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function MultiAssigneeConfirmDialog({
  open,
  taskTitle,
  laneName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-[color:var(--color-surface)] rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-[color:var(--color-fg)] mb-3"
        >
          Replace assignees?
        </h2>
        <p className="text-sm text-[color:var(--color-fg-muted)] mb-5">
          <strong>{taskTitle}</strong> has multiple assignees. Moving it to the{" "}
          <strong>{laneName}</strong> lane will replace them with a single assignee.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-[color:var(--color-border)] text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-[color:var(--color-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Replace assignees
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KanbanBoard
// ---------------------------------------------------------------------------

interface KanbanBoardProps {
  boardId: string;
  /**
   * Initial data passed from the server RSC. The board store is hydrated by
   * <BoardDataProvider> in the layout — this prop is kept for the component
   * signature contract but actual data comes from the store.
   */
  initial: TableData & {
    workspaceMembers?: Array<{
      user_id: string;
      display_name: string | null;
      email: string | null;
      avatar_url: string | null;
    }>;
  };
}

export function KanbanBoard({ boardId: _boardId, initial }: KanbanBoardProps) {
  const { effective } = useBoardView();
  const workspaceMembers = initial.workspaceMembers ?? [];

  // ---------------------------------------------------------------------------
  // Store selectors — useShallow per MEMORY note
  // ---------------------------------------------------------------------------
  const { tasks, cells, columns, labelsByColumn, sortKeys } = useBoardStore(
    useShallow((s) => ({
      tasks: s.tasks,
      cells: s.cells,
      columns: s.columns,
      labelsByColumn: s.labelsByColumn,
      sortKeys: s.sortKeys,
    })),
  );

  // ---------------------------------------------------------------------------
  // Kanban config
  // ---------------------------------------------------------------------------
  const groupByColumnId = effective.kanban?.groupByColumnId ?? null;
  const cardStyle = effective.kanban?.cardStyle;

  // ---------------------------------------------------------------------------
  // Lane computation — memoized on store data + config changes
  // ---------------------------------------------------------------------------
  const lanes = useMemo(() => {
    if (!groupByColumnId) return [];
    return bucketTasksIntoLanes({
      groupByColumnId,
      tasks,
      cellsByKey: cells,
      columns,
      labelsByColumn,
      members: workspaceMembers,
    });
  }, [groupByColumnId, tasks, cells, columns, labelsByColumn, workspaceMembers]);

  // ---------------------------------------------------------------------------
  // dnd-kit state
  // ---------------------------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the pointer to move 5px before starting a drag, to avoid
      // accidental drags on click.
      activationConstraint: { distance: 5 },
    }),
  );

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Multi-assignee confirm dialog state.
  const [pendingDrop, setPendingDrop] = useState<{
    taskId: string;
    toLane: Lane;
    taskTitle: string;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Drag handlers
  // ---------------------------------------------------------------------------

  const performCrossLaneDrop = useCallback(
    async (taskId: string, toLane: Lane) => {
      if (!groupByColumnId) return;
      try {
        await setCellValue({ taskId, columnId: groupByColumnId, value: toLane.dropValue });
      } catch {
        toast.error("Failed to move task");
      }
    },
    [groupByColumnId],
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveTaskId(id);
  }

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTaskId(null);

      const taskId = String(event.active.id);
      const overId = event.over?.id;

      if (!overId || !groupByColumnId) return;

      const fromLaneId = findLaneForTask(lanes, taskId);
      const toLaneId = String(overId);

      // If dropped over a card (another task id), find the lane that contains it.
      // dnd-kit fires over.id = the droppable id (lane) for lane-drops, or
      // the sortable id (task) for within-lane card-over-card drops.
      const toLane =
        lanes.find((l) => l.id === toLaneId) ?? lanes.find((l) => l.taskIds.includes(toLaneId));

      if (!toLane) return;

      // Same lane — within-lane reorder.
      if (fromLaneId === toLane.id) {
        // Reorder is disabled when sortKeys are active (Epic 11 carryover).
        if (sortKeys.length > 0) return;

        // Compute the new position for the dragged task.
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        const laneTasksSorted = [...toLane.taskIds]
          .map((id) => tasks.find((t) => t.id === id))
          .filter(Boolean) as typeof tasks;

        const overIndex = toLane.taskIds.indexOf(toLaneId);
        const currentIndex = toLane.taskIds.indexOf(taskId);
        if (overIndex === -1 || overIndex === currentIndex) return;

        const before = overIndex > 0 ? (laneTasksSorted[overIndex - 1]?.position ?? null) : null;
        const after = laneTasksSorted[overIndex]?.position ?? null;

        let newPosition: number;
        try {
          newPosition = positionBetween(before, after);
        } catch {
          toast.error("Cannot reorder — positions need compaction.");
          return;
        }

        try {
          await moveTask({ taskId, groupId: task.group_id, position: newPosition });
        } catch {
          toast.error("Failed to reorder task");
        }
        return;
      }

      // Cross-lane drop — update the cell value.
      const colType = columns.find((c) => c.id === groupByColumnId)?.type;

      // For person columns: check if the task has > 1 assignees → confirm dialog.
      if (colType === "person") {
        const userIds = extractUserIds(cells as Map<string, unknown>, taskId, groupByColumnId);
        const task = tasks.find((t) => t.id === taskId);
        if (userIds.length > 1 && toLane.id !== "unassigned") {
          // Show confirm dialog before the destructive overwrite.
          setPendingDrop({ taskId, toLane, taskTitle: task?.title ?? "Task" });
          return;
        }
      }

      // Perform the cross-lane drop directly.
      await performCrossLaneDrop(taskId, toLane);
    },
    [lanes, groupByColumnId, columns, cells, tasks, sortKeys, performCrossLaneDrop],
  );

  // ---------------------------------------------------------------------------
  // Multi-assignee confirm handlers
  // ---------------------------------------------------------------------------

  async function handleConfirmDrop() {
    if (!pendingDrop) return;
    const { taskId, toLane } = pendingDrop;
    setPendingDrop(null);
    await performCrossLaneDrop(taskId, toLane);
  }

  function handleCancelDrop() {
    setPendingDrop(null);
  }

  // ---------------------------------------------------------------------------
  // Derive the first group id (for EmptyLaneAddTask)
  // ---------------------------------------------------------------------------
  const firstGroupId = useBoardStore(useShallow((s) => s.groups[0]?.id ?? ""));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // If no groupByColumnId is configured, show the picker.
  if (!groupByColumnId) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <KanbanGroupByPicker />
      </div>
    );
  }

  // Active task for the DragOverlay (ghost card).
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        {/*
         * Mobile (<md): horizontal snap-scroll so users swipe between lanes
         * one at a time.  Each lane is min-w-full (100vw) so exactly one lane
         * is visible at a time.  scroll-snap-type: x mandatory is applied via
         * the `snap-x snap-mandatory` utility classes.
         *
         * Desktop (≥md): existing multi-column flex layout unchanged.
         */}
        <div
          className="flex flex-row gap-0 md:gap-4 p-0 md:p-4 overflow-x-auto flex-1 min-h-0 snap-x snap-mandatory md:snap-none"
          style={{ alignItems: "flex-start" }}
        >
          {lanes.map((lane) => (
            <KanbanLane
              key={lane.id}
              lane={lane}
              groupId={firstGroupId}
              groupByColumnId={groupByColumnId}
              cardStyle={cardStyle}
              sortingDisabled={sortKeys.length > 0}
              onCardClick={(taskId) => {
                // Navigate to task drawer via the existing pattern.
                // useBoardView / the @modal slot handle the drawer; we just need
                // to trigger navigation to the task detail route.
                // The URL pattern is /w/.../b/.../t/<taskId> (intercepted by @modal).
                // We use window.history.pushState to stay within the SPA shell.
                const path = window.location.pathname.replace(/\/kanban.*/, `/t/${taskId}`);
                window.history.pushState({}, "", path);
              }}
            />
          ))}

          {/* Add lane affordance — not in scope for Slice B; future epic */}
        </div>

        {/* DragOverlay — renders a ghost card while dragging */}
        <DragOverlay>
          {activeTask ? (
            <div className="opacity-80 rotate-1">
              <TaskCard
                task={activeTask}
                cellsByKey={cells}
                columns={columns}
                cardStyle={cardStyle}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Multi-assignee confirm dialog */}
      <MultiAssigneeConfirmDialog
        open={pendingDrop !== null}
        taskTitle={pendingDrop?.taskTitle ?? ""}
        laneName={pendingDrop?.toLane.title ?? ""}
        onConfirm={() => void handleConfirmDrop()}
        onCancel={handleCancelDrop}
      />
    </>
  );
}
