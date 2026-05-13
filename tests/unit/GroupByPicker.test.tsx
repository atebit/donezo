import { describe, expect, it } from "vitest";

/**
 * Unit tests for GroupByPicker logic.
 *
 * Skipped until Epic 15 (describe.skip). Tests focus on:
 *   - Groupable type filtering (plan §C.5 allowlist)
 *   - GroupBy state transitions (native ↔ column)
 *
 * No render environment needed for these pure logic tests.
 */

// ---------------------------------------------------------------------------
// Groupable type allowlist (mirrors GroupByPicker.tsx)
// ---------------------------------------------------------------------------

const GROUPABLE_TYPES = new Set([
  "status",
  "priority",
  "person",
  "date",
  "checkbox",
  "country",
  "rating",
]);

function isGroupable(type: string): boolean {
  return GROUPABLE_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Mock column data
// ---------------------------------------------------------------------------

interface MockColumn {
  id: string;
  name: string;
  type: string;
}

const COLUMNS: MockColumn[] = [
  { id: "col-001", name: "Name", type: "text" },
  { id: "col-002", name: "Status", type: "status" },
  { id: "col-003", name: "Assignee", type: "person" },
  { id: "col-004", name: "Due Date", type: "date" },
  { id: "col-005", name: "Priority", type: "priority" },
  { id: "col-006", name: "Done?", type: "checkbox" },
  { id: "col-007", name: "Country", type: "country" },
  { id: "col-008", name: "Rating", type: "rating" },
  { id: "col-009", name: "Notes", type: "long_text" },
];

// ---------------------------------------------------------------------------
// describe.skip — wired in Epic 15
// ---------------------------------------------------------------------------

describe("GroupByPicker logic", () => {
  describe("groupable type filtering", () => {
    it("includes status, priority, person, date, checkbox, country, rating", () => {
      const groupable = COLUMNS.filter((c) => isGroupable(c.type));
      const types = new Set(groupable.map((c) => c.type));
      expect(types.has("status")).toBe(true);
      expect(types.has("priority")).toBe(true);
      expect(types.has("person")).toBe(true);
      expect(types.has("date")).toBe(true);
      expect(types.has("checkbox")).toBe(true);
      expect(types.has("country")).toBe(true);
      expect(types.has("rating")).toBe(true);
    });

    it("excludes text, long_text from groupable columns", () => {
      const groupable = COLUMNS.filter((c) => isGroupable(c.type));
      const types = new Set(groupable.map((c) => c.type));
      expect(types.has("text")).toBe(false);
      expect(types.has("long_text")).toBe(false);
    });

    it("returns exactly 7 groupable columns from test data", () => {
      const groupable = COLUMNS.filter((c) => isGroupable(c.type));
      expect(groupable).toHaveLength(7);
    });
  });

  describe("GroupBy state", () => {
    it("native GroupBy has kind=native", () => {
      const groupBy = { kind: "native" as const };
      expect(groupBy.kind).toBe("native");
    });

    it("column GroupBy has kind=column and a columnId", () => {
      const groupBy = { kind: "column" as const, columnId: "col-002" };
      expect(groupBy.kind).toBe("column");
      expect(groupBy.columnId).toBe("col-002");
    });

    it("switching to native resets to kind=native", () => {
      let groupBy: { kind: "native" } | { kind: "column"; columnId: string } = {
        kind: "column",
        columnId: "col-002",
      };
      groupBy = { kind: "native" };
      expect(groupBy.kind).toBe("native");
    });

    it("selecting a column updates columnId", () => {
      let groupBy: { kind: "native" } | { kind: "column"; columnId: string } = {
        kind: "native",
      };
      groupBy = { kind: "column", columnId: "col-003" };
      expect(groupBy.kind).toBe("column");
      if (groupBy.kind === "column") {
        expect(groupBy.columnId).toBe("col-003");
      }
    });
  });
});
