/**
 * timeline-math.ts — Pure helpers for Timeline (Gantt) rendering.
 *
 * All date math is performed in UTC (ISO 8601 date strings "YYYY-MM-DD").
 * Day-precision only. DST edge cases are accepted as v1 limitations.
 *
 * Public API:
 *   pxPerDay(scale, containerWidthPx)        → number
 *   dateToX(date, originDate, scale, cw)     → number (px from left)
 *   xToDate(x, originDate, scale, cw)        → string  (snaps to day boundary)
 *   visibleRange(scale, originDate, cw)      → { start, end } ISO strings
 */

export type Scale = "day" | "week" | "month" | "quarter" | "year";

// ---------------------------------------------------------------------------
// Internal constants — number of days represented in each viewport-width
// for each scale. These "days per container" values control zoom level.
// ---------------------------------------------------------------------------

/** Default days that one container width spans at each scale. */
const DAYS_PER_VIEW: Record<Scale, number> = {
  day: 7, // 7 days fills the viewport in Day scale
  week: 30, // ~4 weeks in Week scale
  month: 90, // ~3 months in Month scale
  quarter: 180, // ~2 quarters in Quarter scale
  year: 365, // 1 year in Year scale
};

// ---------------------------------------------------------------------------
// pxPerDay
// ---------------------------------------------------------------------------

/**
 * Returns the number of pixels one day occupies at the given scale and container width.
 *
 * @param scale            - Active scale: 'day' | 'week' | 'month' | 'quarter' | 'year'
 * @param containerWidthPx - Total canvas width in pixels (must be > 0)
 */
export function pxPerDay(scale: Scale, containerWidthPx: number): number {
  if (containerWidthPx <= 0) return 1;
  return containerWidthPx / DAYS_PER_VIEW[scale];
}

// ---------------------------------------------------------------------------
// Internal: parse "YYYY-MM-DD" as a UTC midnight timestamp
// ---------------------------------------------------------------------------

function parseUTCDate(isoDate: string): Date {
  // "YYYY-MM-DD" → split manually to force UTC (new Date(str) interprets as UTC already
  // for ISO 8601 date-only strings per the spec, but being explicit avoids edge cases).
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

/** Format a Date (UTC midnight) to "YYYY-MM-DD". */
function formatUTCDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// dateToX
// ---------------------------------------------------------------------------

/**
 * Converts an ISO date string to an X offset (pixels from the left edge of
 * the timeline canvas), relative to `originDate`.
 *
 * @param date             - The date to convert ("YYYY-MM-DD")
 * @param originDate       - The leftmost visible date ("YYYY-MM-DD")
 * @param scale            - Active scale
 * @param containerWidthPx - Total canvas width in pixels
 * @returns Pixel offset (may be negative for dates before originDate)
 */
export function dateToX(
  date: string,
  originDate: string,
  scale: Scale,
  containerWidthPx: number,
): number {
  const target = parseUTCDate(date);
  const origin = parseUTCDate(originDate);
  const diffMs = target.getTime() - origin.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays * pxPerDay(scale, containerWidthPx);
}

// ---------------------------------------------------------------------------
// xToDate
// ---------------------------------------------------------------------------

/**
 * Converts an X pixel offset (relative to the left edge of the timeline canvas)
 * to an ISO date string, snapping to the nearest day boundary.
 *
 * @param x                - Pixel offset from canvas left
 * @param originDate       - The leftmost visible date ("YYYY-MM-DD")
 * @param scale            - Active scale
 * @param containerWidthPx - Total canvas width in pixels
 * @returns "YYYY-MM-DD" snapped to the nearest whole day
 */
export function xToDate(
  x: number,
  originDate: string,
  scale: Scale,
  containerWidthPx: number,
): string {
  // Guard: if container is zero or negative, we have no usable scale — return origin.
  if (containerWidthPx <= 0) return originDate;
  const ppd = pxPerDay(scale, containerWidthPx);
  if (ppd <= 0) return originDate;
  // Round to nearest day (snap-to-day)
  const daysDelta = Math.round(x / ppd);
  const origin = parseUTCDate(originDate);
  const result = new Date(origin.getTime() + daysDelta * 24 * 60 * 60 * 1000);
  return formatUTCDate(result);
}

// ---------------------------------------------------------------------------
// visibleRange
// ---------------------------------------------------------------------------

/**
 * Returns the start and end ISO date strings for the visible range of the
 * timeline canvas at the given scale and origin.
 *
 * @param scale            - Active scale
 * @param originDate       - The leftmost visible date ("YYYY-MM-DD")
 * @param containerWidthPx - Total canvas width in pixels
 * @returns { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
 */
export function visibleRange(
  scale: Scale,
  originDate: string,
  // containerWidthPx is part of the public API contract but visibleRange
  // uses fixed day counts per scale — it is an intentional parameter for
  // future use (pixel-aware dynamic range expansion). Prefix with _ to
  // satisfy the linter while keeping the API shape.
  _containerWidthPx: number,
): { start: string; end: string } {
  const start = originDate;
  const days = DAYS_PER_VIEW[scale];
  const origin = parseUTCDate(originDate);
  const endDate = new Date(origin.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
  return { start, end: formatUTCDate(endDate) };
}

// ---------------------------------------------------------------------------
// Exported for use in header tick computation
// ---------------------------------------------------------------------------

/** Returns today's date as "YYYY-MM-DD" in UTC. */
export function todayUTC(): string {
  return formatUTCDate(new Date());
}

/**
 * Returns the day-of-week for an ISO date string (0=Sun, 6=Sat).
 * Used for weekend shading.
 */
export function dayOfWeek(isoDate: string): number {
  return parseUTCDate(isoDate).getUTCDay();
}

/**
 * Returns true if the ISO date is a Saturday (6) or Sunday (0).
 */
export function isWeekend(isoDate: string): boolean {
  const d = dayOfWeek(isoDate);
  return d === 0 || d === 6;
}

/**
 * Returns an array of ISO date strings for every day in [startDate, endDate] inclusive.
 */
export function daysInRange(startDate: string, endDate: string): string[] {
  const start = parseUTCDate(startDate);
  const end = parseUTCDate(endDate);
  const days: string[] = [];
  const current = new Date(start.getTime());
  while (current.getTime() <= end.getTime()) {
    days.push(formatUTCDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

/**
 * Add N days to an ISO date string.
 */
export function addDays(isoDate: string, n: number): string {
  const d = parseUTCDate(isoDate);
  const result = new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
  return formatUTCDate(result);
}

/**
 * Compute the default originDate for a given scale so that today is near the
 * left-third of the visible canvas. Returns "YYYY-MM-DD" in UTC.
 */
export function defaultOriginDate(scale: Scale): string {
  const days = DAYS_PER_VIEW[scale];
  // Put today at 1/3 from the left
  const offsetDays = Math.floor(days / 3);
  return addDays(todayUTC(), -offsetDays);
}
