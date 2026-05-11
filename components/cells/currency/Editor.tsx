"use client";

/**
 * CurrencyEditor — inline input for the "currency" cell type.
 *
 * Contract (from CellTypeDef.Editor):
 *   - Emit onChange(value) on commit (Enter or blur).
 *   - Emit onClose() to signal the orchestrator to close and save.
 *   - Esc closes WITHOUT committing (local state reverts to prop value).
 *   - NO server-action calls. NO Supabase imports.
 *
 * Renders a numeric input with the currency symbol as a prefix label.
 */

import { useRef } from "react";

import type { CurrencyConfig } from "./def";

interface CurrencyEditorProps {
  value: number | null;
  config: CurrencyConfig;
  onChange: (next: number | null) => void;
  onClose: () => void;
}

/** Resolve the narrow currency symbol for display (e.g. "$", "€", "£"). */
function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

export function Editor({ value, config, onChange, onClose }: CurrencyEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const currencyCode = config.currency ?? "USD";
  const symbol = getCurrencySymbol(currencyCode);

  const commit = () => {
    const raw = inputRef.current?.value ?? "";
    if (raw === "") {
      onChange(null);
    } else {
      const parsed = Number(raw);
      onChange(Number.isFinite(parsed) ? parsed : null);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      // Revert — do not call onChange, just close.
      onClose();
    }
  };

  return (
    <div className="flex items-center min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] focus-within:outline focus-within:outline-1 focus-within:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)] overflow-hidden">
      <span className="pl-2 text-sm text-[color:var(--color-fg-muted)] select-none shrink-0">
        {symbol}
      </span>
      <input
        ref={inputRef}
        type="number"
        defaultValue={value ?? ""}
        step="0.01"
        // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
        autoFocus
        className="flex-1 h-full px-2 text-sm text-[color:var(--color-fg)] outline-none bg-transparent w-full tabular-nums"
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={`Edit ${currencyCode} value`}
      />
    </div>
  );
}
