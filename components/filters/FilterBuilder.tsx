"use client";

/**
 * FilterBuilder — popover content for the Filter button in the view toolbar.
 *
 * v1 implementation: flat list of comparisons, all ANDed. The data shape
 * (FilterTree) supports OR groups when we add them in v1.5.
 *
 * Receives `filter` and `onChange` as props — this component is PURE / prop-driven.
 * It does NOT call useBoardView() directly; the ViewToolbar (Slice D) owns the
 * popover-open state and hands props down.
 *
 * Layout:
 *   - One FilterRow per comparison clause.
 *   - "+ Add filter" button at the bottom.
 *   - "Clear all" link when there are active filters.
 */

import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { getCellDef } from "@/lib/cells/registry";
import type { FilterOperator } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";
import type { FilterTree } from "@/lib/views/config-schema";

import { FilterRow } from "./FilterRow";

type Column = Database["public"]["Tables"]["column"]["Row"];

// ---------------------------------------------------------------------------
// Comparison — a single filter clause (flattened from the FilterTree).
// ---------------------------------------------------------------------------
export interface Comparison {
  columnId: string;
  operator: FilterOperator;
  operand: unknown;
}

// ---------------------------------------------------------------------------
// Helpers: flatten FilterTree → comparisons array and vice versa.
// v1: we only ever produce flat AND trees from the UI.
// ---------------------------------------------------------------------------

function flattenTree(filter: FilterTree | undefined): Comparison[] {
  if (!filter) return [];
  if (filter.kind === "comparison") {
    const c = filter.comparison;
    return [{ columnId: c.columnId, operator: c.operator, operand: c.operand }];
  }
  if (filter.kind === "and" || filter.kind === "or") {
    return filter.clauses.flatMap(flattenTree);
  }
  return [];
}

function buildAndTree(comparisons: Comparison[]): FilterTree | undefined {
  if (comparisons.length === 0) return undefined;
  if (comparisons.length === 1) {
    const first = comparisons[0];
    if (!first) return undefined;
    return { kind: "comparison", comparison: first };
  }
  return {
    kind: "and",
    clauses: comparisons.map((c) => ({ kind: "comparison", comparison: c })),
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterBuilderProps {
  /** Current filter tree from view config (may be undefined if no filters). */
  filter: FilterTree | undefined;
  /** All columns available on this board. */
  columns: Column[];
  /** Called when the filter changes. Undefined = remove all filters. */
  onChange: (next: FilterTree | undefined) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterBuilder({ filter, columns, onChange }: FilterBuilderProps) {
  const comparisons = useMemo(() => flattenTree(filter), [filter]);

  // Filterable columns — those with at least one filterOperator defined
  const filterableColumns = useMemo(
    () =>
      columns.filter((col) => {
        try {
          const def = getCellDef(col.type as import("@/lib/cells/types").CellTypeId);
          return def.filterOperators.length > 0;
        } catch {
          return false;
        }
      }),
    [columns],
  );

  const emit = useCallback(
    (next: Comparison[]) => {
      onChange(buildAndTree(next));
    },
    [onChange],
  );

  const handleAddFilter = useCallback(() => {
    const firstCol = filterableColumns[0];
    if (!firstCol) return;
    try {
      const def = getCellDef(firstCol.type as import("@/lib/cells/types").CellTypeId);
      const defaultOp: FilterOperator = def.filterOperators[0] ?? "equals";
      const newComparison: Comparison = {
        columnId: firstCol.id,
        operator: defaultOp,
        operand: undefined,
      };
      emit([...comparisons, newComparison]);
    } catch {
      // If def is not found, skip
    }
  }, [filterableColumns, comparisons, emit]);

  const handleClearAll = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const handleChangeColumn = useCallback(
    (index: number, columnId: string) => {
      const col = columns.find((c) => c.id === columnId);
      if (!col) return;
      try {
        const def = getCellDef(col.type as import("@/lib/cells/types").CellTypeId);
        const defaultOp: FilterOperator = def.filterOperators[0] ?? "equals";
        const next = comparisons.map((c, i) =>
          i === index ? { ...c, columnId, operator: defaultOp, operand: undefined } : c,
        );
        emit(next);
      } catch {
        // skip
      }
    },
    [columns, comparisons, emit],
  );

  const handleChangeOperator = useCallback(
    (index: number, op: FilterOperator) => {
      const next = comparisons.map((c, i) =>
        i === index ? { ...c, operator: op, operand: undefined } : c,
      );
      emit(next);
    },
    [comparisons, emit],
  );

  const handleChangeOperand = useCallback(
    (index: number, operand: unknown) => {
      const next = comparisons.map((c, i) => (i === index ? { ...c, operand } : c));
      emit(next);
    },
    [comparisons, emit],
  );

  const handleDelete = useCallback(
    (index: number) => {
      const next = comparisons.filter((_, i) => i !== index);
      emit(next);
    },
    [comparisons, emit],
  );

  return (
    <div
      data-testid="filter-builder"
      className="flex flex-col gap-0"
      style={{ minWidth: 420, maxWidth: 600 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-[color:var(--color-border-strong)]">
        <span className="text-sm font-semibold text-[color:var(--color-fg)]">
          Filter
          {comparisons.length > 0 && (
            <span className="ml-1 text-xs text-[color:var(--color-fg-muted)]">
              ({comparisons.length})
            </span>
          )}
        </span>
        {comparisons.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Empty state */}
      {comparisons.length === 0 && (
        <p className="px-3 py-3 text-sm text-[color:var(--color-fg-muted)]">
          No filters applied. Add one below.
        </p>
      )}

      {/* Filter rows */}
      {comparisons.length > 0 && (
        <div className="flex flex-col gap-2 px-3 py-2">
          {comparisons.map((comparison, index) => (
            <FilterRow
              // biome-ignore lint/suspicious/noArrayIndexKey: comparisons have no stable id; index is safe here
              key={index}
              comparison={comparison}
              columns={filterableColumns}
              onChangeColumn={(columnId) => handleChangeColumn(index, columnId)}
              onChangeOperator={(op) => handleChangeOperator(index, op)}
              onChangeOperand={(operand) => handleChangeOperand(index, operand)}
              onDelete={() => handleDelete(index)}
            />
          ))}
        </div>
      )}

      {/* Add filter footer */}
      <div className="px-3 py-2 border-t border-[color:var(--color-border-strong)]">
        <button
          type="button"
          onClick={handleAddFilter}
          disabled={filterableColumns.length === 0}
          className="flex items-center gap-1.5 text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} aria-hidden="true" />
          Add filter
        </button>
      </div>
    </div>
  );
}
