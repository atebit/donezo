"use client";

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

export interface LinkValue {
  url: string;
  label?: string;
}

interface LinkCellProps {
  value: LinkValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

/** Extract the display label: explicit label > domain from URL > full URL. */
function getDisplayLabel(value: LinkValue): string {
  if (value.label) return value.label;
  try {
    return new URL(value.url).hostname;
  } catch {
    return value.url;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LinkCellInner({ value, config: _config, row: _row }: LinkCellProps) {
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {value ? (
        <a
          href={value.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="truncate text-sm text-[color:var(--color-primary)] underline"
          aria-label={value.label ? `${value.label} (${value.url})` : value.url}
        >
          {getDisplayLabel(value)}
        </a>
      ) : null}
    </div>
  );
}

export const Cell = React.memo(LinkCellInner);
Cell.displayName = "LinkCell";
