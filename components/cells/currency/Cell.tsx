"use client";

/**
 * CurrencyCell — read-mode renderer for the "currency" cell type.
 *
 * Renders the number formatted as a currency string via Intl.NumberFormat.
 * Default currency: USD. Empty state: visually empty (hover outline affordance only).
 */

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { CurrencyConfig } from "./def";

interface CurrencyCellProps {
  value: number | null;
  config: CurrencyConfig;
  row: TaskRow;
}

function CurrencyCellInner({ value, config }: CurrencyCellProps) {
  let display: string;

  if (value == null) {
    display = "";
  } else {
    try {
      display = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: config.currency ?? "USD",
      }).format(value);
    } catch {
      // Fallback if an invalid currency code is stored in config
      display = `${config.currency ?? "USD"} ${value.toFixed(2)}`;
    }
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

export const Cell = React.memo(CurrencyCellInner);
Cell.displayName = "CurrencyCell";
