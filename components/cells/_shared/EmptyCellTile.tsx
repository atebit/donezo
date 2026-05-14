"use client";

/**
 * EmptyCellTile — dashed-border empty-state tile for cell types that have a
 * distinct visual affordance when unset (status, priority).
 *
 * Visual spec (Epic 16 Slice C):
 *   - 1px dashed border using --color-border-strong
 *   - Full-bleed within the cell container (same min-w / h as filled cells)
 *   - No text, no background fill — click-to-set affordance via the hover
 *     outline on the parent TableCell button
 *
 * Used by: StatusCell (status/Cell.tsx), PriorityCell (priority/Cell.tsx)
 */

import React from "react";

export const EmptyCellTile = React.memo(function EmptyCellTile() {
  return (
    <div
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-dashed border-[color:var(--color-border-strong)] flex items-center justify-center"
      aria-label="Not set"
      role="img"
    />
  );
});
EmptyCellTile.displayName = "EmptyCellTile";
