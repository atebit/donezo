"use client";

/**
 * NumberCell — read-mode renderer for the "number" cell type.
 *
 * Renders the number formatted with Intl.NumberFormat (thousands separators)
 * using the configured decimal places (default 2) and optional suffix.
 * Empty state: visually empty (hover outline affordance only).
 *
 * Note (deferred): hover-reveal +/- increment icons are deferred to the
 * epic-14 polish pass. They require interactive child controls firing
 * onChange events through the orchestrator.
 */

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { NumberConfig } from "./def";

interface NumberCellProps {
  value: number | null;
  config: NumberConfig;
  row: TaskRow;
}

function NumberCellInner({ value, config }: NumberCellProps) {
  let display: string;

  if (value == null) {
    display = "";
  } else {
    const decimals = config.decimals ?? 2;
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
    display = config.suffix ? `${formatted}${config.suffix}` : formatted;
  }

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {display ? (
        <span className="truncate text-sm text-[color:var(--color-fg)] tabular-nums">
          {display}
        </span>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(NumberCellInner);
Cell.displayName = "NumberCell";
