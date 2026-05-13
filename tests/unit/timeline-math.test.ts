/**
 * timeline-math.test.ts — unit tests for timeline-math.ts.
 *
 * Tests the pure date/pixel helpers. Each scale is tested with at least 3
 * inputs. The round-trip invariant (dateToX → xToDate → same date) is verified
 * for every scale.
 *
 * Epic 12, Slice D — D.7.
 */

import { describe, expect, it } from "vitest";
import {
  dateToX,
  defaultOriginDate,
  headerDates,
  isWeekend,
  pxPerDay,
  type Scale,
  visibleRange,
  xToDate,
} from "@/components/board/timeline/timeline-math";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const CONTAINER = 960; // px — standard container width for tests
const ORIGIN = "2026-01-05"; // A Monday, to keep week math predictable

// ---------------------------------------------------------------------------
// pxPerDay
// ---------------------------------------------------------------------------

describe("pxPerDay", () => {
  it("day scale returns 120", () => {
    expect(pxPerDay("day", CONTAINER)).toBe(120);
  });
  it("week scale returns 28", () => {
    expect(pxPerDay("week", CONTAINER)).toBe(28);
  });
  it("month scale returns 8", () => {
    expect(pxPerDay("month", CONTAINER)).toBe(8);
  });
  it("quarter scale returns 3", () => {
    expect(pxPerDay("quarter", CONTAINER)).toBe(3);
  });
  it("year scale returns 1", () => {
    expect(pxPerDay("year", CONTAINER)).toBe(1);
  });
  it("is container-width independent", () => {
    expect(pxPerDay("week", 1200)).toBe(pxPerDay("week", 600));
  });
});

// ---------------------------------------------------------------------------
// dateToX
// ---------------------------------------------------------------------------

describe("dateToX", () => {
  describe("day scale", () => {
    it("origin date → x=0", () => {
      expect(dateToX(ORIGIN, ORIGIN, "day", CONTAINER)).toBe(0);
    });
    it("1 day after origin → 120 px", () => {
      expect(dateToX("2026-01-06", ORIGIN, "day", CONTAINER)).toBe(120);
    });
    it("7 days after origin → 840 px", () => {
      expect(dateToX("2026-01-12", ORIGIN, "day", CONTAINER)).toBe(840);
    });
    it("1 day before origin → -120 px (negative)", () => {
      expect(dateToX("2026-01-04", ORIGIN, "day", CONTAINER)).toBe(-120);
    });
  });

  describe("week scale", () => {
    it("origin date → x=0", () => {
      expect(dateToX(ORIGIN, ORIGIN, "week", CONTAINER)).toBe(0);
    });
    it("7 days after origin → 196 px", () => {
      expect(dateToX("2026-01-12", ORIGIN, "week", CONTAINER)).toBe(196);
    });
    it("30 days after origin → 840 px", () => {
      expect(dateToX("2026-02-04", ORIGIN, "week", CONTAINER)).toBe(840);
    });
    it("14 days before origin → -392 px", () => {
      expect(dateToX("2025-12-22", ORIGIN, "week", CONTAINER)).toBe(-392);
    });
  });

  describe("month scale", () => {
    it("origin date → x=0", () => {
      expect(dateToX(ORIGIN, ORIGIN, "month", CONTAINER)).toBe(0);
    });
    it("30 days after origin → 240 px", () => {
      expect(dateToX("2026-02-04", ORIGIN, "month", CONTAINER)).toBe(240);
    });
    it("120 days after origin → 960 px", () => {
      expect(dateToX("2026-05-05", ORIGIN, "month", CONTAINER)).toBe(960);
    });
    it("10 days before origin → -80 px", () => {
      expect(dateToX("2025-12-26", ORIGIN, "month", CONTAINER)).toBe(-80);
    });
  });

  describe("quarter scale", () => {
    it("origin date → x=0", () => {
      expect(dateToX(ORIGIN, ORIGIN, "quarter", CONTAINER)).toBe(0);
    });
    it("100 days after origin → 300 px", () => {
      expect(dateToX("2026-04-15", ORIGIN, "quarter", CONTAINER)).toBe(300);
    });
    it("320 days after origin → 960 px", () => {
      expect(dateToX("2026-11-21", ORIGIN, "quarter", CONTAINER)).toBe(960);
    });
    it("1 day after origin → 3 px", () => {
      expect(dateToX("2026-01-06", ORIGIN, "quarter", CONTAINER)).toBe(3);
    });
  });

  describe("year scale", () => {
    it("origin date → x=0", () => {
      expect(dateToX(ORIGIN, ORIGIN, "year", CONTAINER)).toBe(0);
    });
    it("365 days after origin → 365 px", () => {
      expect(dateToX("2027-01-05", ORIGIN, "year", CONTAINER)).toBe(365);
    });
    it("730 days after origin → 730 px", () => {
      expect(dateToX("2028-01-05", ORIGIN, "year", CONTAINER)).toBe(730);
    });
    it("100 days before origin → -100 px", () => {
      expect(dateToX("2025-09-27", ORIGIN, "year", CONTAINER)).toBe(-100);
    });
  });
});

