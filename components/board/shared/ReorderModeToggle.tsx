"use client";

/**
 * ReorderModeToggle — "Done" pill shown when the board is in touch reorder mode.
 *
 * Tap to exit reorder mode (sets `reorderMode = false` in the board store).
 *
 * Visibility contract (enforced by caller):
 *   - Rendered only when `reorderMode === true`.
 *   - Shown on touch devices only; desktop drag-and-drop uses mouse cursor.
 *
 * Visual spec:
 *   - Pill button: bg --color-primary, white text, rounded-full, px-4 py-1.5 text-sm.
 */

import { useBoardStore } from "@/stores/board-store";

export function ReorderModeToggle() {
  const setReorderMode = useBoardStore((s) => s.setReorderMode);

  return (
    <button
      type="button"
      onClick={() => setReorderMode(false)}
      className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-[color:var(--color-primary)] text-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
      aria-label="Exit reorder mode"
      data-testid="reorder-mode-toggle"
    >
      Done
    </button>
  );
}
