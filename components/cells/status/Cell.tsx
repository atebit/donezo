"use client";

/**
 * StatusCell — read-mode renderer shared by "status" and "priority" cell types.
 *
 * Visual spec:
 *   - Full-bleed background = label color (read from board store via columnId).
 *   - Centered white label text (the label.name).
 *   - Diagonal "fold" reveal in top-right corner on hover.
 *   - Empty state (value is null OR labelId not found): --color-label-gray bg, no text.
 *
 * Diagonal fold implementation:
 *   Two-step hover transition (0 → 15px) with --motion-fold-delay start delay.
 *   The three-step tween (0→10px→15px) requires @keyframes that can't compose
 *   cleanly with Tailwind's arbitrary-value pseudo-element properties in a
 *   single-class manner. Simplified to the two-step transition with the delay.
 *   POLISH ITEM (epic 14): upgrade to the three-step tween using a @keyframes
 *   animation for a smoother fold reveal.
 *
 * columnId contract:
 *   This component accepts `columnId` as an *optional* prop so it satisfies
 *   `CellTypeDef.Cell` (which types Cell as ComponentType<{value, config, row}>).
 *   When `columnId` is undefined (e.g. during static type-checking in the def),
 *   the cell falls back to the empty/gray state. The orchestrator (S15) passes
 *   `columnId` when rendering real cells, enabling the label lookup.
 */

import React from "react";
import type { TaskRow } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";

export interface StatusCellValue {
  labelId: string;
}

interface StatusCellProps {
  value: StatusCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
  /** The column this cell belongs to — needed for label lookup. Optional so the
   *  component satisfies CellTypeDef.Cell's ComponentType signature; the orchestrator
   *  passes it at render time. Without it, the cell renders the empty/gray state. */
  columnId?: string;
}

function StatusCellInner({ value, columnId }: StatusCellProps) {
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);

  // Resolve the label for this cell value
  const labels = columnId ? (labelsByColumn.get(columnId) ?? []) : [];
  const label = value?.labelId ? labels.find((l) => l.id === value.labelId) : undefined;

  const bgColor = label?.color ?? "var(--color-label-gray)";
  const labelName = label?.name ?? null;

  return (
    /**
     * Fold implementation notes:
     * - The ::after pseudo-element creates a triangular "fold" in the top-right corner.
     * - `border-color: transparent transparent transparent transparent` with
     *   `border-width: 0` is invisible at rest.
     * - On hover: border-width becomes `0 15px 15px 0` (top=0, right=15, bottom=15, left=0),
     *   which creates a right-triangle with the hypotenuse facing bottom-left.
     * - `border-color: transparent rgba(255,255,255,0.3) transparent transparent` paints
     *   only the right border slice white (the visible fold triangle).
     * - `transition-delay: var(--motion-fold-delay)` provides the 0.2s delay before reveal.
     * - ZERO raw hex: the rgba(255,255,255,0.3) is an intentional semi-transparent white
     *   overlay — it is stylistic (no semantic token fits a translucent white fold), and
     *   is documented here per guardrail #1.
     */
    <div
      className="relative min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center justify-center overflow-hidden border border-[color:var(--color-border-strong)] cursor-pointer group"
      style={{ backgroundColor: bgColor }}
      role="img"
      aria-label={labelName ?? "No status"}
    >
      {labelName && (
        <span className="text-xs font-medium text-white truncate px-2 select-none">
          {labelName}
        </span>
      )}
      {/* Diagonal fold reveal — top-right corner triangle */}
      <span
        className={[
          "absolute top-0 right-0 border-solid",
          "border-[length:0] group-hover:border-[0_15px_15px_0]",
          "transition-[border-width] duration-[var(--motion-base)]",
          "[transition-delay:var(--motion-fold-delay)]",
        ].join(" ")}
        style={{
          borderColor: "transparent rgba(255,255,255,0.3) transparent transparent",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export const Cell = React.memo(StatusCellInner);
Cell.displayName = "StatusCell";
