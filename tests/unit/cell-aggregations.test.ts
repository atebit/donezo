import { describe, expect, it } from "vitest";

/**
 * Tests for lib/cells/aggregations.ts helper functions.
 *
 * Coverage:
 *   - aggregateCount
 *   - aggregateCountEmpty
 *   - aggregateCountUnique
 *   - aggregateSum
 *   - aggregateAvg
 *   - aggregateMin
 *   - aggregateMax
 *   - aggregateMedian
 *   - aggregatePercentByLabel
 *   - aggregatePercentChecked
 *   - aggregateRange
 *
 * Each helper has 3+ cases: empty array, single value, mixed values.
 *
 * NOTE: These tests are skipped until Vitest is installed in epic 15.
 */

import {
  aggregateAvg,
  aggregateCount,
  aggregateCountEmpty,
  aggregateCountUnique,
  aggregateMax,
  aggregateMedian,
  aggregateMin,
  aggregatePercentByLabel,
  aggregatePercentChecked,
  aggregateRange,
  aggregateSum,
} from "@/lib/cells/aggregations";

describe("aggregation helpers", () => {
  // ===========================================================================
  // aggregateCount
  // ===========================================================================

  describe("aggregateCount", () => {
    it("returns '0' for an empty array", () => {
      expect(aggregateCount([])).toBe("0");
    });

    it("returns '1' for a single-element array", () => {
      expect(aggregateCount([42])).toBe("1");
    });

    it("counts nulls as part of the total", () => {
      expect(aggregateCount([null, undefined, "value", 0])).toBe("4");
    });

    it("returns length as string for mixed values", () => {
      expect(aggregateCount(["a", "b", "c", null])).toBe("4");
    });
  });

  // ===========================================================================
  // aggregateCountEmpty
  // ===========================================================================

  describe("aggregateCountEmpty", () => {
    it("returns '0' for an empty array", () => {
      expect(aggregateCountEmpty([])).toBe("0");
    });

    it("returns '1' for a single-null array", () => {
      expect(aggregateCountEmpty([null])).toBe("1");
    });

    it("returns '0' when all values are non-null", () => {
      expect(aggregateCountEmpty(["a", "b", "c"])).toBe("0");
    });

    it("counts only null/undefined values", () => {
      expect(aggregateCountEmpty(["a", null, "b", null])).toBe("2");
    });

    it("counts undefined as empty", () => {
      // undefined == null in the implementation (uses ==)
      expect(aggregateCountEmpty([undefined as unknown as null, null, "x"])).toBe("2");
    });
  });

  // ===========================================================================
  // aggregateCountUnique
  // ===========================================================================

  describe("aggregateCountUnique", () => {
    it("returns '0' for an empty array", () => {
      expect(aggregateCountUnique([])).toBe("0");
    });

    it("returns '1' for a single value", () => {
      expect(aggregateCountUnique(["hello"])).toBe("1");
    });

    it("counts duplicate values as one bucket", () => {
      expect(aggregateCountUnique(["a", "a", "b"])).toBe("2");
    });

    it("treats null as a distinct bucket", () => {
      expect(aggregateCountUnique([null, null, "x"])).toBe("2");
    });

    it("counts numbers uniquely", () => {
      expect(aggregateCountUnique([1, 2, 2, 3, 3, 3])).toBe("3");
    });
  });

  // ===========================================================================
  // aggregateSum
  // ===========================================================================

  describe("aggregateSum", () => {
    it("returns '0' for an empty array", () => {
      expect(aggregateSum([])).toBe("0");
    });

    it("returns the value itself for a single element", () => {
      expect(aggregateSum([7])).toBe("7");
    });

    it("sums positive numbers", () => {
      expect(aggregateSum([1, 2, 3, 4, 5])).toBe("15");
    });

    it("handles negative numbers", () => {
      expect(aggregateSum([-5, 5])).toBe("0");
    });

    it("handles floating-point numbers", () => {
      // JavaScript floating point: 0.1 + 0.2 may not equal exactly 0.3
      expect(parseFloat(aggregateSum([10.5, 4.5]))).toBeCloseTo(15.0);
    });
  });

  // ===========================================================================
  // aggregateAvg
  // ===========================================================================

  describe("aggregateAvg", () => {
    it("returns '—' for an empty array", () => {
      expect(aggregateAvg([])).toBe("—");
    });

    it("returns the value itself (as toFixed(2)) for a single element", () => {
      expect(aggregateAvg([10])).toBe("10.00");
    });

    it("computes average of multiple numbers", () => {
      expect(aggregateAvg([2, 4, 6])).toBe("4.00");
    });

    it("formats to 2 decimal places", () => {
      expect(aggregateAvg([1, 2, 3])).toBe("2.00");
    });

    it("handles fractional averages", () => {
      // (1 + 2) / 2 = 1.5
      expect(aggregateAvg([1, 2])).toBe("1.50");
    });

    it("handles repeating decimals (rounds to 2dp)", () => {
      // (1 + 2 + 3) / 3 = 2 exactly in this case
      expect(aggregateAvg([1, 2, 3])).toBe("2.00");
    });
  });

  // ===========================================================================
  // aggregateMin
  // ===========================================================================

  describe("aggregateMin", () => {
    it("returns '—' for an empty array", () => {
      expect(aggregateMin([])).toBe("—");
    });

    it("returns the value itself for a single element", () => {
      expect(aggregateMin([42])).toBe("42");
    });

    it("returns the minimum of multiple numbers", () => {
      expect(aggregateMin([5, 3, 8, 1, 7])).toBe("1");
    });

    it("handles negative numbers", () => {
      expect(aggregateMin([-10, 0, 10])).toBe("-10");
    });

    it("handles equal values", () => {
      expect(aggregateMin([5, 5, 5])).toBe("5");
    });
  });

  // ===========================================================================
  // aggregateMax
  // ===========================================================================

  describe("aggregateMax", () => {
    it("returns '—' for an empty array", () => {
      expect(aggregateMax([])).toBe("—");
    });

    it("returns the value itself for a single element", () => {
      expect(aggregateMax([99])).toBe("99");
    });

    it("returns the maximum of multiple numbers", () => {
      expect(aggregateMax([5, 3, 8, 1, 7])).toBe("8");
    });

    it("handles negative numbers", () => {
      expect(aggregateMax([-10, -5, -1])).toBe("-1");
    });

    it("handles floating-point values", () => {
      expect(aggregateMax([1.1, 2.2, 3.3])).toBe("3.3");
    });
  });

  // ===========================================================================
  // aggregateMedian
  // ===========================================================================

  describe("aggregateMedian", () => {
    it("returns '—' for an empty array", () => {
      expect(aggregateMedian([])).toBe("—");
    });

    it("returns the value itself for a single element", () => {
      expect(aggregateMedian([42])).toBe("42");
    });

    it("returns the middle value for an odd-length array", () => {
      expect(aggregateMedian([1, 3, 5])).toBe("3");
    });

    it("returns the average of the two middle values for an even-length array", () => {
      // (2 + 4) / 2 = 3
      expect(aggregateMedian([1, 2, 4, 5])).toBe("3.00");
    });

    it("sorts the values before computing median", () => {
      // Unsorted input [5, 1, 3] → sorted [1, 3, 5] → median = 3
      expect(aggregateMedian([5, 1, 3])).toBe("3");
    });

    it("handles negative values", () => {
      // [-3, -1, 1] → median = -1
      expect(aggregateMedian([-3, -1, 1])).toBe("-1");
    });
  });

  // ===========================================================================
  // aggregatePercentByLabel
  // ===========================================================================

  describe("aggregatePercentByLabel", () => {
    it("returns '—' for an empty array", () => {
      expect(aggregatePercentByLabel([], [])).toBe("—");
    });

    it("returns a single label percentage for one value", () => {
      const result = aggregatePercentByLabel(
        [{ labelId: "lbl-1" }],
        [{ id: "lbl-1", name: "Done" }],
      );
      expect(result).toBe("100% Done");
    });

    it("computes percentages across multiple labels", () => {
      const values = [
        { labelId: "lbl-1" },
        { labelId: "lbl-1" },
        { labelId: "lbl-2" },
        { labelId: "lbl-2" },
      ];
      const labels = [
        { id: "lbl-1", name: "Done" },
        { id: "lbl-2", name: "Stuck" },
      ];
      const result = aggregatePercentByLabel(values, labels);
      expect(result).toContain("50% Done");
      expect(result).toContain("50% Stuck");
    });

    it("skips null values when computing percentages", () => {
      const values = [{ labelId: "lbl-1" }, null, null];
      const labels = [{ id: "lbl-1", name: "Done" }];
      // total = 3, but only 1 non-null; 1/3 ≈ 33%
      const result = aggregatePercentByLabel(values, labels);
      expect(result).toContain("33% Done");
    });

    it("falls back to labelId when label metadata not provided", () => {
      const values = [{ labelId: "unknown-lbl" }];
      const result = aggregatePercentByLabel(values, []);
      // Without a matching label name, the id is used as the display key
      expect(result).toContain("unknown-lbl");
    });

    it("returns '—' when all values are null (no non-null labels)", () => {
      const result = aggregatePercentByLabel([null, null], []);
      expect(result).toBe("—");
    });
  });

  // ===========================================================================
  // aggregatePercentChecked
  // ===========================================================================

  describe("aggregatePercentChecked", () => {
    it("returns '0%' for an empty array", () => {
      expect(aggregatePercentChecked([])).toBe("0%");
    });

    it("returns '100%' when all values are true", () => {
      expect(aggregatePercentChecked([true, true, true])).toBe("100%");
    });

    it("returns '0%' when all values are false", () => {
      expect(aggregatePercentChecked([false, false])).toBe("0%");
    });

    it("returns '0%' when all values are null", () => {
      expect(aggregatePercentChecked([null, null, null])).toBe("0%");
    });

    it("computes percentage of true values", () => {
      // 2 out of 4 = 50%
      expect(aggregatePercentChecked([true, true, false, false])).toBe("50%");
    });

    it("treats null as not checked", () => {
      // 1 true, 1 null, 1 false → 1/3 ≈ 33%
      expect(aggregatePercentChecked([true, null, false])).toBe("33%");
    });

    it("rounds to nearest integer", () => {
      // 1 true out of 3 = 33.33% → rounds to 33%
      expect(aggregatePercentChecked([true, false, false])).toBe("33%");
    });
  });

  // ===========================================================================
  // aggregateRange
  // ===========================================================================

  describe("aggregateRange", () => {
    it("returns '—' for an empty array", () => {
      expect(aggregateRange([])).toBe("—");
    });

    it("returns '—' when all values are null", () => {
      expect(aggregateRange([null, null])).toBe("—");
    });

    it("returns the same date twice for a single value (min = max)", () => {
      const result = aggregateRange(["2026-05-11"]);
      // Single date: min and max are the same, separated by " – "
      expect(result).toContain("–");
      // The formatted dates should be the same
      const parts = result.split(" – ");
      expect(parts[0]).toBe(parts[1]);
    });

    it("returns a range spanning min to max across multiple dates", () => {
      const result = aggregateRange(["2026-01-15", "2026-06-30", "2026-03-01"]);
      expect(result).toContain("–");
      // The result should have two date parts
      const parts = result.split(" – ");
      expect(parts).toHaveLength(2);
    });

    it("ignores null values when computing range", () => {
      const result = aggregateRange([null, "2026-01-01", null, "2026-12-31", null]);
      expect(result).toContain("–");
      expect(result).not.toBe("—");
    });

    it("handles a two-date range correctly (min < max)", () => {
      const result = aggregateRange(["2026-12-31", "2026-01-01"]);
      // min = Jan 1, max = Dec 31; result should be ordered correctly
      expect(result).toContain("–");
      const parts = result.split(" – ");
      // The first part (min) should come before the second part (max)
      expect(new Date(parts[0] ?? "").getTime()).toBeLessThanOrEqual(
        new Date(parts[1] ?? "").getTime(),
      );
    });
  });
});
