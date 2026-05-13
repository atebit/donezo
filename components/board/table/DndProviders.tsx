"use client";

/**
 * DndProviders — wraps children with @dnd-kit/core's DndContext.
 *
 * Sensors:
 *   - PointerSensor with a 4px activation distance (prevents accidental
 *     drags on click).
 *   - KeyboardSensor using dnd-kit's sortableKeyboardCoordinates for
 *     Space-to-pick-up + arrow-key movement + Space-to-drop.
 *
 * Collision detection: closestCenter — works well for vertical lists.
 *
 * onDragEnd: reads active.data.current.kind and delegates to the
 * appropriate parent callback.  All position math is left to the
 * parent (BoardTable), which has full access to the store state.
 */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

export interface DndProvidersProps {
  children: ReactNode;
  /** Called when a group header is dropped into a new position. */
  onGroupReorder: (groupId: string, overId: string) => void;
  /** Called when a task is dropped — may be same or different group. */
  onTaskReorder: (args: {
    taskId: string;
    activeGroupId: string;
    overId: string;
    overKind: "task" | "group";
    overGroupId: string;
  }) => void;
  /**
   * Called when a column header is dropped into a new position.
   * columnId: the dragged column's id; overId: the column id it was dropped onto.
   * Optional — column DnD is wired in S20 (BoardTable provides this).
   */
  onColumnReorder?: (columnId: string, overId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DndProviders({
  children,
  onGroupReorder,
  onTaskReorder,
  onColumnReorder,
}: DndProvidersProps) {
  // Epic 14 — reorderMode: TouchSensor is only active when the user has
  // long-pressed to enter touch reorder mode. This prevents accidental drags
  // during scroll. MouseSensor replaces PointerSensor to avoid double-fire
  // on hybrid (pointer + touch) devices — see epic-14 dispatch risk note.
  const reorderMode = useBoardStore((s) => s.reorderMode);

  const sensors = useSensors(
    // Mouse drag: always active (desktop and hybrid pointer events).
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Touch drag: only when reorderMode is true (long-press activates it).
    useSensor(TouchSensor, {
      activationConstraint: reorderMode
        ? { delay: 250, tolerance: 5 }
        : // Setting a very large delay effectively disables the sensor without
          // unregistering it. We cannot conditionally call useSensor (hooks rules).
          { delay: 999999, tolerance: 0 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // No drop target — nothing to do.
    if (!over) return;

    // Same position — skip.
    if (active.id === over.id) return;

    const activeKind = active.data.current?.kind as "group" | "task" | "column" | undefined;
    const overKind = over.data.current?.kind as "group" | "task" | "column" | undefined;

    if (activeKind === "column") {
      // Column reorder: delegate with the raw over id.
      onColumnReorder?.(String(active.id), String(over.id));
      return;
    }

    if (activeKind === "group") {
      // Group reorder: delegate with the raw over id.
      onGroupReorder(String(active.id), String(over.id));
      return;
    }

    if (activeKind === "task") {
      // A task can only be dropped onto another task or a group header —
      // not onto a column header. Guard ensures overKind is narrowed correctly.
      if (overKind !== "task" && overKind !== "group") return;

      const activeGroupId = active.data.current?.groupId as string | undefined;
      const overGroupId =
        overKind === "task"
          ? (over.data.current?.groupId as string | undefined)
          : // overKind === "group": dropped onto a group header — destination group is the header's group id
            (over.data.current?.groupId as string | undefined);

      if (!activeGroupId || !overGroupId) return;

      onTaskReorder({
        taskId: String(active.id),
        activeGroupId,
        overId: String(over.id),
        overKind,
        overGroupId,
      });
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}
