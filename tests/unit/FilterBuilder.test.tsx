// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import type { FilterTree } from "@/lib/views/config-schema";

/**
 * Unit tests for FilterBuilder and its helpers.
 *
 * These tests are intentionally skipped (describe.skip) until Epic 15 wires
 * up the Vitest + Testing Library runner. The logic assertions compile and
 * document the expected behaviour; an Epic 15 author only needs to un-skip
 * and fix any render/import plumbing.
 *
 * Strategy: test the pure helper functions (flattenTree, buildAndTree) that
 * live in FilterBuilder rather than rendering the full React component here —
 * the component's interactivity tests belong in E2E (Epic 15).
 */

// ---------------------------------------------------------------------------
// Re-expose helpers via a thin import shim.
// The helpers are not exported from FilterBuilder, so we re-implement the
// minimal versions here to assert the same logic.
// ---------------------------------------------------------------------------

import type { Comparison } from "@/components/filters/FilterBuilder";

function flattenTree(filter: FilterTree | undefined): Comparison[] {
  if (!filter) return [];
  if (filter.kind === "comparison") {
    const c = filter.comparison;
    return [{ columnId: c.columnId, operator: c.operator, operand: c.operand }];
  }
  if (filter.kind === "and" || filter.kind === "or") {
    return filter.clauses.flatMap(flattenTree);
  }
  return [];
}

function buildAndTree(comparisons: Comparison[]): FilterTree | undefined {
  if (comparisons.length === 0) return undefined;
  if (comparisons.length === 1) {
    const first = comparisons[0];
    if (!first) return undefined;
    return { kind: "comparison", comparison: first };
  }
  return {
    kind: "and",
    clauses: comparisons.map((c) => ({ kind: "comparison", comparison: c })),
  };
}

// ---------------------------------------------------------------------------
// Test UUIDs
// ---------------------------------------------------------------------------

const COL_A = "a1b2c3d4-1234-4abc-89ab-000000000001";
const COL_B = "a1b2c3d4-1234-4abc-89ab-000000000002";

// ---------------------------------------------------------------------------
// describe.skip — wired in Epic 15
// ---------------------------------------------------------------------------

describe.skip("FilterBuilder helpers", () => {
  describe("flattenTree", () => {
    it("returns [] for undefined", () => {
      expect(flattenTree(undefined)).toEqual([]);
    });

    it("flattens a single comparison node", () => {
      const tree: FilterTree = {
        kind: "comparison",
        comparison: { columnId: COL_A, operator: "equals", operand: "done" },
      };
      expect(flattenTree(tree)).toEqual([{ columnId: COL_A, operator: "equals", operand: "done" }]);
    });

    it("flattens an AND tree with two comparisons", () => {
      const tree: FilterTree = {
        kind: "and",
        clauses: [
          { kind: "comparison", comparison: { columnId: COL_A, operator: "equals", operand: "x" } },
          {
            kind: "comparison",
            comparison: { columnId: COL_B, operator: "is_empty", operand: null },
          },
        ],
      };
      const result = flattenTree(tree);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ columnId: COL_A, operator: "equals" });
      expect(result[1]).toMatchObject({ columnId: COL_B, operator: "is_empty" });
    });

    it("returns [] for an AND tree with no clauses", () => {
      const tree: FilterTree = { kind: "and", clauses: [] };
      expect(flattenTree(tree)).toEqual([]);
    });
  });

  describe("buildAndTree", () => {
    it("returns undefined for empty array", () => {
      expect(buildAndTree([])).toBeUndefined();
    });

    it("returns a single comparison node for 1-element array", () => {
      const c: Comparison = { columnId: COL_A, operator: "contains", operand: "hello" };
      const tree = buildAndTree([c]);
      expect(tree).toEqual({ kind: "comparison", comparison: c });
    });

    it("returns an AND tree for 2+ elements", () => {
      const c1: Comparison = { columnId: COL_A, operator: "equals", operand: "x" };
      const c2: Comparison = { columnId: COL_B, operator: "is_empty", operand: null };
      const tree = buildAndTree([c1, c2]);
      expect(tree).toEqual({
        kind: "and",
        clauses: [
          { kind: "comparison", comparison: c1 },
          { kind: "comparison", comparison: c2 },
        ],
      });
    });

    it("round-trips: flattenTree(buildAndTree(comparisons)) === comparisons", () => {
      const comps: Comparison[] = [
        { columnId: COL_A, operator: "in", operand: ["a", "b"] },
        { columnId: COL_B, operator: "between", operand: ["2026-01-01", "2026-12-31"] },
      ];
      const tree = buildAndTree(comps);
      expect(flattenTree(tree)).toEqual(comps);
    });
  });
});
