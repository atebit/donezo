"use client";

/**
 * WeekEditor — HTML5 week input for the "week" cell type.
 *
 * Renders inside a Base UI <Popover> managed by the orchestrator (S15).
 * This component is the popover CONTENT only — no <Popover.Root> here.
 *
 * Uses <input type="week"> (HTML5 native, modern browsers support it).
 * Parses "2026-W19" format and emits { year: 2026, week: 19 }.
 *
 * Contract:
 *   - NO Supabase. NO server actions.
 *   - Emit onChange(next) + onClose() on commit (Enter or blur).
 *   - Esc closes without commit.
 */

import type { WeekCellValue } from "./def";
import { formatWeek } from "./def";

interface WeekEditorProps {
  value: WeekCellValue | null;
  config: Record<string, never>;
  onChange: (next: WeekCellValue | null) => void;
  onClose: () => void;
}

/**
 * Parse a browser week string "2026-W19" into { year, week }.
 * Returns null if the format doesn't match.
 */
function parseWeekString(s: string): WeekCellValue | null {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(s);
  if (!match?.[1] || !match[2]) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(week)) return null;
  if (week < 1 || week > 53) return null;
  return { year, week };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: WeekEditorProps) {
  const inputValue = value ? formatWeek(value) : "";

  const commit = (raw: string) => {
    const parsed = raw ? parseWeekString(raw) : null;
    onChange(parsed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(e.currentTarget.value);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    commit(e.target.value);
  };

  return (
    <div className="flex flex-col py-2 px-3" style={{ width: 200 }}>
      <label
        className="text-xs text-[color:var(--color-fg-muted)] mb-1.5 font-medium"
        htmlFor="week-editor-input"
      >
        Select week
      </label>
      <input
        id="week-editor-input"
        type="week"
        // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
        autoFocus
        defaultValue={inputValue}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] px-2 py-1.5 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] outline-none focus:border-[color:var(--color-primary)] transition-colors duration-[var(--motion-fast)] w-full"
        aria-label="Week picker"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            onClose();
          }}
          className="mt-2 text-left text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
