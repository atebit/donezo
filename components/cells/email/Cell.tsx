"use client";

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

interface EmailCellProps {
  value: string | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EmailCellInner({ value, config: _config, row: _row }: EmailCellProps) {
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {value ? (
        <a
          href={`mailto:${value}`}
          onClick={(e) => e.stopPropagation()}
          className="truncate text-sm text-[color:var(--color-link)] underline"
          aria-label={`Email ${value}`}
        >
          {value}
        </a>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(EmailCellInner);
Cell.displayName = "EmailCell";
