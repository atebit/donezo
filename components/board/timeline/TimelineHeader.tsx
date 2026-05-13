"use client";

/**
 * TimelineHeader — sticky time axis above the timeline rows.
 *
 * Two-row structure depending on scale:
 *   day    → top: weeks, bottom: individual days
 *   week   → top: months, bottom: week starts
 *   month  → top: years, bottom: months
 *   quarter→ top: years, bottom: quarters (Q1-Q4)
 *   year   → top: decades(or nothing), bottom: years
 *
 * Layout:
 *   - Left label column (fixed width 200px, matches TimelineRow label column).
 *   - Right: absolutely-positioned day ticks spanning `canvasWidth` px.
 *
 * Today line is rendered by TimelineView (not this header), but the header
 * is sticky so it stays above the scrolled rows.
 */

import { useMemo } from "react";
import {
  addDays,
  dateToX,
  daysInRange,
  type Scale,
} from "@/components/board/timeline/timeline-math";

export const LABEL_COL_WIDTH = 200; // px — width of the task-name column

interface TimelineHeaderProps {
  originDate: string;
  scale: Scale;
  canvasWidth: number;
  containerWidth: number;
}

interface TickGroup {
  label: string;
  startDate: string;
  x: number;
  width: number;
}

function buildTopTicks(
  scale: Scale,
  days: string[],
  originDate: string,
  canvasWidth: number,
): TickGroup[] {
  if (days.length === 0) return [];
  const ppd = canvasWidth / days.length;

  if (scale === "day" || scale === "week") {
    // Group by month
    const groups: TickGroup[] = [];
    let currentMonth: string | null = null;
    let groupStart: string | null = null;
    let groupCount = 0;

    for (const day of days) {
      const month = day.slice(0, 7); // "YYYY-MM"
      if (month !== currentMonth) {
        if (currentMonth !== null && groupStart !== null) {
          const x = dateToX(groupStart, originDate, scale, canvasWidth);
          groups.push({
            label: formatMonth(groupStart),
            startDate: groupStart,
            x,
            width: groupCount * ppd,
          });
        }
        currentMonth = month;
        groupStart = day;
        groupCount = 1;
      } else {
        groupCount++;
      }
    }
    // Last group
    if (currentMonth !== null && groupStart !== null) {
      const x = dateToX(groupStart, originDate, scale, canvasWidth);
      groups.push({
        label: formatMonth(groupStart),
        startDate: groupStart,
        x,
        width: groupCount * ppd,
      });
    }
    return groups;
  }

  if (scale === "month" || scale === "quarter") {
    // Group by year
    const groups: TickGroup[] = [];
    let currentYear: string | null = null;
    let groupStart: string | null = null;
    let groupCount = 0;

    for (const day of days) {
      const year = day.slice(0, 4);
      if (year !== currentYear) {
        if (currentYear !== null && groupStart !== null) {
          const x = dateToX(groupStart, originDate, scale, canvasWidth);
          groups.push({
            label: currentYear,
            startDate: groupStart,
            x,
            width: groupCount * ppd,
          });
        }
        currentYear = year;
        groupStart = day;
        groupCount = 1;
      } else {
        groupCount++;
      }
    }
    if (currentYear !== null && groupStart !== null) {
      const x = dateToX(groupStart, originDate, scale, canvasWidth);
      groups.push({
        label: currentYear,
        startDate: groupStart,
        x,
        width: groupCount * ppd,
      });
    }
    return groups;
  }

  // year scale: group by decade
  const groups: TickGroup[] = [];
  let currentDecade: string | null = null;
  let groupStart: string | null = null;
  let groupCount = 0;

  for (const day of days) {
    const year = Number(day.slice(0, 4));
    const decade = String(Math.floor(year / 10) * 10);
    if (decade !== currentDecade) {
      if (currentDecade !== null && groupStart !== null) {
        const x = dateToX(groupStart, originDate, scale, canvasWidth);
        groups.push({
          label: `${currentDecade}s`,
          startDate: groupStart,
          x,
          width: groupCount * ppd,
        });
      }
      currentDecade = decade;
      groupStart = day;
      groupCount = 1;
    } else {
      groupCount++;
    }
  }
  if (currentDecade !== null && groupStart !== null) {
    const x = dateToX(groupStart, originDate, scale, canvasWidth);
    groups.push({
      label: `${currentDecade}s`,
      startDate: groupStart,
      x,
      width: groupCount * ppd,
    });
  }
  return groups;
}

