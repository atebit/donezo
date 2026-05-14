"use client";

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

interface TextCellProps {
  value: string | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TextCellInner({ value, config: _config, row: _row }: TextCellProps) {
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {value ? (
        <span className="truncate text-sm text-[color:var(--color-fg)]">{value}</span>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(TextCellInner);
Cell.displayName = "TextCell";
