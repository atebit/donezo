"use client";

/**
 * TagsCell — read-mode renderer for the "tags" cell type.
 *
 * Visual spec:
 *   - Renders tags as a horizontal row of small chips.
 *   - Chip background: --color-surface-hover (a generic muted gray-blue token).
 *     This is the nearest semantic token to "generic light gray chip" in the
 *     project palette. Documented here per guardrail #1.
 *   - Truncate after 3 chips with a "+N" overflow chip.
 *   - Empty state: muted "—".
 */

import React from "react";

import type { TaskRow } from "@/lib/cells/types";

import type { TagsCellValue } from "./def";

const MAX_VISIBLE = 3;

interface TagsCellProps {
  value: TagsCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TagsCellInner({ value, config: _config, row: _row }: TagsCellProps) {
  const tags = value?.values ?? [];

  if (tags.length === 0) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  const visible = tags.slice(0, MAX_VISIBLE);
  const overflow = tags.length - MAX_VISIBLE;

  return (
    <div
      role="img"
      aria-label={`Tags: ${tags.join(", ")}`}
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 gap-1 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden"
    >
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-[var(--radius-pill)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-fg)] whitespace-nowrap shrink-0"
          style={{ backgroundColor: "var(--color-surface-hover)" }}
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center rounded-[var(--radius-pill)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-fg-muted)] whitespace-nowrap shrink-0"
          style={{ backgroundColor: "var(--color-surface-hover)" }}
          title={`${overflow} more tag${overflow === 1 ? "" : "s"}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

export const Cell = React.memo(TagsCellInner);
Cell.displayName = "TagsCell";
