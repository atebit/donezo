"use client";

/**
 * TimelineHeader — sticky time axis at the top of the Timeline view.
 *
 * Renders two header rows whose content depends on the active scale:
 *   day scale:     top = year-month label, bottom = day numbers
 *   week scale:    top = month labels, bottom = day numbers (Mon–Sun)
 *   month scale:   top = year label, bottom = month labels
 *   quarter scale: top = year label, bottom = quarter + month labels
 *   year scale:    top = year labels, bottom = month abbreviations
 *
 * The header scrolls horizontally in sync with the row body via the shared
 * scrollLeft value from the parent.
 *
 * Weekend columns (day/week scales) get a muted background highlight so users
 * can quickly distinguish work days from non-work days.
 *
 * Epic 12, Slice D.
 */

import { format, getMonth, getYear, parseISO } from "date-fns";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { isWeekend, pxPerDay, type Scale } from "./timeline-math";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimelineHeaderProps {
  scale: Scale;
  /** Dates for every column cell, in chronological order. */
  dates: string[];
  containerWidthPx: number;
  /** Left offset (px) — applied so the header scrolls with the body. */
  scrollLeft: number;
}

// ---------------------------------------------------------------------------
// Helpers — derive grouped header rows from flat date list
// ---------------------------------------------------------------------------

/** A header cell spanning multiple day columns. */
interface HeaderCell {
  label: string;
  spanDays: number;
  startDate: string;
}

/** Group consecutive dates by their year+month label (for month/quarter/year scales). */
function groupByMonth(dates: string[]): HeaderCell[] {
  const groups: HeaderCell[] = [];
  for (const d of dates) {
    const label = format(parseISO(d), "MMM yyyy");
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.spanDays += 1;
    } else {
      groups.push({ label, spanDays: 1, startDate: d });
    }
  }
  return groups;
}

function groupByYearMonth(dates: string[]): { top: HeaderCell[]; bottom: HeaderCell[] } {
  // Top: group by year
  const topGroups: HeaderCell[] = [];
  for (const d of dates) {
    const label = String(getYear(parseISO(d)));
    const last = topGroups[topGroups.length - 1];
    if (last && last.label === label) {
      last.spanDays += 1;
    } else {
      topGroups.push({ label, spanDays: 1, startDate: d });
    }
  }

  // Bottom: group by month
  const bottomGroups: HeaderCell[] = [];
  for (const d of dates) {
    const label = format(parseISO(d), "MMM");
    const last = bottomGroups[bottomGroups.length - 1];
    if (last && last.label === label) {
      last.spanDays += 1;
    } else {
      bottomGroups.push({ label, spanDays: 1, startDate: d });
    }
  }

  return { top: topGroups, bottom: bottomGroups };
}

// ---------------------------------------------------------------------------
// TimelineHeader
// ---------------------------------------------------------------------------

export const TimelineHeader = memo(function TimelineHeader({
  scale,
  dates,
  containerWidthPx,
  scrollLeft,
}: TimelineHeaderProps) {
  const ppd = pxPerDay(scale, containerWidthPx);

  // Total rendered width = all dates × pxPerDay.
  const totalWidth = dates.length * ppd;

  // Row height.
  const ROW_H = 28;

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  /** A single bottom-row day cell (day/week scales). */
  function DayCell({ date }: { date: string }) {
    const parsed = parseISO(date);
    const weekend = scale !== "month" && scale !== "quarter" && scale !== "year" && isWeekend(date);
    const dayNum = format(parsed, "d");
    const dayAbbr = format(parsed, "EEEEE"); // single-letter: M T W T F S S

    return (
      <div
        style={{ width: ppd, flexShrink: 0, height: ROW_H }}
        className={cn(
          "flex flex-col items-center justify-center border-r border-[color:var(--color-border)] text-[10px] leading-tight select-none",
          weekend
            ? "bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-subtle)]"
            : "bg-[color:var(--color-surface)] text-[color:var(--color-fg-muted)]",
        )}
        title={format(parsed, "EEEE, MMMM d")}
      >
        <span>{dayAbbr}</span>
        <span className="font-medium">{dayNum}</span>
      </div>
    );
  }

  /** A grouped span cell (used for month/quarter/year top & bottom rows). */
  function SpanCell({ cell }: { cell: HeaderCell }) {
    const width = cell.spanDays * ppd;
    return (
      <div
        style={{ width, flexShrink: 0, height: ROW_H }}
        className="flex items-center px-2 border-r border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[10px] font-medium text-[color:var(--color-fg-muted)] select-none overflow-hidden whitespace-nowrap"
        title={cell.label}
      >
        {cell.label}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Scale-specific layout
  // ---------------------------------------------------------------------------

  let topRow: React.ReactNode = null;
  let bottomRow: React.ReactNode = null;

  if (scale === "day") {
    // Top: group by year-month
    const topGroups = groupByMonth(dates);
    topRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {topGroups.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
    // Bottom: individual days
    bottomRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {dates.map((d) => (
          <DayCell key={d} date={d} />
        ))}
      </div>
    );
  } else if (scale === "week") {
    // Top: group by month
    const monthGroups = groupByMonth(dates);
    topRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {monthGroups.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
    // Bottom: individual days, weekends highlighted
    bottomRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {dates.map((d) => (
          <DayCell key={d} date={d} />
        ))}
      </div>
    );
  } else if (scale === "month") {
    // Top: group by year
    const yearGroups: HeaderCell[] = [];
    for (const d of dates) {
      const label = String(getYear(parseISO(d)));
      const last = yearGroups[yearGroups.length - 1];
      if (last && last.label === label) {
        last.spanDays += 1;
      } else {
        yearGroups.push({ label, spanDays: 1, startDate: d });
      }
    }
    // Bottom: group by month
    const monthGroups = groupByMonth(dates);
    topRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {yearGroups.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
    bottomRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {monthGroups.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
  } else if (scale === "quarter") {
    // Top: group by year+quarter label
    const quarterGroups: HeaderCell[] = [];
    for (const d of dates) {
      const parsed = parseISO(d);
      const month = getMonth(parsed); // 0-indexed
      const q = Math.floor(month / 3) + 1;
      const year = getYear(parsed);
      const label = `Q${q} ${year}`;
      const last = quarterGroups[quarterGroups.length - 1];
      if (last && last.label === label) {
        last.spanDays += 1;
      } else {
        quarterGroups.push({ label, spanDays: 1, startDate: d });
      }
    }
    // Bottom: group by month
    const monthGroups = groupByMonth(dates);
    topRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {quarterGroups.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
    bottomRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {monthGroups.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
  } else {
    // year scale
    const { top, bottom } = groupByYearMonth(dates);
    topRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {top.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
    bottomRow = (
      <div className="flex" style={{ width: totalWidth }}>
        {bottom.map((g) => (
          <SpanCell key={g.startDate} cell={g} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="sticky top-0 z-10 overflow-hidden border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-hidden="true"
    >
      {/* Offset the inner content by scrollLeft to stay in sync with body scroll */}
      <div style={{ transform: `translateX(-${scrollLeft}px)`, willChange: "transform" }}>
        {/* Top row */}
        <div style={{ height: ROW_H }} className="flex border-b border-[color:var(--color-border)]">
          {topRow}
        </div>
        {/* Bottom row */}
        <div style={{ height: ROW_H }} className="flex">
          {bottomRow}
        </div>
      </div>
    </div>
  );
});
