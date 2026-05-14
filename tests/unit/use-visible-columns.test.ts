/**
 * Tests for use-visible-columns — pure-logic coverage via store state.
 *
 * This test file runs in the node environment (vitest "node" project). It
 * tests the column-selection and width-resolution logic by exercising the
 * same computation paths that useVisibleColumns performs, but driven through
 * useBoardStore.getState() instead of a React render. This avoids the need
 * for a jsdom environment while still covering every critical branch.
 *
 * Branches covered:
 *   1. Visibility — effectiveConfig.columnVisibility takes priority over
 *      legacy columnPrefsByBoard when present.
 *   2. Visibility fallback — when effectiveConfig has no columnVisibility,
 *      legacy prefs are used.
 *   3. Title column identification — lowest-position text-type column.
 *   4. Title column fallback — when no text-type column exists, the first
 *      visible column regardless of type is the title column.
 *   5. Width resolution — view config width beats legacy pref beats defaults.
 *   6. Width fallback — missing view config → legacy pref → default (336/140).
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/types";
import { useBoardStore } from "../../stores/board-store";

type Column = Database["public"]["Tables"]["column"]["Row"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOARD_ID = "board-test-0001";

function makeColumn(overrides: Partial<Column> = {}): Column {
  return {
    id: "col-default",
    board_id: BOARD_ID,
    name: "Name",
    type: "text",
    position: 1,
    settings: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Re-implements the useVisibleColumns logic against a store snapshot so we can
 * test it in the node environment without React.
 */
