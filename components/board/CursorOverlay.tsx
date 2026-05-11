"use client";

/**
 * CursorOverlay — renders colored dot indicators for remote users currently
 * hovering or focusing the same cell.
 *
 * Reads the `cursors` Map from the board store; filters for entries that match
 * (taskId, columnId); renders absolutely-positioned 8px dots in the cell's
 * top-right corner. Caps at 3 visible dots plus a "+N" label for overflow.
 *
 * Accessibility: `role="presentation"` — these dots are non-interactive
 * decorations; screen readers should not announce them.
 * `pointer-events: none` — never interferes with cell interaction.
 */

import type { ReactElement } from "react";
import { cursorColorForUser } from "@/lib/realtime/cursor-color";
import { useBoardStore } from "@/stores/board-store";
import type { CursorPayload } from "@/stores/types/realtime";

interface CursorOverlayProps {
  taskId: string;
  columnId: string;
}

const MAX_VISIBLE = 3;
const DOT_SIZE = 8; // px
const DOT_OFFSET = 4; // px horizontal spacing between stacked dots

export function CursorOverlay({ taskId, columnId }: CursorOverlayProps): ReactElement | null {
  const cursors = useBoardStore((s) => s.cursors);

  // Filter cursors matching this cell
  const matches: CursorPayload[] = [];
  for (const cursor of cursors.values()) {
    if (cursor.task_id === taskId && cursor.column_id === columnId) {
      matches.push(cursor);
    }
  }

  if (matches.length === 0) return null;

  const visible = matches.slice(0, MAX_VISIBLE);
  const overflow = matches.length - MAX_VISIBLE;

  return (
    // Wrapper: positioned relative to the cell's `position: relative` container.
    // pointer-events: none — never blocks cell clicks or keyboard events.
    <div
      role="presentation"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 2,
        right: 2,
        display: "flex",
        alignItems: "center",
        gap: DOT_OFFSET,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {visible.map((cursor) => (
        <span
          key={cursor.user_id}
          style={{
            display: "inline-block",
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: "50%",
            backgroundColor: cursorColorForUser(cursor.user_id),
            flexShrink: 0,
          }}
        />
      ))}
      {overflow > 0 && (
        <span
          style={{
            fontSize: 10,
            lineHeight: 1,
            color: "var(--color-fg-muted, #888)",
            flexShrink: 0,
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
