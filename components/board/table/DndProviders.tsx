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
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { ReactNode } from "react";

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DndProviders({ children, onGroupReorder, onTaskReorder }: DndProvidersProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // No drop target — nothing to do.
    if (!over) return;

    // Same position — skip.
    if (active.id === over.id) return;

    const activeKind = active.data.current?.kind as "group" | "task" | undefined;
    const overKind = over.data.current?.kind as "group" | "task" | undefined;

    if (activeKind === "group") {
      // Group reorder: delegate with the raw over id.
      onGroupReorder(String(active.id), String(over.id));
      return;
    }

    if (activeKind === "task") {
      const activeGroupId = active.data.current?.groupId as string | undefined;
      const overGroupId =
        overKind === "task"
          ? (over.data.current?.groupId as string | undefined)
          : overKind === "group"
            ? // Dropped onto a group header — destination group is the header's group id
              (over.data.current?.groupId as string | undefined)
            : undefined;

      if (!activeGroupId || !overGroupId || !overKind) return;

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
