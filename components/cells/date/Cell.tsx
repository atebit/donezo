"use client";

/**
 * DateCell — read-mode renderer for the "date" cell type.
 *
 * Renders the date formatted via Intl.DateTimeFormat.
 * Empty state: visually empty (hover outline affordance only).
 */

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { DateCellValue, DateConfig } from "./def";

interface DateCellProps {
  value: DateCellValue | null;
  config: DateConfig;
  row: TaskRow;
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DateCellInner({ value, config: _config, row: _row }: DateCellProps) {
  let display: string | null = null;

  if (value?.iso) {
    try {
      display = DATE_FORMAT.format(new Date(value.iso));
    } catch {
      display = value.iso;
    }
  }

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {display ? (
        <span className="truncate text-sm text-[color:var(--color-fg)]">{display}</span>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(DateCellInner);
Cell.displayName = "DateCell";
