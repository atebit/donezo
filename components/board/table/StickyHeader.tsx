"use client";

/**
 * StickyHeader — fixed column-header row for the board table.
 *
 * Rendered once above <TableVirtualizer /> inside <BoardTable />. Stays visible
 * as the user scrolls vertically through groups and tasks.
 *
 * Epic 07 (S19): replaces the static "Name" cell with dynamic per-column
 * ColumnHeader components driven by the board store. Visible columns are
 * filtered using columnPrefsByBoard, sorted by position (store already sorts,
 * but we re-sort defensively here for safety). The title column (first text
 * column by position) is rendered sticky-left outside of ColumnReorder so it
 * always stays as the primary column. All other visible columns are wrapped in
 * ColumnReorder for future horizontal drag-and-drop (S20 wires the drag-end
 * server action). Column resize via ColumnResize is functional after S18.
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
 * S13: <AddColumnButton /> mounted at the right edge.
 * S19: Dynamic columns replace static "Name" cell.
 */

import { Checkbox } from "@base-ui/react/checkbox";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "@/stores/board-store";

import { AddColumnButton } from "./AddColumnButton";
import { ColumnHeader } from "./ColumnHeader";
import { ColumnReorder } from "./ColumnReorder";
import { ColumnResize } from "./ColumnResize";
import type { Column } from "./types";

// ---------------------------------------------------------------------------
// Width constants matching CSS custom properties in app/globals.css
// --size-cell-w-task = 336px (title column default)
// --size-cell-w      = 140px (regular column default)
// ---------------------------------------------------------------------------
const DEFAULT_TITLE_WIDTH = 336;
const DEFAULT_COLUMN_WIDTH = 140;

// ---------------------------------------------------------------------------
// BoardLevelCheckbox — unchanged from epic 06 S12
// ---------------------------------------------------------------------------

function BoardLevelCheckbox() {
  const { selection, tasks } = useBoardStore(
    useShallow((s) => ({
      selection: s.selection,
      tasks: s.tasks,
    })),
  );

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

// ---------------------------------------------------------------------------
// StickyHeader
// ---------------------------------------------------------------------------

export function StickyHeader() {
  // Read columns and prefs from the board store.
  // applyColumnUpsert always re-sorts by position, so the array is already
  // sorted — but we re-sort defensively here in the selector (cheap + safe).
  const columns = useBoardStore(
    useShallow((s) => [...s.columns].sort((a, b) => a.position - b.position)),
  );
  const columnPrefsByBoard = useBoardStore((s) => s.columnPrefsByBoard);
  const boardId = useBoardStore((s) => s.boardId);

  // ---------------------------------------------------------------------------
  // Hidden filter: exclude columns the user has toggled off
  // ---------------------------------------------------------------------------
  const boardPrefs = boardId ? (columnPrefsByBoard[boardId] ?? {}) : {};
  const visibleColumns = columns.filter((col) => !boardPrefs[col.id]?.hidden);

  // ---------------------------------------------------------------------------
  // Title column identification:
  //   - The primary title column is the text-type column with the lowest position.
  //   - Seed convention: position 1, type "text". If none found, fall back to
  //     the first visible column regardless of type (defensive).
  // ---------------------------------------------------------------------------
  const textColumns = visibleColumns.filter((c) => c.type === "text");
  // Avoid non-null assertion: use a guarded reduce with an explicit undefined
  // initial value, then coerce undefined → visibleColumns[0] as the fallback.
  const titleColumn: Column | undefined =
    textColumns.length > 0
      ? textColumns.reduce<Column | undefined>(
          (min, c) => (min === undefined || c.position < min.position ? c : min),
          undefined,
        )
      : visibleColumns[0];

  const otherColumns = titleColumn
    ? visibleColumns.filter((c) => c.id !== titleColumn.id)
    : visibleColumns;

  // ---------------------------------------------------------------------------
  // Width resolver: pref → fallback (title=336, others=140)
  // ---------------------------------------------------------------------------
  const getColumnWidth = (col: Column): number => {
    const pref = boardPrefs[col.id]?.width;
    if (pref !== undefined) return pref;
    return col.id === titleColumn?.id ? DEFAULT_TITLE_WIDTH : DEFAULT_COLUMN_WIDTH;
  };

  return (
    <div className="sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] h-9 flex items-center">
      {/* Board-level tri-state select-all checkbox — S12 */}
      <BoardLevelCheckbox />

      {/*
       * Title column header — sticky-left so it stays visible during horizontal
       * scroll. Not included in ColumnReorder: the title column is always the
       * leftmost data column (epic-06 convention; primary column stays pinned).
       */}
      {titleColumn && (
        <div className="sticky left-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)]">
          <ColumnResize columnId={titleColumn.id} currentWidth={getColumnWidth(titleColumn)}>
            <ColumnHeader column={titleColumn} draggable={false} />
          </ColumnResize>
        </div>
      )}

      {/*
       * Other visible columns — wrapped in ColumnReorder for horizontal DnD.
       * The drag-end server action is wired in S20 (BoardTable.tsx). For now,
       * the SortableContext is in place and resize is fully functional.
       */}
      <ColumnReorder columns={otherColumns}>
        {otherColumns.map((col) => (
          <ColumnResize key={col.id} columnId={col.id} currentWidth={getColumnWidth(col)}>
            <ColumnHeader column={col} />
          </ColumnResize>
        ))}
      </ColumnReorder>

      {/* AddColumnButton — ml-auto pushes it to the far right of the flex row */}
      <div className="ml-auto">
        <AddColumnButton />
      </div>
    </div>
  );
}
