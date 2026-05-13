"use client";

/**
 * Status OperandEditor — compact filter operand input for the "status" cell type.
 *
 * For `equals` and `not_equals`: renders a list of labels; selecting one emits
 * { labelId } just like the full Editor.
 *
 * For `in` (multi-select): renders a checklist so the user can pick multiple
 * label IDs; operand is string[].
 *
 * Reads labels from useBoardStore via columnId prop. When columnId is absent,
 * falls back to an empty list.
 *
 * compact: true is required by the CellTypeDef.OperandEditor contract.
 */

import type { FilterOperator } from "@/lib/cells/types";
import { useBoardStore } from "@/stores/board-store";
import type { StatusCellValue } from "./Cell";

interface StatusOperandEditorProps {
  value: unknown;
  config: Record<string, never>;
  op: FilterOperator;
  compact: true;
  onChange: (next: unknown) => void;
  onClose: () => void;
  /** Passed by FilterRow via OperandInput so we can look up label options. */
  columnId?: string;
}

export function OperandEditor({
  value,
  op,
  onChange,
  columnId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: _config,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClose: _onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compact: _compact,
}: StatusOperandEditorProps) {
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);
  const labels = columnId ? (labelsByColumn.get(columnId) ?? []) : [];

  // Multi-select (op === "in"): operand is string[]
  if (op === "in" || op === "not_in") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (id: string) => {
      const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
      onChange(next);
    };

    return (
      <div
        className="flex flex-col py-1 max-h-40 overflow-y-auto"
        style={{ minWidth: 140 }}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Select labels"
      >
        {labels.length === 0 && (
          <p className="px-2 py-1 text-xs text-[color:var(--color-fg-muted)]">No labels.</p>
        )}
        {labels.map((label) => {
          const isSelected = selected.includes(label.id);
          return (
            <button
              key={label.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => toggle(label.id)}
              className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer"
            >
              <span
                className="inline-flex w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: label.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-[color:var(--color-fg)]">{label.name}</span>
              {isSelected && (
                <svg
                  aria-hidden="true"
                  width={12}
                  height={12}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[color:var(--color-primary)] shrink-0"
                >
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Single-select (equals / not_equals): operand is a single labelId string
  const selectedId =
    (value as StatusCellValue | null)?.labelId ?? (typeof value === "string" ? value : null);

  return (
    <div
      className="flex flex-col py-1 max-h-40 overflow-y-auto"
      style={{ minWidth: 140 }}
      role="listbox"
      aria-label="Select label"
    >
      {labels.length === 0 && (
        <p className="px-2 py-1 text-xs text-[color:var(--color-fg-muted)]">No labels.</p>
      )}
      {labels.map((label) => {
        const isSelected = label.id === selectedId;
        return (
          <button
            key={label.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onChange({ labelId: label.id })}
            className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer"
            style={isSelected ? { backgroundColor: "var(--color-primary-selected)" } : undefined}
          >
            <span
              className="inline-flex w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: label.color }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-[color:var(--color-fg)]">{label.name}</span>
          </button>
        );
      })}
    </div>
  );
}
