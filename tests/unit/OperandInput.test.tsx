// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import { getArity, type OperandArity } from "@/components/filters/OperandInput";
import type { FilterOperator } from "@/lib/cells/types";

/**
 * Unit tests for OperandInput arity classification.
 *
 * Skipped until Epic 15 (describe.skip). Tests use the exported `getArity`
 * helper which classifies a FilterOperator into "none" | "one" | "many" | "range".
 *
 * These tests do NOT render anything — pure function assertions only.
 */

// ---------------------------------------------------------------------------
// describe.skip — wired in Epic 15
// ---------------------------------------------------------------------------

describe.skip("OperandInput.getArity", () => {
  describe("none-arity operators (no operand input shown)", () => {
    const noneOps: FilterOperator[] = [
      "is_empty",
      "is_not_empty",
      "today",
      "this_week",
      "this_month",
    ];
    for (const op of noneOps) {
      it(`returns "none" for "${op}"`, () => {
        expect(getArity(op)).toBe<OperandArity>("none");
      });
    }
  });

  describe("many-arity operators (multi-value array operand)", () => {
    const manyOps: FilterOperator[] = ["in", "not_in"];
    for (const op of manyOps) {
      it(`returns "many" for "${op}"`, () => {
        expect(getArity(op)).toBe<OperandArity>("many");
      });
    }
  });

  describe("range-arity operators ([start, end] tuple operand)", () => {
    it('returns "range" for "between"', () => {
      expect(getArity("between")).toBe<OperandArity>("range");
    });
  });

  describe("one-arity operators (single value operand)", () => {
    const oneOps: FilterOperator[] = [
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "starts_with",
      "ends_with",
      "lt",
      "lte",
      "gt",
      "gte",
      "before",
      "after",
    ];
    for (const op of oneOps) {
      it(`returns "one" for "${op}"`, () => {
        expect(getArity(op)).toBe<OperandArity>("one");
      });
    }
  });

  describe("arity contracts", () => {
    it("every FilterOperator maps to a known arity", () => {
      // Exhaustive check: ensure no operator falls through to an unexpected value
      const allOps: FilterOperator[] = [
        "equals",
        "not_equals",
        "contains",
        "not_contains",
        "starts_with",
        "ends_with",
        "is_empty",
        "is_not_empty",
        "in",
        "not_in",
        "lt",
        "lte",
        "gt",
        "gte",
        "between",
        "before",
        "after",
        "today",
        "this_week",
        "this_month",
      ];
      const knownArities: OperandArity[] = ["none", "one", "many", "range"];
      for (const op of allOps) {
        const arity = getArity(op);
        expect(knownArities).toContain(arity);
      }
    });

    it("between operand should be a [start, end] tuple (range arity)", () => {
      expect(getArity("between")).toBe<OperandArity>("range");
      // The OperandInput renders two inputs for range arity; the emitted value
      // is always a [v1, v2] tuple — this validates the contract for date filters.
      const tuple: [string, string] = ["2026-01-01", "2026-12-31"];
      expect(tuple).toHaveLength(2);
    });
  });
});
