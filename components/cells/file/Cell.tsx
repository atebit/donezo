"use client";

/**
 * FileCell — read-mode renderer for the "file" cell type.
 *
 * Renders a Paperclip icon + attachment count badge.
 * File upload / management is deferred to epic 10 — this cell is display-only.
 * Empty state: muted "—".
 */

import { Paperclip } from "lucide-react";
import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { FileCellValue } from "./def";

interface FileCellProps {
  value: FileCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FileCellInner({ value, config: _config, row: _row }: FileCellProps) {
  const count = value?.attachmentIds.length ?? 0;

  if (count === 0) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${count} attachment${count === 1 ? "" : "s"}`}
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 gap-1.5 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden"
    >
      <Paperclip
        size={14}
        aria-hidden="true"
        className="shrink-0 text-[color:var(--color-fg-muted)]"
      />
      <span className="text-sm tabular-nums text-[color:var(--color-fg)]">{count}</span>
    </div>
  );
}

export const Cell = React.memo(FileCellInner);
Cell.displayName = "FileCell";
