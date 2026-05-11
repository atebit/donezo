"use client";

/**
 * EmailEditor — inline input for the "email" cell type.
 *
 * Contract:
 *   - Emit onChange(value) on commit (Enter or blur).
 *   - Emit onClose() to signal the orchestrator to close.
 *   - Esc closes WITHOUT committing.
 *   - NO server-action calls. NO Supabase imports.
 */

import { useRef } from "react";

interface EmailEditorProps {
  value: string | null;
  config: Record<string, never>;
  onChange: (next: string | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: EmailEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const next = inputRef.current?.value ?? "";
    onChange(next === "" ? null : next);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <input
      ref={inputRef}
      type="email"
      defaultValue={value ?? ""}
      // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
      autoFocus
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)] w-full"
      onBlur={commit}
      onKeyDown={handleKeyDown}
      aria-label="Edit email"
    />
  );
}
