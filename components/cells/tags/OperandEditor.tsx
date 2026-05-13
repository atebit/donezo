"use client";

/**
 * Tags OperandEditor — compact filter operand input for the "tags" cell type.
 *
 * For "contains": single text input (match any tag that contains this string).
 * For "in" / "not_in": comma-separated list of tag values to match.
 * For "is_empty" / "is_not_empty": OperandInput handles "none" arity; never called.
 *
 * compact: true is required by the CellTypeDef.OperandEditor contract.
 */

import type { FilterOperator } from "@/lib/cells/types";

interface TagsOperandEditorProps {
  value: unknown;
  config: Record<string, never>;
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
}: TagsOperandEditorProps) {
  // "in" / "not_in": operand is string[] of tag values
  if (op === "in" || op === "not_in") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <input
        type="text"
        value={arr.join(", ")}
        onChange={(e) => {
          const parts = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(parts);
        }}
        placeholder="tag1, tag2…"
        aria-label="Tag values (comma-separated)"
        className="w-40 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
      />
    );
  }

  // "contains": single string input
  const str = typeof value === "string" ? value : "";
  return (
    <input
      type="text"
      value={str}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder="contains…"
      aria-label="Tag contains value"
      className="w-40 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
    />
  );
}
