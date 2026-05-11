"use client";

/**
 * VoteCell — read-mode renderer for the "vote" cell type.
 *
 * Renders a thumbs-up icon (lucide ThumbsUp) plus a count badge.
 * Interaction (toggle) is handled via the Editor — the orchestrator (S15)
 * opens the inline editor on click, which toggles and closes immediately.
 *
 * Empty state: icon + "0" count.
 */

import { ThumbsUp } from "lucide-react";
import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { VoteCellValue } from "./def";

interface VoteCellProps {
  value: VoteCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function VoteCellInner({ value, config: _config, row: _row }: VoteCellProps) {
  const count = value?.userIds.length ?? 0;

  return (
    <div
      role="img"
      aria-label={`${count} vote${count === 1 ? "" : "s"}`}
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 gap-1.5 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden cursor-pointer"
    >
      <ThumbsUp
        size={14}
        aria-hidden="true"
        className="shrink-0"
        style={{ color: count > 0 ? "var(--color-primary)" : "var(--color-fg-muted)" }}
      />
      <span
        className="text-sm tabular-nums"
        style={{ color: count > 0 ? "var(--color-fg)" : "var(--color-fg-muted)" }}
      >
        {count}
      </span>
    </div>
  );
}

export const Cell = React.memo(VoteCellInner);
Cell.displayName = "VoteCell";
