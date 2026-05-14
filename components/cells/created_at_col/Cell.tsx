"use client";

/**
 * CreatedAtColCell — read-mode renderer for the "created_at_col" derived cell type.
 *
 * Reads `row.created_at` from the parent task row and renders a relative-time string
 * (e.g. "2h", "5d"). The `value` prop is ignored; the task row is the source of truth.
 *
 * Empty state: muted "—".
 */

import React from "react";

import { relativeTime } from "@/lib/cells/relative-time";
import type { TaskRow } from "@/lib/cells/types";

import type { CreatedAtColValue } from "./def";

interface CreatedAtColCellProps {
  value: CreatedAtColValue | null;
  config: Record<string, never>;
  row: TaskRow;
  columnId?: string;
}

function CreatedAtColCellInner({ row }: CreatedAtColCellProps) {
  const createdAt = row.created_at;
  const timeStr = relativeTime(createdAt);

  if (!createdAt || !timeStr) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      <span className="text-sm text-[color:var(--color-fg-muted)] truncate">{timeStr}</span>
    </div>
  );
}

export const Cell = React.memo(CreatedAtColCellInner);
Cell.displayName = "CreatedAtColCell";
