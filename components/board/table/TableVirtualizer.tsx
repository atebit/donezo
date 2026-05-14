"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { forwardRef, type ReactNode, useCallback, useImperativeHandle, useRef } from "react";

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
  "group-header": 54, // 40px header (h-10) + 14px inter-group gap (paddingTop in renderRow)
  "group-column-header": 36,
  task: 36, // matches --size-cell-h
  "group-footer": 36, // S21 — matches GroupFooter's h-9 (36px)
  "add-task-footer": 36, // 36px content; inter-group gap is provided by the next group-header
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
  /**
   * Optional sticky header rendered inside the scroll container before the
   * virtual rows. Placing it here (rather than as a sibling outside) means it
   * participates in the same horizontal scroll surface as the table rows, so
   * column headers stay aligned with cells at all viewport widths.
   */
  header?: ReactNode;
  /**
   * Minimum pixel width of the inner scroll content.
   *
   * Absolutely-positioned rows (the virtual items) do not contribute to the
   * scroll container's scrollWidth on their own — the browser only measures
   * in-flow content for that. When there is no in-flow element wide enough to
   * establish horizontal scroll (e.g. after removing a sticky header), this
   * prop makes the inner container wide enough that the scroll container shows
   * a horizontal scrollbar and the absolutely-positioned rows inherit the
   * correct width via `width: 100%`.
   *
   * Computed in BoardTable as: checkbox_track + title_col_width + Σ other_col_widths.
   */
  tableMinWidth?: number;
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
 * scroll div fills the remaining space and is the ONLY overflow surface.
 *
 * The sticky column header (`header` prop) lives INSIDE this scroll div so
 * it shares the same horizontal scroll surface as the virtual rows. Without
 * this, scrolling columns horizontally on narrow viewports would desync the
 * header from the rows. The header uses `position: sticky; top: 0` relative
 * to this scroll container, so it still pins vertically when scrolling down.
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
  function TableVirtualizer({ rows, renderRow, estimateRowHeight, header, tableMinWidth }, ref) {
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

    // Track horizontal scroll position as a CSS custom property so that
    // anchored rows (group headers, add-task footers) can counteract it via
    // translateX(var(--table-scroll-x)). CSS sticky + left:0 does not work
    // inside absolutely-positioned virtualizer rows with transform:translateZ(0)
    // because the transform creates a local coordinate context that breaks the
    // sticky left threshold calculation.
    const handleScroll = useCallback(() => {
      const el = scrollRef.current;
      if (el) el.style.setProperty("--table-scroll-x", `${el.scrollLeft}px`);
    }, []);

    const totalSize = virtualizer.getTotalSize();
    const virtualItems = virtualizer.getVirtualItems();

    return (
      /* Scroll container — the single overflow surface for the board table.
         Both the sticky header and virtual rows live inside so horizontal
         scroll keeps columns aligned at all viewport widths. */
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-auto" onScroll={handleScroll}>
        {/*
         * Inner width container — min-width: max-content lets the browser
         * compute the intrinsic column width from StickyHeader's grid tracks.
         * This establishes the scroll container's scroll width so:
         *   1. Absolutely-positioned rows (which don't affect scroll width on
         *      their own) inherit the correct width via width:100% on the spacer.
         *   2. The StickyHeader (position:sticky top:0) is as wide as the full
         *      table, so it scrolls horizontally with the rows rather than being
         *      clipped at the viewport edge.
         * At viewport widths wider than the table the inner container grows to
         * fill the scroll div normally (auto block sizing wins over max-content).
         */}
        <div style={{ minWidth: tableMinWidth ?? "max-content" }}>
          {/* Sticky column header — shares horizontal scroll with rows. */}
          {header}
          {/* Spacer div establishes total scroll height for the virtualizer.
              Rows are absolutely positioned within it; vi.start values are
              0-based from the list start (the spacer's top edge). */}
          <div style={{ height: totalSize, position: "relative", overflow: "clip" }}>
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
      </div>
    );
  },
);
