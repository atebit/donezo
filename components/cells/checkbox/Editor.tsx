"use client";

/**
 * CheckboxEditor — inline checkbox editor for the "checkbox" cell type.
 *
 * Contract (from CellTypeDef.Editor):
 *   - Clicking the checkbox toggles the value immediately.
 *   - Emit onChange(value) then onClose() on every click — no Enter/blur needed.
 *   - Esc closes WITHOUT committing.
 *   - NO server-action calls. NO Supabase imports.
 *
 * Optimistic + zero in-flight chrome — the orchestrator handles optimistic
 * updates and server-action dispatch; this editor just emits onChange immediately.
 */

import { Checkbox } from "@base-ui/react/checkbox";

interface CheckboxEditorProps {
  value: boolean | null;
  config: Record<string, never>;
  onChange: (next: boolean | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: CheckboxEditorProps) {
  const checked = value === true;

  const handleCheckedChange = (next: boolean) => {
    onChange(next);
    onClose();
  };

  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center justify-center border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] overflow-hidden">
      <Checkbox.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        aria-label={checked ? "Uncheck" : "Check"}
        className="flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] rounded-sm"
        autoFocus
      >
        <span
          className="w-4 h-4 rounded-[var(--radius-xs)] border flex items-center justify-center transition-colors duration-[var(--motion-fast)] hover:bg-[color:var(--color-surface-hover)]"
          style={{
            backgroundColor: checked ? "var(--color-primary)" : "transparent",
            borderColor: checked ? "var(--color-primary)" : "var(--color-border-strong)",
          }}
        >
          <Checkbox.Indicator keepMounted>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
              <path
                d="M1 4L3.5 6.5L9 1"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Checkbox.Indicator>
        </span>
      </Checkbox.Root>
    </div>
  );
}
