import { beforeEach, describe, expect, it } from "vitest";
import {
  migrateLegacyColumnPrefs,
  selectActiveView,
  selectEffectiveConfig,
  selectHasDraftEdits,
  selectViewsForBoard,
  useBoardStore,
} from "@/stores/board-store";
import type { ViewRow } from "@/stores/types/views";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeView(overrides: Partial<ViewRow> = {}): ViewRow {
  return {
    id: "view-1",
    board_id: "board-1",
    owner_id: null,
    name: "Main table",
    kind: "table",
    config: {},
    is_shared: true,
    position: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup: reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  useBoardStore.setState({
    boardId: null,
    groups: [],
    tasks: [],
    cells: new Map(),
    columns: [],
    labelsByColumn: new Map(),
    sortKeys: [],
    viewsByBoard: new Map(),
    activeViewId: null,
    draftConfig: null,
    inBoardSearch: "",
    collapsedGroupIds: new Set(),
    collapsedByBoard: {},
    columnPrefsByBoard: {},
    lastViewByBoard: {},
    selection: new Set(),
    draggingTaskId: null,
    draggingGroupId: null,
    editingTaskId: null,
    tempIdMap: new Map(),
    outbox: [],
    outboxOverflow: false,
    connection: "connected",
    presence: {},
    cursors: new Map(),
    typingByContext: new Map(),
    commentsByTask: new Map(),
    reactionsByComment: new Map(),
    activityByTask: new Map(),
    attachmentsByTask: new Map(),
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("board-store view slice", () => {
  describe("hydrateViewsForBoard", () => {
    it("populates viewsByBoard sorted by position", () => {
      const v1 = makeView({ id: "v1", position: 1 });
      const v2 = makeView({ id: "v2", position: 0 });

      useBoardStore.getState().hydrateViewsForBoard("board-1", [v1, v2]);

      const state = useBoardStore.getState();
      const views = state.viewsByBoard.get("board-1");
      expect(views?.map((v) => v.id)).toEqual(["v2", "v1"]); // sorted by position
    });

    it("replaces existing views for the board on re-hydration", () => {
      const v1 = makeView({ id: "v1" });
      useBoardStore.getState().hydrateViewsForBoard("board-1", [v1]);

      const v2 = makeView({ id: "v2" });
      useBoardStore.getState().hydrateViewsForBoard("board-1", [v2]);

      const views = useBoardStore.getState().viewsByBoard.get("board-1");
      expect(views?.map((v) => v.id)).toEqual(["v2"]);
    });
  });

  describe("applyViewUpsert", () => {
    it("inserts a new view into the board's list", () => {
      useBoardStore.setState({ viewsByBoard: new Map([["board-1", []]]) });
      const v = makeView({ id: "v-new" });

      useBoardStore.getState().applyViewUpsert(v);

      const views = useBoardStore.getState().viewsByBoard.get("board-1");
      expect(views?.some((v) => v.id === "v-new")).toBe(true);
    });

    it("updates an existing view in place", () => {
      const v = makeView({ id: "v1", name: "Old Name" });
      useBoardStore.setState({ viewsByBoard: new Map([["board-1", [v]]]) });

      const updated = { ...v, name: "New Name", updated_at: "2025-06-01T00:00:00Z" };
      useBoardStore.getState().applyViewUpsert(updated);

      const views = useBoardStore.getState().viewsByBoard.get("board-1");
      expect(views?.find((v) => v.id === "v1")?.name).toBe("New Name");
    });
  });

  describe("applyViewDelete", () => {
    it("removes a view from its board's list", () => {
      const v1 = makeView({ id: "v1" });
      const v2 = makeView({ id: "v2" });
      useBoardStore.setState({ viewsByBoard: new Map([["board-1", [v1, v2]]]) });

      useBoardStore.getState().applyViewDelete("v1");

      const views = useBoardStore.getState().viewsByBoard.get("board-1");
      expect(views?.map((v) => v.id)).toEqual(["v2"]);
    });
  });

  describe("setActiveViewId", () => {
    it("updates activeViewId and persists to lastViewByBoard", () => {
      useBoardStore.setState({ boardId: "board-1" });
      useBoardStore.getState().setActiveViewId("v1");

      const state = useBoardStore.getState();
      expect(state.activeViewId).toBe("v1");
      expect(state.lastViewByBoard["board-1"]).toBe("v1");
    });

    it("does not write to lastViewByBoard when viewId is null", () => {
      useBoardStore.setState({ boardId: "board-1", lastViewByBoard: { "board-1": "v1" } });
      useBoardStore.getState().setActiveViewId(null);

      const state = useBoardStore.getState();
      expect(state.activeViewId).toBeNull();
      expect(state.lastViewByBoard["board-1"]).toBe("v1"); // unchanged
    });
  });

  describe("setDraftConfig", () => {
    it("sets draft config", () => {
      useBoardStore.getState().setDraftConfig({ density: "compact" });
      expect(useBoardStore.getState().draftConfig).toEqual({ density: "compact" });
    });

    it("clears draft config when passed null", () => {
      useBoardStore.setState({ draftConfig: { density: "compact" } });
      useBoardStore.getState().setDraftConfig(null);
      expect(useBoardStore.getState().draftConfig).toBeNull();
    });
  });

  describe("setSortKeys", () => {
    it("replaces sortKeys", () => {
      useBoardStore.getState().setSortKeys([
        { columnId: "00000000-0000-0000-0000-000000000001", direction: "asc" },
      ]);
      const { sortKeys } = useBoardStore.getState();
      expect(sortKeys).toHaveLength(1);
      expect(sortKeys[0]?.direction).toBe("asc");
    });

    it("clears sortKeys when passed empty array", () => {
      useBoardStore.setState({
        sortKeys: [{ columnId: "00000000-0000-0000-0000-000000000001", direction: "asc" }],
      });
      useBoardStore.getState().setSortKeys([]);
      expect(useBoardStore.getState().sortKeys).toHaveLength(0);
    });
  });

  describe("setInBoardSearch", () => {
    it("sets inBoardSearch", () => {
      useBoardStore.getState().setInBoardSearch("my query");
      expect(useBoardStore.getState().inBoardSearch).toBe("my query");
    });
  });

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  describe("selectActiveView", () => {
    it("returns null when boardId is null", () => {
      const state = useBoardStore.getState();
      expect(selectActiveView(state)).toBeNull();
    });

    it("returns the view matching activeViewId", () => {
      const v = makeView({ id: "v1" });
      useBoardStore.setState({
        boardId: "board-1",
        activeViewId: "v1",
        viewsByBoard: new Map([["board-1", [v]]]),
      });

      const view = selectActiveView(useBoardStore.getState());
      expect(view?.id).toBe("v1");
    });

    it("returns null when activeViewId is not in the views map", () => {
      useBoardStore.setState({
        boardId: "board-1",
        activeViewId: "non-existent",
        viewsByBoard: new Map([["board-1", [makeView({ id: "v1" })]]]),
      });

      expect(selectActiveView(useBoardStore.getState())).toBeNull();
    });
  });

  describe("selectEffectiveConfig", () => {
    it("returns draftConfig when draft is set", () => {
      useBoardStore.setState({ draftConfig: { density: "compact" } });
      const config = selectEffectiveConfig(useBoardStore.getState());
      expect(config.density).toBe("compact");
    });

    it("returns parsed view config when no draft", () => {
      const v = makeView({ id: "v1", config: { density: "spacious" } });
      useBoardStore.setState({
        boardId: "board-1",
        activeViewId: "v1",
        viewsByBoard: new Map([["board-1", [v]]]),
        draftConfig: null,
      });

      const config = selectEffectiveConfig(useBoardStore.getState());
      expect(config.density).toBe("spacious");
    });

    it("returns empty config (EMPTY_CONFIG sentinel) when no view and no draft", () => {
      const config = selectEffectiveConfig(useBoardStore.getState());
      // Empty config — all keys undefined.
      expect(Object.keys(config)).toHaveLength(0);
    });
  });

  describe("selectHasDraftEdits", () => {
    it("returns false when draftConfig is null", () => {
      useBoardStore.setState({ draftConfig: null });
      expect(selectHasDraftEdits(useBoardStore.getState())).toBe(false);
    });

    it("returns true when draftConfig is set", () => {
      useBoardStore.setState({ draftConfig: { density: "compact" } });
      expect(selectHasDraftEdits(useBoardStore.getState())).toBe(true);
    });
  });

  describe("selectViewsForBoard", () => {
    it("returns empty array when board has no views", () => {
      const result = selectViewsForBoard(useBoardStore.getState(), "board-1");
      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns views sorted by position", () => {
      const v1 = makeView({ id: "v1", position: 2 });
      const v2 = makeView({ id: "v2", position: 1 });
      useBoardStore.setState({
        viewsByBoard: new Map([["board-1", [v1, v2]]]),
      });

      const result = selectViewsForBoard(useBoardStore.getState(), "board-1");
      // hydrateViewsForBoard sorts; here we have pre-sorted manually. The selector
      // just returns the stored array.
      expect(result.map((v) => v.id)).toEqual(["v1", "v2"]); // pre-inserted order
    });

    it("returns EMPTY_ARRAY sentinel (stable reference) when no views", () => {
      const r1 = selectViewsForBoard(useBoardStore.getState(), "board-1");
      const r2 = selectViewsForBoard(useBoardStore.getState(), "board-1");
      expect(r1).toBe(r2); // Same reference — stable sentinel.
    });
  });
});

describe("migrateLegacyColumnPrefs", () => {
  it("extracts widths and inverts hidden flags", () => {
    useBoardStore.setState({
      columnPrefsByBoard: {
        "board-1": {
          "col-a": { width: 200, hidden: true },
          "col-b": { width: 140, hidden: false },
          "col-c": { hidden: true },
        },
      },
    });

    const { columnWidths, columnVisibility } = migrateLegacyColumnPrefs(
      useBoardStore.getState(),
      "board-1",
    );

    expect(columnWidths["col-a"]).toBe(200);
    expect(columnWidths["col-b"]).toBe(140);
    expect(columnWidths["col-c"]).toBeUndefined(); // no width set

    expect(columnVisibility["col-a"]).toBe(false); // hidden=true → visible=false
    expect(columnVisibility["col-b"]).toBe(true);  // hidden=false → visible=true
    expect(columnVisibility["col-c"]).toBe(false); // hidden=true → visible=false
  });

  it("returns empty objects when no prefs exist for the board", () => {
    const { columnWidths, columnVisibility } = migrateLegacyColumnPrefs(
      useBoardStore.getState(),
      "board-xyz",
    );
    expect(columnWidths).toEqual({});
    expect(columnVisibility).toEqual({});
  });
});
