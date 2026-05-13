"use client";

/**
 * OperandInput — adapter that picks `def.OperandEditor` (when present) or falls back to
 * `def.Editor` wrapped in a compact inline popover.
 *
 * Arity awareness:
 *   - "none"  — operators that need no operand (is_empty, is_not_empty, today, this_week,
 *               this_month). Renders a dash placeholder.
 *   - "one"   — single value. Renders OperandEditor or Editor.
 *   - "many"  — multi-value array (in, not_in). Renders OperandEditor or a text input.
 *   - "range" — two-value tuple (between). Renders OperandEditor or two text inputs for [v1, v2].
 *
 * Operator → arity mapping is defined in ZERO_ARITY_OPS / MANY_ARITY_OPS / RANGE_OPS below.
 */

import { Popover } from "@base-ui/react";
import type { CellTypeDef, FilterOperator } from "@/lib/cells/types";

// ---------------------------------------------------------------------------
// Arity classification
// ---------------------------------------------------------------------------

/** Operators that take no operand value. */
const ZERO_ARITY_OPS = new Set<FilterOperator>([
  "is_empty",
  "is_not_empty",
  "today",
  "this_week",
  "this_month",
]);

/** Operators that take an array of values. */
const MANY_ARITY_OPS = new Set<FilterOperator>(["in", "not_in"]);

/** Operators that take a [start, end] tuple. */
const RANGE_OPS = new Set<FilterOperator>(["between"]);

export type OperandArity = "none" | "one" | "many" | "range";

export function getArity(op: FilterOperator): OperandArity {
  if (ZERO_ARITY_OPS.has(op)) return "none";
  if (MANY_ARITY_OPS.has(op)) return "many";
  if (RANGE_OPS.has(op)) return "range";
  return "one";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OperandInputProps {
  // biome-ignore lint/suspicious/noExplicitAny: CellTypeDef is heterogeneous by design
  def: CellTypeDef<any, any>;
  op: FilterOperator;
  // biome-ignore lint/suspicious/noExplicitAny: operand type varies by cell type and operator
  value: any;
  // biome-ignore lint/suspicious/noExplicitAny: same as above
  onChange: (next: any) => void;
  config?: unknown;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OperandInput({ def, op, value, onChange, config = {} }: OperandInputProps) {
  const arity = getArity(op);

  // Arity: none — no operand needed
  if (arity === "none") {
    return (
      <span
        className="text-sm text-[color:var(--color-fg-muted)] px-2 py-1"
        aria-hidden="true"
        title="No operand required for this operator"
      >
        —
      </span>
    );
  }

  // If the def provides an OperandEditor, use it (compact mode).
  if (def.OperandEditor) {
    return (
      <def.OperandEditor
        value={value}
        // biome-ignore lint/suspicious/noExplicitAny: config is typed per cell def at runtime
        config={config as any}
        op={op}
        compact={true}
        onChange={onChange}
        onClose={() => {}}
      />
    );
  }

  // Fallback for "range" arity: two text inputs for [v1, v2].
  if (arity === "range") {
    const tuple = Array.isArray(value) ? value : [undefined, undefined];
    const [v1, v2] = tuple;
    const handleV1 = (next: string) => onChange([next || undefined, v2]);
    const handleV2 = (next: string) => onChange([v1, next || undefined]);

    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={v1 ?? ""}
          onChange={(e) => handleV1(e.target.value)}
          placeholder="From"
          aria-label="Range start"
          className="w-24 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
        />
        <span className="text-xs text-[color:var(--color-fg-muted)]">–</span>
        <input
          type="text"
          value={v2 ?? ""}
          onChange={(e) => handleV2(e.target.value)}
          placeholder="To"
          aria-label="Range end"
          className="w-24 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
        />
      </div>
    );
  }

  // Fallback for "many" arity: comma-separated text input.
  if (arity === "many") {
    const displayValue = Array.isArray(value) ? value.join(", ") : (value ?? "");
    return (
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          const parts = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(parts.length > 0 ? parts : []);
        }}
        placeholder="value1, value2…"
        aria-label="Multiple values (comma-separated)"
        className="w-40 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
      />
    );
  }

  // Fallback for "one" arity: wrap def.Editor in a small inline popover.
  return (
    <FallbackEditorPopover def={def} op={op} value={value} onChange={onChange} config={config} />
  );
}

// ---------------------------------------------------------------------------
// FallbackEditorPopover — renders def.Editor inside a small Base UI popover
// when OperandEditor is absent and arity is "one".
// ---------------------------------------------------------------------------

interface FallbackEditorPopoverProps {
  // biome-ignore lint/suspicious/noExplicitAny: same rationale
  def: CellTypeDef<any, any>;
  op: FilterOperator;
  // biome-ignore lint/suspicious/noExplicitAny: same rationale
  value: any;
  // biome-ignore lint/suspicious/noExplicitAny: same rationale
  onChange: (next: any) => void;
  config: unknown;
}

function FallbackEditorPopover({ def, value, onChange, config }: FallbackEditorPopoverProps) {
  // Determine a compact display string for the trigger button label.
  const displayLabel = getDisplayLabel(def, value, config);

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)] transition-colors cursor-pointer min-w-[80px] max-w-[160px] truncate"
            aria-haspopup="dialog"
          >
            <span className="truncate">{displayLabel || <EmptyPlaceholder />}</span>
          </button>
        }
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} align="start">
          <Popover.Popup
            className="outline-none"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-modal)",
              zIndex: "var(--z-popover)",
            }}
          >
            {/* NOTE: compact: true is NOT passed here — def.Editor does not accept it.
                The OperandEditor contract is the one that accepts compact; the Editor
                is a fallback when OperandEditor is absent. */}
            <def.Editor
              value={value}
              // biome-ignore lint/suspicious/noExplicitAny: config is typed per cell def at runtime
              config={config as any}
              onChange={onChange}
              onClose={() => {}}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EmptyPlaceholder() {
  return <span className="text-[color:var(--color-fg-muted)]">Select…</span>;
}

/** Derive a brief display label from a value using def.toSearchString if available. */
// biome-ignore lint/suspicious/noExplicitAny: value is per-cell-type
function getDisplayLabel(def: CellTypeDef<any, any>, value: any, config: unknown): string {
  if (value == null) return "";
  try {
    // biome-ignore lint/suspicious/noExplicitAny: config is per-cell-type
    return def.toSearchString?.(value, config as any) ?? String(value);
  } catch {
    return String(value);
  }
}
