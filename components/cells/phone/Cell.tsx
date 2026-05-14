"use client";

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

interface PhoneCellProps {
  value: string | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PhoneCellInner({ value, config: _config, row: _row }: PhoneCellProps) {
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {value ? (
        <a
          href={`tel:${value}`}
          onClick={(e) => e.stopPropagation()}
          className="truncate text-sm text-[color:var(--color-fg)]"
          aria-label={`Call ${value}`}
        >
          {value}
        </a>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(PhoneCellInner);
Cell.displayName = "PhoneCell";
