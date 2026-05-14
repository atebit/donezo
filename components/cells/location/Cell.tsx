"use client";

/**
 * LocationCell — read-mode renderer for the "location" cell type.
 *
 * Renders the location label (or lat/lng fallback) + a MapPin icon.
 * Empty state: visually empty (hover outline affordance only).
 */

import { MapPin } from "lucide-react";
import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { LocationValue } from "./def";

interface LocationCellProps {
  value: LocationValue | null;
  config: Record<string, never>;
  row: TaskRow;
  columnId?: string;
}

function LocationCellInner({ value }: LocationCellProps) {
  if (value == null) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden" />
    );
  }

  const display = value.label ?? `${value.lat}, ${value.lng}`;

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center gap-1.5 px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      <MapPin
        className="shrink-0 text-[color:var(--color-fg-muted)]"
        style={{ width: 14, height: 14 }}
        aria-hidden="true"
      />
      <span className="text-sm text-[color:var(--color-fg)] truncate">{display}</span>
    </div>
  );
}

export const Cell = React.memo(LocationCellInner);
Cell.displayName = "LocationCell";
