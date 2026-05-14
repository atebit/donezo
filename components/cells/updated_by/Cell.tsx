"use client";

/**
 * UpdatedByCell — read-mode renderer for the "updated_by" derived cell type.
 *
 * Reads `row.updated_by` and `row.updated_at` from the parent task row.
 * Renders a 26px avatar + relative-time string. The `value` prop is ignored
 * for derived types; the task row is the source of truth.
 *
 * Empty state: muted "—".
 */

import React from "react";

import type { Member } from "@/components/shared/MemberStack";
import { MemberStack } from "@/components/shared/MemberStack";
import { relativeTime } from "@/lib/cells/relative-time";
import type { TaskRow } from "@/lib/cells/types";

import type { UpdatedByValue } from "./def";

interface UpdatedByCellProps {
  value: UpdatedByValue | null;
  config: Record<string, never>;
  row: TaskRow;
  columnId?: string;
  /** Optional member roster passed by the orchestrator so avatars resolve. */
  members?: Member[];
}

function UpdatedByCellInner({ row, members }: UpdatedByCellProps) {
  const userId = row.updated_by;
  const updatedAt = row.updated_at;

  if (!userId) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  const resolvedMember = members?.find((m) => m.id === userId) ?? null;
  const timeStr = relativeTime(updatedAt);

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center gap-1.5 px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      {resolvedMember ? (
        <MemberStack members={[resolvedMember]} max={1} size={26} overlap={0} />
      ) : (
        <span
          role="img"
          aria-label="Unknown user"
          className="inline-flex items-center justify-center rounded-full text-xs font-medium shrink-0"
          style={{
            width: 26,
            height: 26,
            backgroundColor: "var(--color-surface-hover)",
            color: "var(--color-fg-muted)",
          }}
        >
          {userId.slice(0, 2).toUpperCase()}
        </span>
      )}
      {timeStr && (
        <span className="text-xs text-[color:var(--color-fg-muted)] truncate">{timeStr}</span>
      )}
    </div>
  );
}

export const Cell = React.memo(UpdatedByCellInner);
Cell.displayName = "UpdatedByCell";
