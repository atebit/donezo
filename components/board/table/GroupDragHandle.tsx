"use client";

/**
 * GroupDragHandle — drag handle button for group header rows.
 *
 * Receives dnd-kit's `attributes` and `listeners` from the parent
 * GroupHeaderRow (which calls useSortable) and spreads them onto the button,
 * wiring up both pointer-based and keyboard-based drag interactions.
 *
 * Visibility: hidden at rest, revealed on group-row hover via Tailwind's
 * `group-hover:opacity-100` pattern (the parent div must carry className="group …").
 *
 * Keyboard: tabIndex={0} lets keyboard users Tab to this handle and press
 * Space to pick up the group, use arrow keys to move, and Space again to drop
 * (per dnd-kit's KeyboardSensor contract with sortableKeyboardCoordinates).
 */

import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";

interface GroupDragHandleProps {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
}

export function GroupDragHandle({ attributes, listeners }: GroupDragHandleProps) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder group"
      className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--motion-base)] flex-shrink-0 flex items-center justify-center w-5 h-5 cursor-grab active:cursor-grabbing text-[color:var(--color-fg-muted)]"
      {...attributes}
      {...listeners}
    >
      <GripVertical size={14} aria-hidden="true" />
    </button>
  );
}