// ---------------------------------------------------------------------------
// xToDate
// ---------------------------------------------------------------------------

describe("xToDate", () => {
  describe("day scale", () => {
    it("x=0 → origin date", () => {
      expect(xToDate(0, ORIGIN, "day", CONTAINER)).toBe(ORIGIN);
    });
    it("x=120 → 1 day after origin", () => {
      expect(xToDate(120, ORIGIN, "day", CONTAINER)).toBe("2026-01-06");
    });
    it("x=840 → 7 days after origin", () => {
      expect(xToDate(840, ORIGIN, "day", CONTAINER)).toBe("2026-01-12");
    });
    it("x=-120 → 1 day before origin", () => {
      expect(xToDate(-120, ORIGIN, "day", CONTAINER)).toBe("2026-01-04");
    });
  });

  describe("week scale", () => {
    it("x=0 → origin date", () => {
      expect(xToDate(0, ORIGIN, "week", CONTAINER)).toBe(ORIGIN);
    });
    it("x=196 → 7 days after origin", () => {
      expect(xToDate(196, ORIGIN, "week", CONTAINER)).toBe("2026-01-12");
    });
    it("x=840 → 30 days after origin", () => {
      expect(xToDate(840, ORIGIN, "week", CONTAINER)).toBe("2026-02-04");
    });
    it("snaps fractional x to nearest day", () => {
      // 13 px → 13/28 = 0.46 days → rounds to 0 → origin
      expect(xToDate(13, ORIGIN, "week", CONTAINER)).toBe(ORIGIN);
      // 15 px → 15/28 = 0.54 days → rounds to 1 day after origin
      expect(xToDate(15, ORIGIN, "week", CONTAINER)).toBe("2026-01-06");
    });
  });

  describe("month scale", () => {
    it("x=0 → origin date", () => {
      expect(xToDate(0, ORIGIN, "month", CONTAINER)).toBe(ORIGIN);
    });
    it("x=240 → 30 days after origin", () => {
      expect(xToDate(240, ORIGIN, "month", CONTAINER)).toBe("2026-02-04");
    });
    it("x=960 → 120 days after origin", () => {
      expect(xToDate(960, ORIGIN, "month", CONTAINER)).toBe("2026-05-05");
    });
  });

  describe("quarter scale", () => {
    it("x=0 → origin", () => {
      expect(xToDate(0, ORIGIN, "quarter", CONTAINER)).toBe(ORIGIN);
    });
    it("x=300 → 100 days after origin", () => {
      expect(xToDate(300, ORIGIN, "quarter", CONTAINER)).toBe("2026-04-15");
    });
    it("x=960 → 320 days after origin", () => {
      expect(xToDate(960, ORIGIN, "quarter", CONTAINER)).toBe("2026-11-21");
    });
  });

  describe("year scale", () => {
    it("x=0 → origin", () => {
      expect(xToDate(0, ORIGIN, "year", CONTAINER)).toBe(ORIGIN);
    });
    it("x=365 → 365 days after origin", () => {
      expect(xToDate(365, ORIGIN, "year", CONTAINER)).toBe("2027-01-05");
    });
    it("x=-100 → 100 days before origin", () => {
      expect(xToDate(-100, ORIGIN, "year", CONTAINER)).toBe("2025-09-27");
    });
  });
});

