"use client";

/**
 * WeekCell — read-mode renderer for the "week" cell type.
 *
 * Renders the week in "2026-W19" ISO format.
 * Empty state: visually empty (hover outline affordance only).
 */

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import { formatWeek, type WeekCellValue } from "./def";

interface WeekCellProps {
  value: WeekCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WeekCellInner({ value, config: _config, row: _row }: WeekCellProps) {
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {value ? (
        <span className="truncate text-sm text-[color:var(--color-fg)] tabular-nums">
          {formatWeek(value)}
        </span>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(WeekCellInner);
Cell.displayName = "WeekCell";
