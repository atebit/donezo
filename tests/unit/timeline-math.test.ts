/**
 * Unit tests for timeline-math.ts
 *
 * Tests:
 *   - pxPerDay: returns correct ratio per scale
 *   - dateToX: pixel offset relative to origin
 *   - xToDate: round-trips back to the original date (snap-to-day)
 *   - visibleRange: start/end span the expected number of days
 */

import { describe, expect, it } from "vitest";
import {
  addDays,
  dateToX,
  daysInRange,
  isWeekend,
  pxPerDay,
  type Scale,
  visibleRange,
  xToDate,
} from "@/components/board/timeline/timeline-math";

const CONTAINER = 1200; // px — representative viewport width

// ---------------------------------------------------------------------------
// pxPerDay
// ---------------------------------------------------------------------------
describe("pxPerDay", () => {
  it("day scale: 7 days fill the container", () => {
    expect(pxPerDay("day", 1400)).toBeCloseTo(200); // 1400 / 7
  });

  it("week scale: 30 days fill the container", () => {
    expect(pxPerDay("week", CONTAINER)).toBeCloseTo(40); // 1200 / 30
  });

  it("month scale: 90 days fill the container", () => {
    expect(pxPerDay("month", CONTAINER)).toBeCloseTo(1200 / 90);
  });

  it("quarter scale: 180 days fill the container", () => {
    expect(pxPerDay("quarter", CONTAINER)).toBeCloseTo(1200 / 180);
  });

  it("year scale: 365 days fill the container", () => {
    expect(pxPerDay("year", CONTAINER)).toBeCloseTo(1200 / 365);
  });

  it("returns 1 when containerWidthPx is 0", () => {
    expect(pxPerDay("week", 0)).toBe(1);
  });

  it("returns 1 for negative container width", () => {
    expect(pxPerDay("week", -100)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// dateToX
// ---------------------------------------------------------------------------
describe("dateToX", () => {
  const origin = "2025-01-01";

  it("origin date maps to x=0", () => {
    expect(dateToX(origin, origin, "week", CONTAINER)).toBe(0);
  });

  it("one day after origin → pxPerDay in week scale", () => {
    const ppd = pxPerDay("week", CONTAINER);
    expect(dateToX("2025-01-02", origin, "week", CONTAINER)).toBeCloseTo(ppd);
  });

  it("30 days after origin → full container width in week scale", () => {
    expect(dateToX("2025-01-31", origin, "week", CONTAINER)).toBeCloseTo(CONTAINER);
  });

  it("day before origin returns negative x", () => {
    const ppd = pxPerDay("week", CONTAINER);
    expect(dateToX("2024-12-31", origin, "week", CONTAINER)).toBeCloseTo(-ppd);
  });

  it("day scale: 7 days → full container width", () => {
    expect(dateToX("2025-01-08", origin, "day", 1400)).toBeCloseTo(1400);
  });

  it("month scale: 90 days → full container width", () => {
    const endDate = addDays(origin, 90);
    expect(dateToX(endDate, origin, "month", CONTAINER)).toBeCloseTo(CONTAINER);
  });

  it("year scale: 365 days → full container width", () => {
    const endDate = addDays(origin, 365);
    expect(dateToX(endDate, origin, "year", CONTAINER)).toBeCloseTo(CONTAINER);
  });
});

// ---------------------------------------------------------------------------
// xToDate — round-trip + snap tests
// ---------------------------------------------------------------------------
describe("xToDate", () => {
  const origin = "2025-06-01";

  it.each<[Scale]>([
    ["day"],
    ["week"],
    ["month"],
    ["quarter"],
    ["year"],
  ])("%s scale: round-trip dateToX → xToDate returns origin for x=0", (scale) => {
    const x = dateToX(origin, origin, scale, CONTAINER);
    expect(xToDate(x, origin, scale, CONTAINER)).toBe(origin);
  });

  it("week scale: x for 5 days after origin → '2025-06-06'", () => {
    const target = "2025-06-06";
    const x = dateToX(target, origin, "week", CONTAINER);
    expect(xToDate(x, origin, "week", CONTAINER)).toBe(target);
  });

  it("month scale: x for 15 days after origin → '2025-06-16'", () => {
    const target = "2025-06-16";
    const x = dateToX(target, origin, "month", CONTAINER);
    expect(xToDate(x, origin, "month", CONTAINER)).toBe(target);
  });

  it("snaps to nearest day (not always floor)", () => {
    // 1.6 days in px should snap to day 2
    const ppd = pxPerDay("week", CONTAINER);
    const result = xToDate(ppd * 1.6, origin, "week", CONTAINER);
    expect(result).toBe(addDays(origin, 2));
  });

  it("snaps to nearest day — 0.4 days → day 0 (origin)", () => {
    const ppd = pxPerDay("week", CONTAINER);
    const result = xToDate(ppd * 0.4, origin, "week", CONTAINER);
    expect(result).toBe(origin);
  });

  it("negative x snaps backwards", () => {
    const ppd = pxPerDay("week", CONTAINER);
    const result = xToDate(-ppd * 2.1, origin, "week", CONTAINER);
    expect(result).toBe(addDays(origin, -2));
  });

  it("returns originDate when containerWidthPx is 0", () => {
    expect(xToDate(100, origin, "week", 0)).toBe(origin);
  });
});

// ---------------------------------------------------------------------------
// visibleRange
// ---------------------------------------------------------------------------
describe("visibleRange", () => {
  const origin = "2025-03-01";

  it("day scale: range spans 7 days", () => {
    const { start, end } = visibleRange("day", origin, CONTAINER);
    expect(start).toBe(origin);
    const days = daysInRange(start, end);
    expect(days).toHaveLength(7);
  });

  it("week scale: range spans 30 days", () => {
    const { start, end } = visibleRange("week", origin, CONTAINER);
    const days = daysInRange(start, end);
    expect(days).toHaveLength(30);
  });

  it("month scale: range spans 90 days", () => {
    const { start, end } = visibleRange("month", origin, CONTAINER);
    const days = daysInRange(start, end);
    expect(days).toHaveLength(90);
  });

  it("quarter scale: range spans 180 days", () => {
    const { start, end } = visibleRange("quarter", origin, CONTAINER);
    const days = daysInRange(start, end);
    expect(days).toHaveLength(180);
  });

  it("year scale: range spans 365 days", () => {
    const { start, end } = visibleRange("year", origin, CONTAINER);
    const days = daysInRange(start, end);
    expect(days).toHaveLength(365);
  });

  it("start equals origin", () => {
    const { start } = visibleRange("week", origin, CONTAINER);
    expect(start).toBe(origin);
  });
});

// ---------------------------------------------------------------------------
// isWeekend
// ---------------------------------------------------------------------------
describe("isWeekend", () => {
  it("2025-01-04 (Saturday) is a weekend", () => {
    expect(isWeekend("2025-01-04")).toBe(true);
  });

  it("2025-01-05 (Sunday) is a weekend", () => {
    expect(isWeekend("2025-01-05")).toBe(true);
  });

  it("2025-01-06 (Monday) is not a weekend", () => {
    expect(isWeekend("2025-01-06")).toBe(false);
  });

  it("2025-01-10 (Friday) is not a weekend", () => {
    expect(isWeekend("2025-01-10")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------
describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2025-01-01", 10)).toBe("2025-01-11");
  });

  it("adds negative days (subtracts)", () => {
    expect(addDays("2025-01-15", -5)).toBe("2025-01-10");
  });

  it("crosses month boundary", () => {
    expect(addDays("2025-01-30", 3)).toBe("2025-02-02");
  });

  it("crosses year boundary", () => {
    expect(addDays("2024-12-30", 5)).toBe("2025-01-04");
  });

  it("0 days returns same date", () => {
    expect(addDays("2025-06-15", 0)).toBe("2025-06-15");
  });
});

// ---------------------------------------------------------------------------
// daysInRange
// ---------------------------------------------------------------------------
describe("daysInRange", () => {
  it("single day range has length 1", () => {
    expect(daysInRange("2025-01-01", "2025-01-01")).toHaveLength(1);
  });

  it("two-day range has length 2", () => {
    expect(daysInRange("2025-01-01", "2025-01-02")).toHaveLength(2);
  });

  it("includes both endpoints", () => {
    const days = daysInRange("2025-01-10", "2025-01-12");
    expect(days[0]).toBe("2025-01-10");
    expect(days[days.length - 1]).toBe("2025-01-12");
  });

  it("week spans 7 days", () => {
    expect(daysInRange("2025-01-01", "2025-01-07")).toHaveLength(7);
  });
});
