"use client";

/**
 * CalendarDateColumnPicker — dropdown that lets the user choose which `date`
 * or `timeline` column drives the calendar view.
 *
 * Writes the chosen columnId into `view.config.calendar.dateColumnId` via
 * `useBoardView().applyDraft(...)`. The config is auto-saved by useBoardView's
 * debounced draft mechanism.
 *
 * Slice C — C.2.
 */

import { useShallow } from "zustand/react/shallow";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";

export function CalendarDateColumnPicker() {
  const { effective, applyDraft } = useBoardView();
  const columns = useBoardStore(useShallow((s) => s.columns));

  // Filter to `date` and `timeline` column types only.
  const eligibleColumns = columns.filter((c) => c.type === "date" || c.type === "timeline");

  const currentColumnId = effective.calendar?.dateColumnId ?? null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const columnId = e.target.value || null;
    applyDraft({
      calendar: {
        dateColumnId: columnId,
        viewMode: effective.calendar?.viewMode ?? "month",
      },
    });
  }

  if (eligibleColumns.length === 0) {
    return (
      <span className="text-xs text-[color:var(--color-fg-subtle)] italic">No date columns</span>
    );
  }

  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="font-medium text-[color:var(--color-fg-subtle)]">Date column:</span>
      <select
        value={currentColumnId ?? ""}
        onChange={handleChange}
        className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-xs text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        aria-label="Pick the date column that drives the calendar"
      >
        <option value="">— pick a column —</option>
        {eligibleColumns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
      </select>
    </label>
  );
}
