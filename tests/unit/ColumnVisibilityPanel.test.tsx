// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Unit tests for ColumnVisibilityPanel logic.
 *
 * Skipped until Epic 15 (describe.skip). Tests focus on:
 *   - Column ordering derivation (columnOrder override vs position sort)
 *   - Title column locking (first-by-position column is immovable)
 *   - Visibility toggle logic
 *
 * No render environment needed for these pure logic tests.
 */

// ---------------------------------------------------------------------------
// Mock column data
// ---------------------------------------------------------------------------

interface MockColumn {
  id: string;
  name: string;
  position: number;
  type: string;
}

const TITLE_COL: MockColumn = { id: "col-001", name: "Name", position: 0, type: "text" };
const STATUS_COL: MockColumn = { id: "col-002", name: "Status", position: 1, type: "status" };
const DATE_COL: MockColumn = { id: "col-003", name: "Due Date", position: 2, type: "date" };

const COLUMNS = [TITLE_COL, STATUS_COL, DATE_COL];

// ---------------------------------------------------------------------------
// Pure helpers mirroring ColumnVisibilityPanel's internal logic
// ---------------------------------------------------------------------------

function deriveOrderedColumns(columns: MockColumn[], columnOrder?: string[]): MockColumn[] {
  if (columnOrder && columnOrder.length > 0) {
    const colMap = new Map(columns.map((c) => [c.id, c]));
    const ordered = columnOrder
      .map((id) => colMap.get(id))
      .filter((c): c is MockColumn => c !== undefined);
    const orderedSet = new Set(columnOrder);
    const rest = columns.filter((c) => !orderedSet.has(c.id));
    return [...ordered, ...rest];
  }
  return [...columns].sort((a, b) => a.position - b.position);
}

function getTitleColumnId(columns: MockColumn[]): string | null {
  const sorted = [...columns].sort((a, b) => a.position - b.position);
  return sorted[0]?.id ?? null;
}

function toggleVisibility(
  columnVisibility: Record<string, boolean>,
  columnId: string,
): Record<string, boolean> {
  const current = columnVisibility[columnId] !== false; // default: visible
  return { ...columnVisibility, [columnId]: !current };
}

// ---------------------------------------------------------------------------
// describe.skip — wired in Epic 15
// ---------------------------------------------------------------------------

describe.skip("ColumnVisibilityPanel logic", () => {
  describe("deriveOrderedColumns", () => {
    it("sorts by position when no columnOrder override", () => {
      const shuffled = [DATE_COL, TITLE_COL, STATUS_COL]; // out of position order
      const ordered = deriveOrderedColumns(shuffled);
      expect(ordered.map((c) => c.id)).toEqual([TITLE_COL.id, STATUS_COL.id, DATE_COL.id]);
    });

    it("respects explicit columnOrder override", () => {
      const order = [DATE_COL.id, TITLE_COL.id, STATUS_COL.id];
      const ordered = deriveOrderedColumns(COLUMNS, order);
      expect(ordered.map((c) => c.id)).toEqual(order);
    });

    it("appends columns not in columnOrder at the end", () => {
      const partialOrder = [STATUS_COL.id]; // only specifies status
      const ordered = deriveOrderedColumns(COLUMNS, partialOrder);
      expect(ordered[0]?.id).toBe(STATUS_COL.id);
      // title and date follow (in position order)
      expect(ordered.map((c) => c.id)).toContain(TITLE_COL.id);
      expect(ordered.map((c) => c.id)).toContain(DATE_COL.id);
    });
  });

  describe("getTitleColumnId", () => {
    it("returns the id of the column with position 0", () => {
      expect(getTitleColumnId(COLUMNS)).toBe(TITLE_COL.id);
    });

    it("returns null for empty array", () => {
      expect(getTitleColumnId([])).toBeNull();
    });
  });

  describe("toggleVisibility", () => {
    it("hides a visible column", () => {
      const vis = { [TITLE_COL.id]: true };
      const next = toggleVisibility(vis, TITLE_COL.id);
      expect(next[TITLE_COL.id]).toBe(false);
    });

    it("shows a hidden column", () => {
      const vis = { [STATUS_COL.id]: false };
      const next = toggleVisibility(vis, STATUS_COL.id);
      expect(next[STATUS_COL.id]).toBe(true);
    });

    it("treats missing key as visible (hides it)", () => {
      const vis: Record<string, boolean> = {};
      const next = toggleVisibility(vis, DATE_COL.id);
      expect(next[DATE_COL.id]).toBe(false);
    });

    it("does not mutate the original visibility object", () => {
      const vis = { [TITLE_COL.id]: true };
      const visCopy = { ...vis };
      toggleVisibility(vis, TITLE_COL.id);
      expect(vis).toEqual(visCopy);
    });
  });

  describe("title column lock", () => {
    it("title column is the first-by-position column", () => {
      const titleId = getTitleColumnId(COLUMNS);
      const ordered = deriveOrderedColumns(COLUMNS);
      // Title column id matches the first column when sorted by position
      expect(ordered[0]?.id).toBe(titleId);
    });
  });
});
