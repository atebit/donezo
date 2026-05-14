"use client";

/**
 * StickyHeader — fixed column-header row for the board table.
 *
 * Epic 16 (Slice A): converted from flex row to CSS grid row sharing the
 * GridTemplateContext column template. Deduped column logic moved to
 * useVisibleColumns(). Sticky-top is preserved via `position: sticky; top: 0`.
 * Title cell is `position: sticky; left: 0; z-index: var(--z-sticky)`.
 */

import { Checkbox } from "@base-ui/react/checkbox";
import { useShallow } from "zustand/react/shallow";
import { useBoardStore } from "@/stores/board-store";

import { AddColumnButton } from "./AddColumnButton";
import { ColumnHeader } from "./ColumnHeader";
import { ColumnReorder } from "./ColumnReorder";
import { ColumnResize } from "./ColumnResize";
import { useGridTemplate } from "./grid-template-context";
import { useVisibleColumns } from "./use-visible-columns";

// ---------------------------------------------------------------------------
// BoardLevelCheckbox — unchanged visual contract
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
      className="w-full h-full flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
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
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none" aria-hidden="true">
              <path d="M1 1H9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          ) : (
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
  const { gridTemplateColumns } = useGridTemplate();
  const { titleColumn, otherColumns, getColumnWidth } = useVisibleColumns();

  return (
    <div
      className="sticky top-0 z-[var(--z-sticky)] bg-[color:var(--color-surface)] border-b border-[color:var(--color-border-strong)] h-9 grid px-3"
      style={{ gridTemplateColumns }}
    >
      {/* Board-level tri-state select-all checkbox */}
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
       * ColumnReorder renders a SortableContext + a flex container for its children.
       * Each child is a grid item — ColumnReorder's inner flex just wraps them.
       */}
      <ColumnReorder columns={otherColumns}>
        {otherColumns.map((col) => (
          <ColumnResize key={col.id} columnId={col.id} currentWidth={getColumnWidth(col)}>
            <ColumnHeader column={col} />
          </ColumnResize>
        ))}
      </ColumnReorder>

      {/* AddColumnButton — last grid cell */}
      <AddColumnButton />
    </div>
  );
}
