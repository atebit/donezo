"use client";

/**
 * StickyHeader — fixed column-header row for the board table.
 *
 * Rendered once above <TableVirtualizer /> inside <BoardTable />. Stays visible
 * as the user scrolls vertically through groups and tasks.
 *
 * Epic 06 ships a single "Name" column. The <AddColumnButton /> slot (right
 * edge) is owned by S13 and will be appended there. The outer div provides
 * the sticky chrome; inner cells match the column widths defined in
 * app/globals.css via CSS custom properties.
 *
 * Z-index uses --z-sticky (2). The board header's --z-board-header (30) is
 * higher, so the header chrome never bleeds under the board header.
 *
 * ARIA note: ARIA table roles (role="columnheader", role="row") are deferred
 * to epic 14's a11y polish pass. Using these roles on <div> elements requires
 * the full ARIA table tree (table → rowgroup → row → cell) and focusability
 * constraints enforced by Biome's a11y rules. For now, the linter-safe pattern
 * uses data attributes and visible labels only. See S10 done report for context.
 *
 * S12: Tri-state board-level checkbox added at the left edge.
 * S13: <AddColumnButton /> will be mounted in the right slot.
 */

import { Checkbox } from "@base-ui/react/checkbox";
import { useBoardStore } from "@/stores/board-store";

import { AddColumnButton } from "./AddColumnButton";

function BoardLevelCheckbox() {
  const { selection, tasks } = useBoardStore((s) => ({
    selection: s.selection,
    tasks: s.tasks,
  }));

  const totalInScope = tasks.length;
  const selectedInScope = tasks.filter((t) => selection.has(t.id)).length;

  const checked = selectedInScope === totalInScope && totalInScope > 0;
  const indeterminate = selectedInScope > 0 && selectedInScope < totalInScope;

  return (
    <Checkbox.Root
      checked={checked}
      indeterminate={indeterminate}
      onCheckedChange={(next) => useBoardStore.getState().selectAll(next)}
      aria-label="Select all tasks"
      className="w-[var(--size-cell-w-checkbox)] flex-shrink-0 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
    >
      <span
        className="w-4 h-4 rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] flex items-center justify-center transition-colors duration-[var(--motion-fast)]"
        style={{
          backgroundColor: checked || indeterminate ? "var(--color-primary)" : "transparent",
          borderColor: checked || indeterminate ? "var(--color-primary)" : undefined,
        }}
      >
        <Checkbox.Indicator keepMounted>
          {indeterminate ? (
            /* Indeterminate dash */
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none" aria-hidden="true">
              <path d="M1 1H9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
            /* Checkmark */
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </Checkbox.Indicator>
      </span>
    </Checkbox.Root>
  );
}

export function StickyHeader() {
  return (
    <div className="sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] h-9 flex items-center">
      {/* Board-level tri-state select-all checkbox — S12 */}
      <BoardLevelCheckbox />

      {/* Name / task-title column header */}
      <div className="w-[var(--size-cell-w-task)] px-3 text-sm font-medium text-[color:var(--color-fg)]">
        Name
      </div>

      {/* Spacer pushes AddColumnButton to the far right */}
      <div className="flex-1" aria-hidden="true" />

      {/* Add column button — disabled, "Coming in epic 07" tooltip */}
      <AddColumnButton />
    </div>
  );
}
