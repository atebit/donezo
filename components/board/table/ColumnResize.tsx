"use client";

/**
 * ColumnResize — wraps a column header and renders a drag handle on its right edge.
 *
 * The parent (StickyHeader / ColumnHeader, S19) is responsible for:
 *   - Reading the current width from `useBoardStore`:
 *       `const width = useBoardStore((s) => s.columnPrefsByBoard[boardId]?.[columnId]?.width)`
 *   - Falling back to the CSS custom property `var(--size-cell-w)` (140px) when
 *     no persisted width exists.
 *   - Passing the resolved width in as `currentWidth`.
 *
 * The resize handle acquires pointer capture on pointerdown so move/up events fire
 * reliably even when the pointer leaves the element during a fast drag.
 *
 * Accessibility:
 *   - The handle is a <button> so it is keyboard-focusable without extra tabIndex.
 *   - aria-label identifies the action; S19 can pass the column name for a richer
 *     label by composing this component with a computed aria-label prop if desired.
 */

import type { ReactNode } from "react";

import { useColumnResize } from "@/hooks/use-column-resize";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColumnResizeProps {
  columnId: string;
  currentWidth: number;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ColumnResize({ columnId, currentWidth, children }: ColumnResizeProps) {
  const handlers = useColumnResize(columnId, currentWidth);

  return (
    <div className="relative" style={{ width: currentWidth }}>
      {children}

      {/* Resize handle — positioned on the right edge of the header cell */}
      <button
        type="button"
        data-resize-handle
        data-column-id={columnId}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize border-0 bg-transparent p-0 hover:bg-[color:var(--color-primary)] focus-visible:bg-[color:var(--color-primary)] focus-visible:outline-none"
        aria-label="Resize column"
        {...handlers}
      />
    </div>
  );
}