function buildBottomTicks(
  scale: Scale,
  days: string[],
  originDate: string,
  canvasWidth: number,
): TickGroup[] {
  if (days.length === 0) return [];
  const ppd = canvasWidth / days.length;

  if (scale === "day") {
    // One tick per day
    return days.map((day) => ({
      label: formatDayShort(day),
      startDate: day,
      x: dateToX(day, originDate, scale, canvasWidth),
      width: ppd,
    }));
  }

  if (scale === "week") {
    // One tick per week (Monday-based)
    const groups: TickGroup[] = [];
    let weekStart: string | null = null;
    let weekCount = 0;

    for (const day of days) {
      const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0=Sun, 1=Mon
      if (dow === 1 || weekStart === null) {
        if (weekStart !== null) {
          const x = dateToX(weekStart, originDate, scale, canvasWidth);
          groups.push({
            label: formatWeekStart(weekStart),
            startDate: weekStart,
            x,
            width: weekCount * ppd,
          });
        }
        weekStart = day;
        weekCount = 1;
      } else {
        weekCount++;
      }
    }
    if (weekStart !== null) {
      const x = dateToX(weekStart, originDate, scale, canvasWidth);
      groups.push({
        label: formatWeekStart(weekStart),
        startDate: weekStart,
        x,
        width: weekCount * ppd,
      });
    }
    return groups;
  }

  if (scale === "month") {
    // One tick per month
    const groups: TickGroup[] = [];
    let currentMonth: string | null = null;
    let monthStart: string | null = null;
    let monthCount = 0;

    for (const day of days) {
      const month = day.slice(0, 7);
      if (month !== currentMonth) {
        if (currentMonth !== null && monthStart !== null) {
          const x = dateToX(monthStart, originDate, scale, canvasWidth);
          groups.push({
            label: formatMonthShort(monthStart),
            startDate: monthStart,
            x,
            width: monthCount * ppd,
          });
        }
        currentMonth = month;
        monthStart = day;
        monthCount = 1;
      } else {
        monthCount++;
      }
    }
    if (currentMonth !== null && monthStart !== null) {
      const x = dateToX(monthStart, originDate, scale, canvasWidth);
      groups.push({
        label: formatMonthShort(monthStart),
        startDate: monthStart,
        x,
        width: monthCount * ppd,
      });
    }
    return groups;
  }

  if (scale === "quarter") {
    // One tick per quarter
    const groups: TickGroup[] = [];
    let currentQ: string | null = null;
    let qStart: string | null = null;
    let qCount = 0;

    for (const day of days) {
      const month = Number(day.slice(5, 7));
      const q = `Q${Math.ceil(month / 3)}`;
      const yearQ = `${day.slice(0, 4)}-${q}`;
      if (yearQ !== currentQ) {
        if (currentQ !== null && qStart !== null) {
          const x = dateToX(qStart, originDate, scale, canvasWidth);
          groups.push({
            label: currentQ.split("-")[1] ?? currentQ,
            startDate: qStart,
            x,
            width: qCount * ppd,
          });
        }
        currentQ = yearQ;
        qStart = day;
        qCount = 1;
      } else {
        qCount++;
      }
    }
    if (currentQ !== null && qStart !== null) {
      const x = dateToX(qStart, originDate, scale, canvasWidth);
      groups.push({
        label: currentQ.split("-")[1] ?? currentQ,
        startDate: qStart,
        x,
        width: qCount * ppd,
      });
    }
    return groups;
  }

  // year scale: one tick per year
  const groups: TickGroup[] = [];
  let currentYear: string | null = null;
  let yearStart: string | null = null;
  let yearCount = 0;

  for (const day of days) {
    const year = day.slice(0, 4);
    if (year !== currentYear) {
      if (currentYear !== null && yearStart !== null) {
        const x = dateToX(yearStart, originDate, scale, canvasWidth);
        groups.push({
          label: currentYear,
          startDate: yearStart,
          x,
          width: yearCount * ppd,
        });
      }
      currentYear = year;
      yearStart = day;
      yearCount = 1;
    } else {
      yearCount++;
    }
  }
  if (currentYear !== null && yearStart !== null) {
    const x = dateToX(yearStart, originDate, scale, canvasWidth);
    groups.push({
      label: currentYear,
      startDate: yearStart,
      x,
      width: yearCount * ppd,
    });
  }
  return groups;
}