// ---------------------------------------------------------------------------
// Round-trip invariant: dateToX(xToDate(x)) === x  (at x = n * pxPerDay)
// and xToDate(dateToX(date)) === date
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  const SCALES: Scale[] = ["day", "week", "month", "quarter", "year"];

  const TEST_DATES = [ORIGIN, "2026-03-15", "2026-06-30", "2026-12-31"];

  for (const scale of SCALES) {
    describe(`scale=${scale}`, () => {
      for (const date of TEST_DATES) {
        it(`xToDate(dateToX(${date})) === ${date}`, () => {
          const x = dateToX(date, ORIGIN, scale, CONTAINER);
          const roundTripped = xToDate(x, ORIGIN, scale, CONTAINER);
          expect(roundTripped).toBe(date);
        });
      }

      it("dateToX(xToDate(n * pxPerDay)) === n * pxPerDay for n=0,7,30", () => {
        for (const n of [0, 7, 30]) {
          const ppd = pxPerDay(scale, CONTAINER);
          const x = n * ppd;
          const date = xToDate(x, ORIGIN, scale, CONTAINER);
          const backX = dateToX(date, ORIGIN, scale, CONTAINER);
          expect(backX).toBe(x);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// visibleRange
// ---------------------------------------------------------------------------

describe("visibleRange", () => {
  it("day scale: range covers more than containerWidthPx / pxPerDay days", () => {
    const { start, end } = visibleRange("day", ORIGIN, CONTAINER);
    const startX = dateToX(start, ORIGIN, "day", CONTAINER);
    const endX = dateToX(end, ORIGIN, "day", CONTAINER);
    // Range should be at least containerWidth wide.
    expect(endX - startX).toBeGreaterThanOrEqual(CONTAINER);
    // Start should be before origin (buffer).
    expect(startX).toBeLessThan(0);
  });

  it("week scale: range includes origin date", () => {
    const { start, end } = visibleRange("week", ORIGIN, CONTAINER);
    expect(start <= ORIGIN).toBe(true);
    expect(end >= ORIGIN).toBe(true);
  });

  it("month scale: start is before origin", () => {
    const { start } = visibleRange("month", ORIGIN, CONTAINER);
    expect(start < ORIGIN).toBe(true);
  });

  it("year scale: end is well after origin", () => {
    const { end } = visibleRange("year", ORIGIN, CONTAINER);
    // With 960 px and 1px/day, visible = 960 days + buffer
    const daysToEnd = dateToX(end, ORIGIN, "year", CONTAINER);
    expect(daysToEnd).toBeGreaterThan(960);
  });
});

// ---------------------------------------------------------------------------
// defaultOriginDate
// ---------------------------------------------------------------------------

describe("defaultOriginDate", () => {
  it("returns today (formatted) when no dates provided", () => {
    const result = defaultOriginDate([], "week", CONTAINER);
    // Just verify it's a valid date string in yyyy-MM-dd format.
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a date before the earliest start", () => {
    const result = defaultOriginDate(["2026-03-01", "2026-04-01", "2026-02-15"], "week", CONTAINER);
    // Should be before the earliest date (2026-02-15).
    expect(result < "2026-02-15").toBe(true);
  });

  it("result is consistent for month scale", () => {
    const result = defaultOriginDate(["2026-06-01"], "month", CONTAINER);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result <= "2026-06-01").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isWeekend
// ---------------------------------------------------------------------------

describe("isWeekend", () => {
  it("Saturday is a weekend", () => {
    expect(isWeekend("2026-01-03")).toBe(true); // Saturday
  });
  it("Sunday is a weekend", () => {
    expect(isWeekend("2026-01-04")).toBe(true); // Sunday
  });
  it("Monday is not a weekend", () => {
    expect(isWeekend("2026-01-05")).toBe(false); // Monday
  });
  it("Friday is not a weekend", () => {
    expect(isWeekend("2026-01-09")).toBe(false); // Friday
  });
  it("Wednesday is not a weekend", () => {
    expect(isWeekend("2026-01-07")).toBe(false); // Wednesday
  });
});

// ---------------------------------------------------------------------------
// headerDates
// ---------------------------------------------------------------------------

describe("headerDates", () => {
  it("day scale: returns at least ceil(container/pxPerDay)+1 dates", () => {
    const dates = headerDates("day", ORIGIN, CONTAINER);
    const expected = Math.ceil(CONTAINER / pxPerDay("day", CONTAINER)) + 1;
    expect(dates.length).toBeGreaterThanOrEqual(expected);
  });

  it("first date in array is the origin date", () => {
    const dates = headerDates("week", ORIGIN, CONTAINER);
    expect(dates[0]).toBe(ORIGIN);
  });

  it("dates are in ascending chronological order", () => {
    const dates = headerDates("month", ORIGIN, CONTAINER);
    for (let i = 1; i < dates.length; i++) {
      expect((dates[i] as string) > (dates[i - 1] as string)).toBe(true);
    }
  });

  it("week scale: returns enough dates to fill the container", () => {
    const dates = headerDates("week", ORIGIN, CONTAINER);
    const ppd = pxPerDay("week", CONTAINER);
    const visibleDays = Math.ceil(CONTAINER / ppd);
    expect(dates.length).toBeGreaterThanOrEqual(visibleDays);
  });
});
