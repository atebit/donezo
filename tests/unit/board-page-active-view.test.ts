/**
 * board-page-active-view.test.ts
 *
 * Unit tests for the active-view resolution priority (Epic 11 §F.1, Q9):
 *
 *   1. searchParams.view  — if that view id appears in the fetched views.
 *   2. lastViewId         — profile.last_view_per_board[boardId], if readable.
 *   3. Main table view    — first view with is_shared=true, name="Main table".
 *   4. First by position  — absolute fallback.
 *
 * The resolution logic lives in `resolveActiveViewId` (page.tsx).
 * Since page.tsx is an RSC, we inline a copy of the pure function here for unit
 * testing without importing the RSC module (which would pull in Next.js server
 * runtime). This mirrors the same function in page.tsx — if you change the
 * priority in page.tsx, update it here too.
 *
 * Test convention: describe.skip until Epic 15 wires the full test runner.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Inline copy of the pure resolution function from page.tsx.
// Must stay in sync with the implementation.
// ---------------------------------------------------------------------------

type ViewRow = {
  id: string;
  board_id: string;
  owner_id: string | null;
  name: string;
  kind: string;
  config: unknown;
  is_shared: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

function resolveActiveViewId(
  views: ViewRow[],
  searchParamViewId: string | undefined,
  lastViewId: string | undefined,
): string | null {
  const viewSet = new Set(views.map((v) => v.id));

  if (searchParamViewId && viewSet.has(searchParamViewId)) {
    return searchParamViewId;
  }
  if (lastViewId && viewSet.has(lastViewId)) {
    return lastViewId;
  }
  const mainTable = views.find((v) => v.is_shared && v.name === "Main table");
  if (mainTable) return mainTable.id;
  return views[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeView(overrides: Partial<ViewRow> & { id: string }): ViewRow {
  return {
    board_id: "board-1",
    owner_id: null,
    name: "My view",
    kind: "table",
    config: {},
    is_shared: false,
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const mainTable = makeView({
  id: "view-main",
  name: "Main table",
  is_shared: true,
  position: 0,
});

const personalView = makeView({
  id: "view-personal",
  owner_id: "user-1",
  name: "My view",
  is_shared: false,
  position: 1,
});

const otherView = makeView({
  id: "view-other",
  owner_id: "user-2",
  name: "Another view",
  is_shared: false,
  position: 2,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveActiveViewId — active-view resolution priority", () => {
  describe("Priority 1: searchParams.view", () => {
    it("returns the URL view id when it exists in the views list", () => {
      const result = resolveActiveViewId(
        [mainTable, personalView, otherView],
        personalView.id,
        undefined,
      );
      expect(result).toBe(personalView.id);
    });

    it("returns the URL view id even when a lastViewId is present", () => {
      const result = resolveActiveViewId(
        [mainTable, personalView, otherView],
        otherView.id,
        personalView.id,
      );
      expect(result).toBe(otherView.id);
    });

    it("falls through to priority 2 when URL view id is not in the list", () => {
      const result = resolveActiveViewId(
        [mainTable, personalView],
        "non-existent-view-id",
        personalView.id,
      );
      expect(result).toBe(personalView.id);
    });

    it("falls through when URL view id is undefined", () => {
      const result = resolveActiveViewId([mainTable, personalView], undefined, personalView.id);
      expect(result).toBe(personalView.id);
    });
  });

  describe("Priority 2: profile.last_view_per_board[boardId]", () => {
    it("returns lastViewId when it exists in the views list and no URL view id", () => {
      const result = resolveActiveViewId(
        [mainTable, personalView, otherView],
        undefined,
        personalView.id,
      );
      expect(result).toBe(personalView.id);
    });

    it("falls through to priority 3 when lastViewId is not in the list", () => {
      const result = resolveActiveViewId(
        [mainTable, personalView],
        undefined,
        "stale-view-id-deleted",
      );
      expect(result).toBe(mainTable.id);
    });

    it("falls through to priority 3 when lastViewId is undefined", () => {
      const result = resolveActiveViewId([mainTable, personalView], undefined, undefined);
      expect(result).toBe(mainTable.id);
    });
  });

  describe("Priority 3: Main table (is_shared=true, name='Main table')", () => {
    it("returns the Main table view when no URL or last-view matches", () => {
      const result = resolveActiveViewId(
        [personalView, mainTable, otherView],
        undefined,
        undefined,
      );
      expect(result).toBe(mainTable.id);
    });

    it("finds Main table even when it is not first by position", () => {
      const laterMain = makeView({
        id: "view-main-late",
        name: "Main table",
        is_shared: true,
        position: 5,
      });
      const result = resolveActiveViewId(
        [personalView, otherView, laterMain],
        undefined,
        undefined,
      );
      expect(result).toBe(laterMain.id);
    });

    it("falls through to priority 4 when no Main table view exists", () => {
      const result = resolveActiveViewId([personalView, otherView], undefined, undefined);
      // First view by position order (personalView.position=1, otherView.position=2)
      // — the array order is used as-is (server already sorts by position).
      expect(result).toBe(personalView.id);
    });
  });

  describe("Priority 4: first view by position (absolute fallback)", () => {
    it("returns the first view in the array when no other priority matches", () => {
      const result = resolveActiveViewId([otherView, personalView], undefined, undefined);
      expect(result).toBe(otherView.id);
    });

    it("returns null when the views list is empty", () => {
      const result = resolveActiveViewId([], undefined, undefined);
      expect(result).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("handles a single view of any kind", () => {
      const onlyView = makeView({ id: "only-view", is_shared: false, name: "Solo view" });
      const result = resolveActiveViewId([onlyView], undefined, undefined);
      expect(result).toBe(onlyView.id);
    });

    it("does NOT match an is_shared=false view named 'Main table' for priority 3", () => {
      const fakeMain = makeView({
        id: "fake-main",
        name: "Main table",
        is_shared: false, // personal view with same name
        owner_id: "user-99",
      });
      const result = resolveActiveViewId([fakeMain, personalView], undefined, undefined);
      // Priority 3 requires is_shared=true — falls through to first in list.
      expect(result).toBe(fakeMain.id);
    });

    it("picks URL view id regardless of its is_shared status", () => {
      const sharedView = makeView({ id: "shared-v", is_shared: true, name: "Team view" });
      const result = resolveActiveViewId([mainTable, sharedView], sharedView.id, undefined);
      expect(result).toBe(sharedView.id);
    });
  });
});
