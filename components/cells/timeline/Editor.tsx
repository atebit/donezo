"use client";

/**
 * TimelineEditor — hand-rolled dual-date picker for the "timeline" cell type.
 *
 * Renders inside a Base UI <Popover> managed by the orchestrator (S15).
 * This component is the popover CONTENT only — no <Popover.Root> here.
 *
 * Layout:
 *   - Two stacked month-grid date pickers: "Start date" + "End date"
 *   - Each has Month/Year navigation, Monday-first 6×7 day grid
 *   - "Clear" footer clears both dates
 *
 * Behaviour:
 *   - When both start and end are selected, onChange + onClose are called.
 *   - If end < start, end is set to start (ensures valid range).
 *   - "Clear" → onChange(null) + onClose().
 *   - NO react-day-picker (per Q12). NO Supabase. NO server actions.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { TimelineCellValue } from "./def";

interface TimelineEditorProps {
  value: TimelineCellValue | null;
  config: Record<string, never>;
  onChange: (next: TimelineCellValue | null) => void;
  onClose: () => void;
}

/** Format a Date as "yyyy-MM-dd" in local time. */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return toLocalIso(new Date());
}

function buildDayNames(): string[] {
  const ref = new Date(2024, 0, 1);
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ref);
    d.setDate(1 + i);
    return fmt.format(d);
  });
}

const DAY_NAMES = buildDayNames();

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function buildGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const rawDow = firstDay.getDay();
  const offset = (rawDow + 6) % 7;
  const totalDays = daysInMonth(year, month);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

function toWeeks(grid: (Date | null)[]): (Date | null)[][] {
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < 6; i++) {
    weeks.push(grid.slice(i * 7, i * 7 + 7));
  }
  return weeks;
}

// The `date_value` / `date_end_value` columns are timestamptz, so values may
// round-trip as a full ISO timestamp ("2026-05-14T00:00:00+00:00") rather than
// the documented "YYYY-MM-DD" shape. Slice to the date portion before use.
function toDateOnlyIso(iso: string): string {
  return iso.slice(0, 10);
}

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2024, i, 1)),
);

/** Single month-grid picker panel. */
function MonthPicker({
  label,
  selected,
  onSelect,
  highlightStart,
  highlightEnd,
}: {
  label: string;
  selected: string | null;
  onSelect: (iso: string) => void;
  highlightStart?: string | null;
  highlightEnd?: string | null;
}) {
  const initial = selected ? new Date(`${selected}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const grid = buildGrid(viewYear, viewMonth);
  const weeks = toWeeks(grid);
  const today = todayIso();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="flex flex-col">
      <p className="text-xs font-semibold text-[color:var(--color-fg-muted)] mb-1 px-1">{label}</p>

      {/* Month/Year header */}
      <div className="flex items-center justify-between mb-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={prevMonth}
          className="rounded-[var(--radius-xs)] p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <span className="text-xs font-semibold text-[color:var(--color-fg)]">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={nextMonth}
          className="rounded-[var(--radius-xs)] p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Calendar table */}
      <table
        className="w-full border-collapse"
        aria-label={`${MONTH_NAMES[viewMonth]} ${viewYear} — ${label}`}
      >
        <thead>
          <tr>
            {DAY_NAMES.map((name) => (
              <th
                key={name}
                scope="col"
                className="text-center text-[10px] text-[color:var(--color-fg-muted)] font-medium h-6 pb-0.5"
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
                    <td key={dayIdx} aria-hidden="true" className="h-6" />
                  );
                }
                const iso = toLocalIso(day);
                const isSelected = iso === selected;
                const isToday = iso === today;
                const inRange =
                  highlightStart && highlightEnd && iso >= highlightStart && iso <= highlightEnd;

                let bg = "transparent";
                let textColor = "var(--color-fg)";
                if (isSelected) {
                  bg = "var(--color-primary)";
                  textColor = "var(--color-primary-foreground)";
                } else if (isToday) {
                  bg = "var(--color-primary-selected)";
                } else if (inRange) {
                  bg = "var(--color-surface-active)";
                }

                return (
                  <td key={iso} className="h-6 p-0">
                    <button
                      type="button"
                      aria-label={iso}
                      aria-pressed={isSelected}
                      onClick={() => onSelect(iso)}
                      style={{ backgroundColor: bg, color: textColor }}
                      className="w-full h-6 flex items-center justify-center text-xs rounded-[var(--radius-xs)] hover:opacity-80 transition-opacity duration-[var(--motion-fast)] cursor-pointer"
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
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: TimelineEditorProps) {
  const [start, setStart] = useState<string | null>(
    value?.start ? toDateOnlyIso(value.start) : null,
  );
  const [end, setEnd] = useState<string | null>(value?.end ? toDateOnlyIso(value.end) : null);

  const handleStartSelect = (iso: string) => {
    setStart(iso);
    // If end is before new start, reset end
    if (end && end < iso) setEnd(iso);
    // If end is also set, commit immediately
    if (end && end >= iso) {
      onChange({ start: iso, end });
      onClose();
    }
  };

  const handleEndSelect = (iso: string) => {
    const effectiveEnd = start && iso < start ? start : iso;
    setEnd(effectiveEnd);
    if (start) {
      onChange({ start, end: effectiveEnd });
      onClose();
    }
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  const rangeStart = start && end && start <= end ? start : null;
  const rangeEnd = start && end && start <= end ? end : null;

  return (
    <div className="flex flex-col py-3 px-3 gap-3" style={{ width: 256 }}>
      <MonthPicker
        label="Start date"
        selected={start}
        onSelect={handleStartSelect}
        highlightStart={rangeStart}
        highlightEnd={rangeEnd}
      />

      <div className="border-t border-[color:var(--color-border-strong)]" aria-hidden="true" />

      <MonthPicker
        label="End date"
        selected={end}
        onSelect={handleEndSelect}
        highlightStart={rangeStart}
        highlightEnd={rangeEnd}
      />

      {(start || end) && (
        <div className="border-t border-[color:var(--color-border-strong)] pt-1">
          <button
            type="button"
            onClick={handleClear}
            className="w-full text-left px-1 h-7 text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] rounded-[var(--radius-xs)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
          >
            Clear dates
          </button>
        </div>
      )}
    </div>
  );
}
