"use client";

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import { findCountryByCode } from "./iso-list";

interface CountryCellProps {
  value: string | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CountryCellInner({ value, config: _config, row: _row }: CountryCellProps) {
  const country = value ? findCountryByCode(value) : undefined;

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden gap-1">
      {country ? (
        <>
          <span className="truncate text-sm text-[color:var(--color-fg)]">{country.name}</span>
          <span className="text-xs text-[color:var(--color-fg-muted)] flex-shrink-0">
            {country.code}
          </span>
        </>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(CountryCellInner);
Cell.displayName = "CountryCell";
