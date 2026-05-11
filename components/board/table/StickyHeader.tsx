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
 */
export function StickyHeader() {
  return (
    <div className="sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] h-9 flex items-center">
      {/* Name / task-title column header */}
      <div className="w-[var(--size-cell-w-task)] px-3 text-sm font-medium text-[color:var(--color-fg)]">
        Name
      </div>

      {/* Placeholder slot for <AddColumnButton /> — wired in S13 */}
      <div className="flex-1" aria-hidden="true" />
    </div>
  );
}
