"use client";

/**
 * NumberEditor — inline input for the "number" cell type.
 *
 * Contract (from CellTypeDef.Editor):
 *   - Emit onChange(value) on commit (Enter or blur).
 *   - Emit onClose() to signal the orchestrator to close and save.
 *   - Esc closes WITHOUT committing (local state reverts to prop value).
 *   - NO server-action calls. NO Supabase imports.
 */

import { useRef } from "react";

import type { NumberConfig } from "./def";

interface NumberEditorProps {
  value: number | null;
  config: NumberConfig;
  onChange: (next: number | null) => void;
  onClose: () => void;
}

export function Editor({ value, config, onChange, onClose }: NumberEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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

  const step = config.decimals !== undefined && config.decimals > 0 ? 10 ** -config.decimals : 1;

  return (
    <input
      ref={inputRef}
      type="number"
      defaultValue={value ?? ""}
      min={config.min}
      max={config.max}
      step={step}
      // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
      autoFocus
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)] w-full tabular-nums"
      onBlur={commit}
      onKeyDown={handleKeyDown}
      aria-label="Edit number"
    />
  );
}