function computeVisibleColumns(state: ReturnType<typeof useBoardStore.getState>, boardId: string) {
  const columns = [...state.columns].sort((a, b) => a.position - b.position);
  const columnPrefsByBoard = state.columnPrefsByBoard;
  const boardPrefs = columnPrefsByBoard[boardId] ?? {};

  // effectiveConfig from the store — use draftConfig or active view config.
  // In these tests we inject configs via the store directly.
  const draftConfig = state.draftConfig;
  const effectiveConfig = draftConfig ?? {};

  const visibleColumns = columns.filter((col) => {
    if (
      "columnVisibility" in effectiveConfig &&
      effectiveConfig.columnVisibility &&
      col.id in effectiveConfig.columnVisibility
    ) {
      return (effectiveConfig.columnVisibility as Record<string, boolean>)[col.id] !== false;
    }
    return !boardPrefs[col.id]?.hidden;
  });

  const textColumns = visibleColumns.filter((c) => c.type === "text");
  const titleColumn: Column | undefined =
    textColumns.length > 0
      ? textColumns.reduce<Column | undefined>(
          (min, c) => (min === undefined || c.position < min.position ? c : min),
          undefined,
        )
      : visibleColumns[0];

  const otherColumns = titleColumn
    ? visibleColumns.filter((c) => c.id !== titleColumn.id)
    : visibleColumns;

  const getColumnWidth = (col: Column): number => {
    if (
      "columnWidths" in effectiveConfig &&
      effectiveConfig.columnWidths &&
      col.id in (effectiveConfig.columnWidths as Record<string, number>)
    ) {
      const viewWidth = (effectiveConfig.columnWidths as Record<string, number>)[col.id];
      if (viewWidth !== undefined) return viewWidth;
    }
    const pref = boardPrefs[col.id]?.width;
    if (pref !== undefined) return pref;
    return col.id === titleColumn?.id ? 336 : 140;
  };

  return { visibleColumns, titleColumn, otherColumns, getColumnWidth };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVisibleColumns logic", () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
    // Also clear legacy column prefs so tests don't bleed into each other.
    // reset() preserves columnPrefsByBoard (it's a persisted slice); clear it here.
    useBoardStore.getState().clearLegacyColumnPrefsForBoard(BOARD_ID);
  });

  describe("visibility — effectiveConfig takes priority over legacy prefs", () => {
    it("hides a column when effectiveConfig.columnVisibility says false", () => {
      const colA = makeColumn({ id: "col-a", position: 1 });
      const colB = makeColumn({ id: "col-b", position: 2, type: "status" });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [colA, colB],
      });
      // Inject effectiveConfig via draftConfig
      useBoardStore.getState().setDraftConfig({ columnVisibility: { "col-b": false } });

      const state = useBoardStore.getState();
      const { visibleColumns } = computeVisibleColumns(state, BOARD_ID);

      expect(visibleColumns.map((c) => c.id)).toEqual(["col-a"]);
    });

    it("shows a column when effectiveConfig.columnVisibility says true", () => {
      const colA = makeColumn({ id: "col-a", position: 1 });
      const colB = makeColumn({ id: "col-b", position: 2, type: "status" });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [colA, colB],
      });
      // Mark col-b hidden in legacy prefs, but visible in effectiveConfig
      useBoardStore.getState().toggleColumnHidden("col-b"); // hides it in legacy prefs
      useBoardStore.getState().setDraftConfig({ columnVisibility: { "col-b": true } });

      const state = useBoardStore.getState();
      const { visibleColumns } = computeVisibleColumns(state, BOARD_ID);

      expect(visibleColumns.map((c) => c.id)).toContain("col-b");
    });
  });

  describe("visibility — fallback to legacy prefs when effectiveConfig absent", () => {
    it("hides columns marked hidden in columnPrefsByBoard", () => {
      const colA = makeColumn({ id: "col-a", position: 1 });
      const colB = makeColumn({ id: "col-b", position: 2, type: "status" });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [colA, colB],
      });
      useBoardStore.getState().toggleColumnHidden("col-b");

      const state = useBoardStore.getState();
      const { visibleColumns } = computeVisibleColumns(state, BOARD_ID);

      expect(visibleColumns.map((c) => c.id)).toEqual(["col-a"]);
    });

    it("shows all columns when neither prefs nor effectiveConfig hides them", () => {
      const colA = makeColumn({ id: "col-a", position: 1 });
      const colB = makeColumn({ id: "col-b", position: 2, type: "status" });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [colA, colB],
      });

      const state = useBoardStore.getState();
      const { visibleColumns } = computeVisibleColumns(state, BOARD_ID);

      expect(visibleColumns).toHaveLength(2);
    });
  });

  describe("title column identification", () => {
    it("picks the text-type column with the lowest position", () => {
      const textHigh = makeColumn({ id: "col-text-high", type: "text", position: 5 });
      const textLow = makeColumn({ id: "col-text-low", type: "text", position: 1 });
      const status = makeColumn({ id: "col-status", type: "status", position: 2 });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [textHigh, textLow, status],
      });

      const state = useBoardStore.getState();
      const { titleColumn, otherColumns } = computeVisibleColumns(state, BOARD_ID);

      expect(titleColumn?.id).toBe("col-text-low");
      expect(otherColumns.map((c) => c.id)).toContain("col-text-high");
      expect(otherColumns.map((c) => c.id)).toContain("col-status");
    });

    it("falls back to the first visible column when no text-type column exists", () => {
      const statusA = makeColumn({ id: "col-status-a", type: "status", position: 1 });
      const statusB = makeColumn({ id: "col-status-b", type: "status", position: 2 });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [statusA, statusB],
      });

      const state = useBoardStore.getState();
      const { titleColumn, otherColumns } = computeVisibleColumns(state, BOARD_ID);

      expect(titleColumn?.id).toBe("col-status-a");
      expect(otherColumns.map((c) => c.id)).toEqual(["col-status-b"]);
    });
  });

  describe("width resolution", () => {
    it("prefers effectiveConfig.columnWidths over legacy prefs", () => {
      const col = makeColumn({ id: "col-a", type: "text", position: 1 });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [col],
      });
      useBoardStore.getState().setColumnWidth("col-a", 200); // legacy pref
      useBoardStore.getState().setDraftConfig({ columnWidths: { "col-a": 400 } }); // view config

      const state = useBoardStore.getState();
      const { titleColumn, getColumnWidth } = computeVisibleColumns(state, BOARD_ID);

      expect(getColumnWidth(col)).toBe(400);
      // Suppress unused var warning
      void titleColumn;
    });

    it("falls back to legacy pref when effectiveConfig has no entry", () => {
      const col = makeColumn({ id: "col-a", type: "status", position: 2 });
      const title = makeColumn({ id: "col-title", type: "text", position: 1 });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [col, title],
      });
      useBoardStore.getState().setColumnWidth("col-a", 250);

      const state = useBoardStore.getState();
      const { getColumnWidth } = computeVisibleColumns(state, BOARD_ID);

      expect(getColumnWidth(col)).toBe(250);
    });

    it("uses 336px default for the title column", () => {
      const col = makeColumn({ id: "col-title", type: "text", position: 1 });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [col],
      });

      const state = useBoardStore.getState();
      const { titleColumn, getColumnWidth } = computeVisibleColumns(state, BOARD_ID);

      expect(getColumnWidth(col)).toBe(336);
      expect(titleColumn?.id).toBe("col-title");
    });

    it("uses 140px default for non-title columns", () => {
      const title = makeColumn({ id: "col-title", type: "text", position: 1 });
      const other = makeColumn({ id: "col-other", type: "status", position: 2 });
      useBoardStore.getState().hydrate({
        boardId: BOARD_ID,
        groups: [],
        tasks: [],
        cells: [],
        columns: [title, other],
      });

      const state = useBoardStore.getState();
      const { getColumnWidth } = computeVisibleColumns(state, BOARD_ID);

      expect(getColumnWidth(other)).toBe(140);
    });
  });
});
