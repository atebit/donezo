"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { forwardRef, type ReactNode, useImperativeHandle, useRef } from "react";

import type { Group, Task } from "./types";

// ---------------------------------------------------------------------------
// RowEntry discriminated union — the flattened rows array that BoardTable
// computes and passes down. Each entry carries exactly the data the render
// function needs without any parent look-ups.
// ---------------------------------------------------------------------------

export type RowEntry =
  | { kind: "group-header"; group: Group }
  | { kind: "group-column-header"; group: Group }
  | { kind: "task"; task: Task; group: Group }
  | { kind: "group-footer"; group: Group } // S21 — per-group aggregation row
  | { kind: "add-task-footer"; group: Group }
  | { kind: "add-group-footer" };

// ---------------------------------------------------------------------------
// Default row heights (px) — match CSS custom properties from globals.css:
//   --size-cell-h: 36px  (task row height)
// ---------------------------------------------------------------------------

const DEFAULT_HEIGHTS: Record<RowEntry["kind"], number> = {
  "group-header": 48,
  "group-column-header": 36,
  task: 36, // matches --size-cell-h
  "group-footer": 36, // S21 — matches GroupFooter's h-9 (36px)
  "add-task-footer": 36,
  "add-group-footer": 48,
};

// ---------------------------------------------------------------------------
// Imperative handle — exposed via forwardRef so BoardTable can call
// scrollToIndex() without owning the virtualizer instance itself.
// BoardTable wraps this in TableScrollContext.Provider with a
// scrollToTaskId(taskId) helper that maps task id → row index.
// ---------------------------------------------------------------------------

export type TableVirtualizerHandle = {
  scrollToIndex: (index: number, opts?: { align?: "start" | "center" | "end" | "auto" }) => void;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TableVirtualizerProps {
  rows: RowEntry[];
  renderRow: (entry: RowEntry, index: number) => ReactNode;
  /**
   * Optional per-row height estimator. When omitted, DEFAULT_HEIGHTS are used.
   * Returning a value close to the real rendered height reduces layout jank on
   * initial paint; exact values are not required — TanStack Virtual measures
   * after render and corrects offsets automatically.
   */
  estimateRowHeight?: (entry: RowEntry, index: number) => number;
}

// ---------------------------------------------------------------------------
// Stable row key helper — avoids key collisions between kinds.
// ---------------------------------------------------------------------------

function rowKey(entry: RowEntry, index: number): string {
  switch (entry.kind) {
    case "group-header":
      return `gh:${entry.group.id}`;
    case "group-column-header":
      return `gch:${entry.group.id}`;
    case "task":
      return `t:${entry.task.id}`;
    case "group-footer": // S21 — per-group aggregation row
      return `gf:${entry.group.id}`;
    case "add-task-footer":
      return `atf:${entry.group.id}`;
    case "add-group-footer":
      return `agf:${index}`;
  }
}

// ---------------------------------------------------------------------------
// TableVirtualizer
// ---------------------------------------------------------------------------

/**
 * TableVirtualizer — TanStack Virtual–powered list for the board table.
 *
 * Renders only the rows currently in the scroll viewport plus an overscan
 * buffer (12 rows above and below). Off-screen rows are not in the DOM,
 * keeping render complexity proportional to the viewport rather than the
 * board size.
 *
 * Layout strategy
 * ---------------
 * The scroll container is a `<div>` with `overflow-auto`. Its height is
 * constrained by Flexbox: BoardTable wraps everything in a `flex flex-col
 * flex-1 min-h-0` container, which clips at the available viewport height
 * (the parent SidebarShell chain guarantees 100dvh at the root with all
 * intermediate divs set to `overflow: hidden`). This means the virtualizer's
 * scroll div fills the remaining space below the StickyHeader without adding a
 * second independent scrollbar — the main content column already uses
 * `overflow: hidden`, so the only overflow surface is this div.
 *
 * Imperative API (for S18 keyboard navigation)
 * -------------------------------------------
 * Forward a ref of type `TableVirtualizerHandle` to call `scrollToIndex`.
 * BoardTable provides `TableScrollContext` which maps `scrollToTaskId(id)` →
 * `scrollToIndex(idx, { align: "center" })`. S18 consumers call
 * `useTableScroll().scrollToTaskId(taskId)`.
 *
 * ARIA
 * ----
 * Rows are rendered as positioned `<div>` elements rather than `<tr>` /
 * `<td>` because the virtualizer requires absolute positioning inside a
 * relative container, which is incompatible with `display: table` semantics.
 * Full ARIA table role annotation (role="table", role="row", role="cell") is
 * deferred to epic 14's a11y polish pass — Biome's a11y rules require
 * focusability and the full ARIA table tree for these roles on <div> elements.
 * Data attributes (data-group-id, data-task-id) are in place for testing and
 * tooling. See S10 done report for the deferred-ARIA rationale.
 */
export const TableVirtualizer = forwardRef<TableVirtualizerHandle, TableVirtualizerProps>(
  function TableVirtualizer({ rows, renderRow, estimateRowHeight }, ref) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: (i) => {
        const entry = rows[i];
        if (!entry) return 36;
        if (estimateRowHeight) return estimateRowHeight(entry, i);
        return DEFAULT_HEIGHTS[entry.kind];
      },
      overscan: 12,
    });

    // Expose scrollToIndex so BoardTable can call it via the ref handle.
    useImperativeHandle(
      ref,
      () => ({
        scrollToIndex(index, opts) {
          virtualizer.scrollToIndex(index, opts);
        },
      }),
      // virtualizer is stable across renders — the ref only needs to update
      // when the virtualizer instance itself changes (which never happens).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [virtualizer],
    );

    const totalSize = virtualizer.getTotalSize();
    const virtualItems = virtualizer.getVirtualItems();

    return (
      /* Scroll container — overflow-auto with flex-1 min-h-0 lets this fill
         the remaining board-table column height without double-scrolling. */
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-auto">
        {/* Spacer div establishes total scroll height for the virtualizer. */}
        <div style={{ height: totalSize, position: "relative" }}>
          {virtualItems.map((vi) => {
            const entry = rows[vi.index];
            if (!entry) return null;

            return (
              <div
                key={rowKey(entry, vi.index)}
                data-index={vi.index}
                style={{
                  position: "absolute",
                  top: vi.start,
                  height: vi.size,
                  width: "100%",
                  // GPU-composited layer per row — prevents paint thrashing
                  // during scroll on large boards.
                  transform: "translateZ(0)",
                }}
              >
                {renderRow(entry, vi.index)}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
