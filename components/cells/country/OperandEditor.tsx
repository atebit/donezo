"use client";

/**
 * Country OperandEditor — compact filter operand input for the "country" cell type.
 *
 * For "equals": renders a searchable select / combobox with country names.
 * For "in" / "not_in": renders a multi-select checklist of countries.
 * For "is_empty": OperandInput handles "none" arity; never called.
 *
 * compact: true is required by the CellTypeDef.OperandEditor contract.
 */

import { useState } from "react";
import type { FilterOperator } from "@/lib/cells/types";
import { ISO_COUNTRIES } from "./iso-list";

interface CountryOperandEditorProps {
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
}: CountryOperandEditorProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? ISO_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase()),
      )
    : ISO_COUNTRIES;

  // "in" / "not_in": operand is string[] of ISO codes
  if (op === "in" || op === "not_in") {
    const selected = Array.isArray(value) ? (value as string[]) : [];

    const toggle = (code: string) => {
      const next = selected.includes(code)
        ? selected.filter((x) => x !== code)
        : [...selected, code];
      onChange(next);
    };

    return (
      <div className="flex flex-col py-1" style={{ minWidth: 180 }}>
        <div className="px-2 pb-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries…"
            aria-label="Search countries"
            className="w-full rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
          />
        </div>
        <div
          className="max-h-40 overflow-y-auto flex flex-col"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Select countries"
        >
          {filtered.map((c) => {
            const isSelected = selected.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(c.code)}
                className="flex items-center gap-2 px-2 py-1 text-xs text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] cursor-pointer transition-colors text-left"
                style={
                  isSelected ? { backgroundColor: "var(--color-primary-selected)" } : undefined
                }
              >
                <span className="flex-1 truncate">
                  {c.name} ({c.code})
                </span>
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
      </div>
    );
  }

  // "equals": single country select
  const currentCode = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col py-1" style={{ minWidth: 180 }}>
      <div className="px-2 pb-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          aria-label="Search countries"
          className="w-full rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
        />
      </div>
      <div
        className="max-h-40 overflow-y-auto flex flex-col"
        role="listbox"
        aria-label="Select country"
      >
        {/* Clear option */}
        <button
          type="button"
          role="option"
          aria-selected={currentCode === ""}
          onClick={() => onChange(null)}
          className="flex items-center px-2 py-1 text-xs text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] cursor-pointer transition-colors"
        >
          — Any country —
        </button>
        {filtered.map((c) => {
          const isSelected = c.code === currentCode;
          return (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onChange(c.code)}
              className="flex items-center px-2 py-1 text-xs text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] cursor-pointer transition-colors text-left"
              style={isSelected ? { backgroundColor: "var(--color-primary-selected)" } : undefined}
            >
              {c.name} ({c.code})
            </button>
          );
        })}
      </div>
    </div>
  );
}
