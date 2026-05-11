"use client";

/**
 * DateEditor — hand-rolled month-grid date picker for the "date" cell type.
 *
 * Renders inside a Base UI <Popover> managed by the orchestrator (S15).
 * This component is the popover CONTENT only — no <Popover.Root> here.
 *
 * Layout:
 *   - Header: Month + Year with prev/next navigation arrows
 *   - Short day-name header row (7 columns, Monday-first)
 *   - 6 × 7 = 42 day buttons (complete weeks)
 *   - Today and selected date highlighted with --color-primary background
 *
 * Contract:
 *   - NO react-day-picker (per Q12). NO Supabase. NO server actions.
 *   - Emit onChange({ iso }) + onClose() on day click.
 *   - Esc closes without commit (handled by the orchestrator's Popover).
 *
 * First day of week: Monday (ISO 8601 default).
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { DateCellValue, DateConfig } from "./def";

interface DateEditorProps {
  value: DateCellValue | null;
  config: DateConfig;
  onChange: (next: DateCellValue | null) => void;
  onClose: () => void;
}

/** Format a Date as "yyyy-MM-dd" in local time. */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Derive local today iso string once per render. */
function todayIso(): string {
  return toLocalIso(new Date());
}

/** Build the 7 short day names starting from Monday. */
function buildDayNames(): string[] {
  // Use a Monday-first week: 2024-01-01 is a Monday; map 0–6 → Mon–Sun
  const ref = new Date(2024, 0, 1); // Monday Jan 1 2024
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ref);
    d.setDate(1 + i);
    return fmt.format(d);
  });
}

const DAY_NAMES = buildDayNames();

/** Number of days in a month. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Build a 42-element grid of Date | null for a given year+month,
 * with Monday as the first column.
 */
function buildGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  // getDay() returns 0=Sun, 1=Mon … 6=Sat. Convert to Monday-first offset.
  const rawDow = firstDay.getDay(); // 0–6
  const offset = (rawDow + 6) % 7; // 0=Mon … 6=Sun

  const totalDays = daysInMonth(year, month);
  const cells: (Date | null)[] = [];

  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);

  return cells;
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2024, i, 1)),
);

/** Build week rows (6 rows × 7 days) from the flat 42-element grid. */
function toWeeks(grid: (Date | null)[]): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(grid.slice(i * 7, i * 7 + 7));
  }
  return weeks;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: DateEditorProps) {
  const initialDate = value?.iso ? new Date(`${value.iso}T00:00:00`) : new Date();

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const selectedIso = value?.iso ?? null;
  const today = todayIso();
  const grid = buildGrid(viewYear, viewMonth);
  const weeks = toWeeks(grid);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDay = (d: Date) => {
    onChange({ iso: toLocalIso(d) });
    onClose();
  };

  return (
    <div className="flex flex-col py-2 px-3" style={{ width: 256 }}>
      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={prevMonth}
          className="rounded-[var(--radius-xs)] p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <span className="text-sm font-semibold text-[color:var(--color-fg)]">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          aria-label="Next month"
          onClick={nextMonth}
          className="rounded-[var(--radius-xs)] p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Calendar table */}
      <table
        className="w-full border-collapse"
        aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
      >
        <thead>
          <tr>
            {DAY_NAMES.map((name) => (
              <th
                key={name}
                scope="col"
                className="text-center text-xs text-[color:var(--color-fg-muted)] font-medium h-7 pb-1"
                aria-label={name}
              >
                {name.slice(0, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIdx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: week rows have no stable key other than position
            <tr key={weekIdx}>
              {week.map((day, dayIdx) => {
                if (day == null) {
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: empty cell — no stable key
                    <td key={dayIdx} aria-hidden="true" className="h-7" />
                  );
                }
                const iso = toLocalIso(day);
                const isToday = iso === today;
                const isSelected = iso === selectedIso;

                let bg = "transparent";
                let textColor = "var(--color-fg)";

                if (isSelected) {
                  bg = "var(--color-primary)";
                  textColor = "var(--color-primary-foreground)";
                } else if (isToday) {
                  bg = "var(--color-primary-selected)";
                }

                return (
                  <td key={iso} className="h-7 p-0">
                    <button
                      type="button"
                      aria-label={iso}
                      aria-pressed={isSelected}
                      onClick={() => handleDay(day)}
                      style={{ backgroundColor: bg, color: textColor }}
                      className="w-full h-7 flex items-center justify-center text-sm rounded-[var(--radius-xs)] hover:opacity-80 transition-opacity duration-[var(--motion-fast)] cursor-pointer"
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Clear footer */}
      {selectedIso && (
        <div className="mt-2 border-t border-[color:var(--color-border-strong)] pt-1">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onClose();
            }}
            className="w-full text-left px-1 h-7 text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] rounded-[var(--radius-xs)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
          >
            Clear date
          </button>
        </div>
      )}
    </div>
  );
}
