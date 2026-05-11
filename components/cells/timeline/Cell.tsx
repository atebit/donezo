"use client";

/**
 * TimelineCell — read-mode renderer for the "timeline" cell type.
 *
 * Renders a horizontal bar with "start – end" label.
 * Width is uniform for v1 (proportional duration deferred to epic 14 polish).
 * Empty state: muted "—".
 */

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { TimelineCellValue } from "./def";

interface TimelineCellProps {
  value: TimelineCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TimelineCellInner({ value, config: _config, row: _row }: TimelineCellProps) {
  if (!value) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  let startLabel = value.start;
  let endLabel = value.end;
  try {
    startLabel = DATE_FORMAT.format(new Date(`${value.start}T00:00:00`));
    endLabel = DATE_FORMAT.format(new Date(`${value.end}T00:00:00`));
  } catch {
    // fallback to raw strings
  }

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {/* Bar */}
      <div className="flex items-center gap-1 min-w-0 w-full" aria-hidden="true">
        <div
          className="flex-1 rounded-full h-1.5 shrink-0"
          style={{
            minWidth: 32,
            maxWidth: 64,
            backgroundColor: "var(--color-primary)",
            opacity: 0.7,
          }}
        />
        <span className="truncate text-xs text-[color:var(--color-fg-muted)]">
          {startLabel} – {endLabel}
        </span>
      </div>
    </div>
  );
}

export const Cell = React.memo(TimelineCellInner);
Cell.displayName = "TimelineCell";
