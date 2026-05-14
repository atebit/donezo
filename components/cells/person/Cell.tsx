"use client";

/**
 * PersonCell — read-mode renderer for the "person" cell type.
 *
 * Renders a <MemberStack> when members are available (passed via the members prop
 * from the board context), or falls back to a count badge when the member list is
 * not hydrated. The S15 orchestrator is responsible for passing board-level member
 * data through the cell rendering pipeline.
 *
 * Empty state: muted "—".
 */

import React from "react";

import type { Member } from "@/components/shared/MemberStack";
import { MemberStack } from "@/components/shared/MemberStack";
import type { TaskRow } from "@/lib/cells/types";

import type { PersonCellValue } from "./def";

interface PersonCellProps {
  value: PersonCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
  /** Optional member roster passed by the orchestrator (S15) so avatars resolve. */
  members?: Member[];
}

function PersonCellInner({ value, members }: PersonCellProps) {
  const userIds = value?.userIds ?? [];

  if (userIds.length === 0) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  // Resolve member objects from the supplied roster (when available).
  const resolvedMembers: Member[] = members
    ? userIds.flatMap((uid) => {
        const m = members.find((m) => m.id === uid);
        return m ? [m] : [];
      })
    : [];

  // If member objects resolved, render MemberStack.
  if (resolvedMembers.length > 0) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <MemberStack members={resolvedMembers} max={3} size={26} overlap={-5} />
      </div>
    );
  }

  // Fallback: member roster not hydrated — show count badge.
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
      <span
        role="img"
        aria-label={`${userIds.length} person${userIds.length !== 1 ? "s" : ""} assigned`}
        className="inline-flex items-center justify-center rounded-full text-xs font-medium text-[color:var(--color-fg-muted)]"
        style={{
          width: 26,
          height: 26,
          backgroundColor: "var(--color-surface-hover)",
        }}
      >
        {userIds.length}
      </span>
    </div>
  );
}

export const Cell = React.memo(PersonCellInner);
Cell.displayName = "PersonCell";
