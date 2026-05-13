"use client";

/**
 * Date OperandEditor — compact filter operand input for the "date" cell type.
 *
 * For single-date operators (equals, before, after):
 *   Renders a compact date input (type="date") emitting { iso: "yyyy-MM-dd" }.
 *
 * For "between" (handled by OperandInput's range arity, so this editor will
 * receive op="between" — emits [isoFrom, isoTo]):
 *   Renders two date inputs side by side.
 *
 * For no-operand operators (today, this_week, this_month):
 *   OperandInput handles the "none" arity and never calls OperandEditor.
 *
 * compact: true is required by the CellTypeDef.OperandEditor contract.
 */

import type { FilterOperator } from "@/lib/cells/types";
import type { DateCellValue, DateConfig } from "./def";

interface DateOperandEditorProps {
  value: unknown;
  config: DateConfig;
  op: FilterOperator;
  compact: true;
  onChange: (next: unknown) => void;
  onClose: () => void;
}

export function OperandEditor({
  value,
  op,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: _config,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClose: _onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compact: _compact,
}: DateOperandEditorProps) {
  // "between" emits a [isoFrom, isoTo] tuple
  if (op === "between") {
    const tuple = Array.isArray(value) ? value : [undefined, undefined];
    const [v1, v2] = tuple;

    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={v1 ?? ""}
          onChange={(e) => onChange([e.target.value || undefined, v2])}
          aria-label="From date"
          className="rounded border border-[color:var(--color-border-strong)] px-1 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors cursor-pointer"
        />
        <span className="text-xs text-[color:var(--color-fg-muted)]">–</span>
        <input
          type="date"
          value={v2 ?? ""}
          onChange={(e) => onChange([v1, e.target.value || undefined])}
          aria-label="To date"
          className="rounded border border-[color:var(--color-border-strong)] px-1 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors cursor-pointer"
        />
      </div>
    );
  }

  // Single date (equals, before, after)
  const currentIso =
    (value as DateCellValue | null)?.iso ?? (typeof value === "string" ? value : "");

  return (
    <input
      type="date"
      value={currentIso}
      onChange={(e) => {
        const iso = e.target.value;
        onChange(iso ? { iso } : null);
      }}
      aria-label="Select date"
      className="rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors cursor-pointer"
    />
  );
}
