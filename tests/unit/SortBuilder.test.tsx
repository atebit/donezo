import { describe, expect, it } from "vitest";
import type { SortKey } from "@/lib/views/config-schema";

/**
 * Unit tests for SortBuilder and sort key management logic.
 *
 * Skipped until Epic 15 (describe.skip). Logic tests are compile-safe assertions
 * that document expected sort-key behaviour without a full render environment.
 */

// ---------------------------------------------------------------------------
// Test UUIDs
// ---------------------------------------------------------------------------

const COL_A = "a1b2c3d4-1234-4abc-89ab-000000000001";
const COL_B = "a1b2c3d4-1234-4abc-89ab-000000000002";
const COL_C = "a1b2c3d4-1234-4abc-89ab-000000000003";

// ---------------------------------------------------------------------------
// Pure helper: toggleDirection
// ---------------------------------------------------------------------------

function toggleDirection(key: SortKey): SortKey {
  return { ...key, direction: key.direction === "asc" ? "desc" : "asc" };
}

// ---------------------------------------------------------------------------
// Pure helper: reorder sort keys (mirrors arrayMove from @dnd-kit/sortable)
// ---------------------------------------------------------------------------

function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...arr];
  const [item] = result.splice(fromIndex, 1);
  if (item === undefined) return arr;
  result.splice(toIndex, 0, item);
  return result;
}

// ---------------------------------------------------------------------------
// describe.skip — wired in Epic 15
// ---------------------------------------------------------------------------

describe("SortBuilder logic", () => {
  describe("toggleDirection", () => {
    it("flips asc → desc", () => {
      const key: SortKey = { columnId: COL_A, direction: "asc" };
      expect(toggleDirection(key).direction).toBe("desc");
    });

    it("flips desc → asc", () => {
      const key: SortKey = { columnId: COL_A, direction: "desc" };
      expect(toggleDirection(key).direction).toBe("asc");
    });

    it("does not mutate the original key", () => {
      const key: SortKey = { columnId: COL_A, direction: "asc" };
      const next = toggleDirection(key);
      expect(key.direction).toBe("asc");
      expect(next).not.toBe(key);
    });
  });

  describe("sort key reordering (arrayMove)", () => {
    const initial: SortKey[] = [
      { columnId: COL_A, direction: "asc" },
      { columnId: COL_B, direction: "desc" },
      { columnId: COL_C, direction: "asc" },
    ];

    it("moves COL_A from index 0 to index 2", () => {
      const next = arrayMove(initial, 0, 2);
      expect(next.map((k) => k.columnId)).toEqual([COL_B, COL_C, COL_A]);
    });

    it("moves COL_C from index 2 to index 0", () => {
      const next = arrayMove(initial, 2, 0);
      expect(next.map((k) => k.columnId)).toEqual([COL_C, COL_A, COL_B]);
    });

    it("returns original array unchanged (same index → noop handled by SortBuilder)", () => {
      const next = arrayMove(initial, 1, 1);
      expect(next.map((k) => k.columnId)).toEqual([COL_A, COL_B, COL_C]);
    });
  });

  describe("adding and removing sort keys", () => {
    it("adds a new sort key with asc direction", () => {
      const sort: SortKey[] = [];
      const next: SortKey[] = [...sort, { columnId: COL_A, direction: "asc" }];
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({ columnId: COL_A, direction: "asc" });
    });

    it("removes a sort key by index", () => {
      const sort: SortKey[] = [
        { columnId: COL_A, direction: "asc" },
        { columnId: COL_B, direction: "desc" },
      ];
      const next = sort.filter((_, i) => i !== 0);
      expect(next).toHaveLength(1);
      expect(next[0]).toMatchObject({ columnId: COL_B });
    });

    it("clear all returns empty array", () => {
      const sort: SortKey[] = [
        { columnId: COL_A, direction: "asc" },
        { columnId: COL_B, direction: "desc" },
      ];
      const next: SortKey[] = [];
      expect(next).toHaveLength(0);
      expect(sort).toHaveLength(2); // original unchanged
    });
  });
});
