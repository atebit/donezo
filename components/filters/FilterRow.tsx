"use client";

/**
 * FilterRow — one row in the FilterBuilder.
 *
 * 4-column grid:
 *   1. Column dropdown (which column to filter on)
 *   2. Operator dropdown (filtered by def.filterOperators)
 *   3. OperandInput (per-cell-type operand editor)
 *   4. Delete (×) button
 *
 * Props are all controlled — parent owns the data.
 */

import { X } from "lucide-react";
import { FILTER_OPERATOR_LABELS } from "@/lib/cells/filter-operators";
import { getCellDef } from "@/lib/cells/registry";
import type { FilterOperator } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";
import type { Comparison } from "./FilterBuilder";
import { OperandInput } from "./OperandInput";

type Column = Database["public"]["Tables"]["column"]["Row"];

interface FilterRowProps {
  comparison: Comparison;
  columns: Column[];
  onChangeColumn: (columnId: string) => void;
  onChangeOperator: (op: FilterOperator) => void;
  onChangeOperand: (operand: unknown) => void;
  onDelete: () => void;
}

export function FilterRow({
  comparison,
  columns,
  onChangeColumn,
  onChangeOperator,
  onChangeOperand,
  onDelete,
}: FilterRowProps) {
  const filterableColumns = columns.filter((col) => {
    try {
      const def = getCellDef(col.type as import("@/lib/cells/types").CellTypeId);
      return def.filterOperators.length > 0;
    } catch {
      return false;
    }
  });

  const activeColumn = columns.find((c) => c.id === comparison.columnId);
  const activeDef = activeColumn
    ? (() => {
        try {
          return getCellDef(activeColumn.type as import("@/lib/cells/types").CellTypeId);
        } catch {
          return null;
        }
      })()
    : null;

  const availableOperators = activeDef?.filterOperators ?? [];

  return (
    <div className="flex items-center gap-2">
      {/* Column selector */}
      <select
        value={comparison.columnId}
        onChange={(e) => onChangeColumn(e.target.value)}
        aria-label="Filter column"
        className="rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors cursor-pointer min-w-[100px]"
      >
        {filterableColumns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={comparison.operator}
        onChange={(e) => onChangeOperator(e.target.value as FilterOperator)}
        aria-label="Filter operator"
        className="rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors cursor-pointer min-w-[100px]"
      >
        {availableOperators.map((op) => (
          <option key={op} value={op}>
            {FILTER_OPERATOR_LABELS[op]}
          </option>
        ))}
      </select>

      {/* Operand input */}
      <div className="flex-1 min-w-0">
        {activeDef ? (
          <OperandInput
            def={activeDef}
            op={comparison.operator}
            value={comparison.operand}
            onChange={onChangeOperand}
            config={activeColumn?.settings ?? {}}
          />
        ) : (
          <span className="text-sm text-[color:var(--color-fg-muted)] px-2">—</span>
        )}
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove filter"
        className="flex items-center justify-center w-6 h-6 rounded text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer shrink-0"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
