"use client";

/**
 * RatingCell — read-mode renderer for the "rating" cell type.
 *
 * Renders `config.max ?? 5` stars using lucide Star icons.
 * Filled stars (up to `value`) use `--color-label-yellow` for color.
 * Hollow stars beyond `value` use `--color-fg-subtle`.
 *
 * Hover state: highlights stars up to the pointer position via mouse enter/leave
 * on individual star buttons (read-only, display-only).
 */

import { Star } from "lucide-react";
import React, { useState } from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { RatingConfig } from "./def";

interface RatingCellProps {
  value: number | null;
  config: RatingConfig;
  row: TaskRow;
}

function RatingCellInner({ value, config }: RatingCellProps) {
  const max = config.max ?? 5;
  const filled = value ?? 0;
  const [hovered, setHovered] = useState<number | null>(null);

  const effectiveFilled = hovered !== null ? hovered : filled;

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const starIndex = i + 1;
        const isFilled = starIndex <= effectiveFilled;
        return (
          <span
            key={starIndex}
            onMouseEnter={() => setHovered(starIndex)}
            onMouseLeave={() => setHovered(null)}
            aria-hidden="true"
          >
            <Star
              className="shrink-0"
              style={{
                width: 14,
                height: 14,
                color: isFilled ? "var(--color-label-yellow)" : "var(--color-fg-subtle)",
                fill: isFilled ? "currentColor" : "none",
              }}
              aria-hidden="true"
            />
          </span>
        );
      })}
    </div>
  );
}

export const Cell = React.memo(RatingCellInner);
Cell.displayName = "RatingCell";
