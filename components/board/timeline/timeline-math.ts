/**
 * timeline-math.ts — pure date/pixel helpers for the Timeline (Gantt) view.
 *
 * All functions are side-effect free and depend only on date-fns. They are
 * intentionally decoupled from React so they can be unit-tested without a DOM.
 *
 * Design principles:
 *   - "origin date" is always the leftmost visible date (the date at x=0).
 *   - All dates are handled as UTC day-precision strings (ISO 8601 "yyyy-MM-dd").
 *     This sidesteps DST ambiguity: we never interpret a date as midnight local
 *     time, so hour-level DST transitions don't shift bars.
 *   - pxPerDay is the canonical unit: all other values derive from it.
 *
 * Scale to pixel-density mapping (container-width independent):
 *   day:     1 day = 120 px  → ~8 days per 960 px
 *   week:    1 day = 28 px   → ~34 days per 960 px  (~5 weeks)
 *   month:   1 day = 8 px    → ~120 days per 960 px (~4 months)
 *   quarter: 1 day = 3 px    → ~320 days per 960 px (~10 months)
 *   year:    1 day = 1 px    → ~960 days per 960 px (~2.6 years)
 *
 * Epic 12, Slice D.
 */

import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Scale = "day" | "week" | "month" | "quarter" | "year";

// ---------------------------------------------------------------------------
// pxPerDay — pixels per calendar day at the given scale.
//
// containerWidthPx is accepted for API symmetry with dateToX / xToDate, but
// the fixed-density design means this function ignores it (the container width
// controls how many days are _visible_, not how large each day is).
// ---------------------------------------------------------------------------
export function pxPerDay(scale: Scale, _containerWidthPx: number): number {
  switch (scale) {
    case "day":
      return 120;
    case "week":
      return 28;
    case "month":
      return 8;
    case "quarter":
      return 3;
    case "year":
      return 1;
  }
}

// ---------------------------------------------------------------------------
// dateToX — convert an ISO date string to a pixel offset from the origin.
//
// Both `date` and `originDate` are expected in "yyyy-MM-dd" format.
// The return value can be negative (date is before originDate).
// ---------------------------------------------------------------------------
export function dateToX(
  date: string,
  originDate: string,
  scale: Scale,
  containerWidthPx: number,
): number {
  const days = differenceInCalendarDays(parseISO(date), parseISO(originDate));
  return days * pxPerDay(scale, containerWidthPx);
}

// ---------------------------------------------------------------------------
// xToDate — convert a pixel offset to an ISO date string, snapped to day.
//
// The pixel position is divided by pxPerDay, rounded to the nearest day, then
// added to the origin date. The result is always a valid "yyyy-MM-dd" string.
// ---------------------------------------------------------------------------
export function xToDate(
  x: number,
  originDate: string,
  scale: Scale,
  containerWidthPx: number,
): string {
  const ppd = pxPerDay(scale, containerWidthPx);
  const daysDelta = Math.round(x / ppd);
  const result = addDays(parseISO(originDate), daysDelta);
  return format(startOfDay(result), "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// visibleRange — the ISO date range that fits in the container at the given
// scale. Adds a small buffer (half the visible span) on each side so bars
// near the edges are fully visible.
// ---------------------------------------------------------------------------
export function visibleRange(
  scale: Scale,
  originDate: string,
  containerWidthPx: number,
): { start: string; end: string } {
  const ppd = pxPerDay(scale, containerWidthPx);
  // Number of visible days = container width / px-per-day, floored.
  const visibleDays = Math.max(1, Math.floor(containerWidthPx / ppd));
  const bufferDays = Math.ceil(visibleDays / 2);

  const start = format(addDays(parseISO(originDate), -bufferDays), "yyyy-MM-dd");
  const end = format(addDays(parseISO(originDate), visibleDays + bufferDays), "yyyy-MM-dd");

  return { start, end };
}

// ---------------------------------------------------------------------------
// defaultOriginDate — compute a sensible origin date from the task set.
//
// Strategy:
//   1. If there are scheduled tasks, use the earliest start date, offset left
//      by one screen-width so the first task isn't clipped at x=0.
//   2. Otherwise, use today.
// ---------------------------------------------------------------------------
export function defaultOriginDate(
  scheduledStartDates: string[],
  scale: Scale,
  containerWidthPx: number,
): string {
  if (scheduledStartDates.length === 0) {
    return format(startOfDay(new Date()), "yyyy-MM-dd");
  }

  // ISO strings sort lexicographically for dates.
  const earliest = scheduledStartDates.slice().sort()[0] as string;
  const ppd = pxPerDay(scale, containerWidthPx);
  // Offset back by half the visible span so the earliest task starts ~center.
  const visibleDays = containerWidthPx > 0 ? Math.floor(containerWidthPx / ppd) : 30;
  const offsetDays = Math.ceil(visibleDays / 4);

  return format(addDays(parseISO(earliest), -offsetDays), "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// isWeekend — returns true for Saturday (day 6) and Sunday (day 0).
// ---------------------------------------------------------------------------
export function isWeekend(dateString: string): boolean {
  const day = parseISO(dateString).getDay();
  return day === 0 || day === 6;
}

// ---------------------------------------------------------------------------
// headerDates — compute the list of date strings to render in the header
// for a given scale, origin, and container width.
//
// day scale:   one entry per day
// week scale:  one entry per day (grouped visually by week; caller handles groups)
// month scale: one entry per week start (Monday)
// quarter scale: one entry per month start
// year scale:  one entry per month start
// ---------------------------------------------------------------------------
export function headerDates(scale: Scale, originDate: string, containerWidthPx: number): string[] {
  const ppd = pxPerDay(scale, containerWidthPx);
  const totalDays = Math.ceil(containerWidthPx / ppd) + 1;
  const dates: string[] = [];

  for (let i = 0; i <= totalDays; i++) {
    const d = format(addDays(parseISO(originDate), i), "yyyy-MM-dd");
    dates.push(d);
  }

  return dates;
}
