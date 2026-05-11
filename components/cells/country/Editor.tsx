"use client";

/**
 * CountryEditor — inline <select> for the "country" cell type.
 *
 * Uses the ISO 3166-1 alpha-2 list from iso-list.ts.
 *
 * Contract:
 *   - Emit onChange(value) on change/commit (selection change or blur).
 *   - Emit onClose() to signal the orchestrator to close.
 *   - Esc closes WITHOUT committing.
 *   - NO server-action calls. NO Supabase imports.
 */

import { ISO_COUNTRIES } from "./iso-list";

interface CountryEditorProps {
  value: string | null;
  config: Record<string, never>;
  onChange: (next: string | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: CountryEditorProps) {
  const commit = (selectedCode: string) => {
    onChange(selectedCode === "" ? null : selectedCode);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    commit(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit((e.currentTarget as HTMLSelectElement).value);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <select
      // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
      autoFocus
      defaultValue={value ?? ""}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={(e) => commit(e.target.value)}
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)] w-full"
      aria-label="Select country"
    >
      <option value="">— Select country —</option>
      {ISO_COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name} ({c.code})
        </option>
      ))}
    </select>
  );
}