function formatMonth(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatMonthShort(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function formatDayShort(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = d.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });
  const dayNum = d.getUTCDate();
  return `${dow} ${dayNum}`;
}

function formatWeekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function TimelineHeader({ originDate, scale, canvasWidth }: TimelineHeaderProps) {
  const days = useMemo(() => {
    // Extend canvas by 20% to allow off-screen bars to be visible
    const extendedWidth = canvasWidth;
    if (extendedWidth <= 0) return [];
    const ppd =
      canvasWidth /
      (scale === "day"
        ? 7
        : scale === "week"
          ? 30
          : scale === "month"
            ? 90
            : scale === "quarter"
              ? 180
              : 365);
    const numDays = Math.ceil(canvasWidth / ppd) + 1;
    const endDate = addDays(originDate, numDays - 1);
    return daysInRange(originDate, endDate);
  }, [originDate, scale, canvasWidth]);

  const topTicks = useMemo(
    () => buildTopTicks(scale, days, originDate, canvasWidth),
    [scale, days, originDate, canvasWidth],
  );

  const bottomTicks = useMemo(
    () => buildBottomTicks(scale, days, originDate, canvasWidth),
    [scale, days, originDate, canvasWidth],
  );

  return (
    <div
      className="sticky top-0 z-20 flex flex-col border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-subtle)] shrink-0"
      aria-hidden="true"
    >
      {/* Top row — major ticks */}
      <div className="flex" style={{ height: 24 }}>
        {/* Label column spacer */}
        <div
          className="shrink-0 border-r border-[color:var(--color-border)]"
          style={{ width: LABEL_COL_WIDTH }}
        />
        {/* Major tick labels */}
        <div className="relative flex-1 overflow-hidden">
          <div className="relative" style={{ width: canvasWidth, height: 24 }}>
            {topTicks.map((tick) => (
              <div
                key={`${tick.startDate}-top`}
                className="absolute inset-y-0 flex items-center px-2 text-[10px] font-semibold text-[color:var(--color-fg-muted)] border-r border-[color:var(--color-border)] overflow-hidden whitespace-nowrap"
                style={{ left: tick.x, width: tick.width }}
              >
                {tick.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row — minor ticks */}
      <div className="flex" style={{ height: 28 }}>
        {/* Label column spacer */}
        <div
          className="shrink-0 border-r border-[color:var(--color-border)]"
          style={{ width: LABEL_COL_WIDTH }}
        />
        {/* Minor tick labels */}
        <div className="relative flex-1 overflow-hidden">
          <div className="relative" style={{ width: canvasWidth, height: 28 }}>
            {bottomTicks.map((tick) => (
              <div
                key={`${tick.startDate}-bot`}
                className="absolute inset-y-0 flex items-center px-1 text-[10px] text-[color:var(--color-fg-muted)] border-r border-[color:var(--color-border)] overflow-hidden whitespace-nowrap"
                style={{ left: tick.x, width: Math.max(tick.width, 1) }}
              >
                {tick.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
